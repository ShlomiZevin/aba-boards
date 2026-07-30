// Leonardo AI text-to-image generation (used by the AI chat).
// Docs: https://docs.leonardo.ai — v2 generations endpoint returns a generationId
// plus an upfront cost (in USD); images are fetched by polling the v1 endpoint.

const API_BASE = 'https://cloud.leonardo.ai/api/rest';

// The only models exposed to the user, mapped to their Leonardo model id.
// 9:16 "tall, small" dimensions per model:
//  - Nano Banana models support a true 9:16 1K pair (768x1376).
//  - GPT Image only supports square/portrait/landscape natively; its portrait
//    (1024x1536) is the closest "tall" option.
const MODELS = {
  'gpt-image-2': { id: 'gpt-image-2', label: 'GPT Image 2', width: 1024, height: 1536 },
  'nano-banana-2': { id: 'nano-banana-2', label: 'Nano Banana 2', width: 768, height: 1376 },
  'nano-banana-pro': { id: 'gemini-image-2', label: 'Nano Banana Pro', width: 768, height: 1376 },
};

const DEFAULT_MODEL = 'nano-banana-2';
const IMAGES_PER_REQUEST = 2; // always suggest 2 images

function authHeaders() {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) throw new Error('LEONARDO_API_KEY is not configured');
  return {
    authorization: `Bearer ${key}`,
    accept: 'application/json',
    'content-type': 'application/json',
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Generate images from a text prompt.
 * @param {Object} opts
 * @param {string} opts.prompt      - text-to-image prompt
 * @param {string} [opts.model]     - one of MODELS keys (chosen by the user)
 * @param {number} [opts.quantity]  - defaults to 2
 * @returns {Promise<{ images: string[], cost: number, costCurrency: string,
 *                     model: string, modelLabel: string, width: number, height: number }>}
 */
async function generateImages({ prompt, model, quantity } = {}) {
  if (!prompt || !prompt.trim()) throw new Error('חובה לספק תיאור לתמונה');

  const chosen = MODELS[model] || MODELS[DEFAULT_MODEL];
  const count = quantity || IMAGES_PER_REQUEST;

  // 1) Submit the generation job
  const body = {
    model: chosen.id,
    parameters: {
      prompt: prompt.trim(),
      quantity: count,
      width: chosen.width,
      height: chosen.height,
      prompt_enhance: 'OFF',
    },
    public: false,
  };

  const postRes = await fetch(`${API_BASE}/v2/generations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const postJson = await postRes.json().catch(() => null);

  if (!postRes.ok || !postJson || !postJson.generate || !postJson.generate.generationId) {
    const msg = extractError(postJson) || `Leonardo generation failed (HTTP ${postRes.status})`;
    throw new Error(msg);
  }

  const generationId = postJson.generate.generationId;
  // Cost is returned upfront in USD for the whole batch.
  const cost = parseFloat(postJson.generate.cost?.amount ?? '0') || 0;
  const costCurrency = postJson.generate.cost?.unit === 'DOLLARS' ? 'USD' : (postJson.generate.cost?.unit || 'USD');

  // 2) Poll until the generation is COMPLETE (or fails / times out)
  const images = await pollGeneration(generationId);

  return {
    images,
    cost,
    costCurrency,
    model,
    modelLabel: chosen.label,
    width: chosen.width,
    height: chosen.height,
  };
}

async function pollGeneration(generationId, { attempts = 40, intervalMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    const res = await fetch(`${API_BASE}/v1/generations/${generationId}`, {
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => null);
    const gen = json?.generations_by_pk;
    if (!gen) continue;

    if (gen.status === 'COMPLETE') {
      return (gen.generated_images || []).map((img) => img.url).filter(Boolean);
    }
    if (gen.status === 'FAILED') {
      throw new Error('יצירת התמונה נכשלה');
    }
    // PENDING — keep polling
  }
  throw new Error('יצירת התמונה ארכה זמן רב מדי. נסו שוב.');
}

function extractError(json) {
  if (!json) return null;
  if (Array.isArray(json)) {
    return json[0]?.extensions?.details?.message || json[0]?.message || null;
  }
  return json.error || json.message || null;
}

module.exports = { generateImages, MODELS, IMAGES_PER_REQUEST };
