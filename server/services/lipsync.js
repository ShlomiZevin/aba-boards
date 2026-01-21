/**
 * Generate lip-sync data from MP3 audio buffer by analyzing amplitude
 * @param {Buffer} audioBuffer - MP3 audio buffer
 * @param {number} mouthShapeCount - Number of available mouth shapes (3-6)
 * @returns {Array<{start: number, end: number, shapeIndex: number}>}
 */
function generateAmplitudeLipSync(audioBuffer, mouthShapeCount = 4) {
  const sampleInterval = 50; // Analyze every 50ms

  // Estimate duration from buffer size (MP3 ~128kbps = 16KB/sec)
  const estimatedDurationMs = (audioBuffer.length / 16);
  const numSamples = Math.floor(estimatedDurationMs / sampleInterval);

  if (numSamples < 2) {
    return [{ start: 0, end: 1, shapeIndex: 0 }];
  }

  // First pass: collect all amplitudes to find min/max for normalization
  const amplitudes = [];

  for (let i = 0; i < numSamples; i++) {
    const startByte = Math.floor((i / numSamples) * audioBuffer.length);
    const endByte = Math.floor(((i + 1) / numSamples) * audioBuffer.length);

    // Calculate variance in this chunk (more variance = louder sound)
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let j = startByte; j < endByte && j < audioBuffer.length; j++) {
      const val = audioBuffer[j];
      sum += val;
      sumSq += val * val;
      count++;
    }

    if (count > 0) {
      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      amplitudes.push(Math.sqrt(variance)); // Standard deviation as amplitude
    } else {
      amplitudes.push(0);
    }
  }

  // Find min and max for normalization (ignore outliers)
  const sorted = [...amplitudes].sort((a, b) => a - b);
  const minAmp = sorted[Math.floor(sorted.length * 0.1)]; // 10th percentile
  const maxAmp = sorted[Math.floor(sorted.length * 0.9)]; // 90th percentile
  const range = maxAmp - minAmp || 1;

  // Second pass: create cues with normalized amplitudes
  const cues = [];

  for (let i = 0; i < numSamples; i++) {
    // Normalize to 0-1 range
    const normalized = Math.max(0, Math.min(1, (amplitudes[i] - minAmp) / range));

    // Map to mouth shape (use power curve for more natural feel)
    const shaped = Math.pow(normalized, 0.7);
    const shapeIndex = Math.round(shaped * (mouthShapeCount - 1));

    const startTime = (i * sampleInterval) / 1000;
    const endTime = ((i + 1) * sampleInterval) / 1000;

    cues.push({
      start: startTime,
      end: endTime,
      shapeIndex: Math.min(shapeIndex, mouthShapeCount - 1)
    });
  }

  // Smooth out rapid changes
  for (let i = 1; i < cues.length - 1; i++) {
    const prev = cues[i - 1].shapeIndex;
    const curr = cues[i].shapeIndex;
    const next = cues[i + 1].shapeIndex;

    // Smooth isolated spikes
    if (Math.abs(curr - prev) > 2 && Math.abs(curr - next) > 2) {
      cues[i].shapeIndex = Math.round((prev + next) / 2);
    }
  }

  // End with closed mouth
  if (cues.length > 0) {
    cues[cues.length - 1].shapeIndex = 0;
  }

  return cues;
}

/**
 * Map Rhubarb shapes to available image indices
 * If user has fewer than 6 images, map to available ones
 * @param {Array} lipSyncData - Lip sync data with shapes A-F
 * @param {number} availableShapes - Number of mouth images available (3-6)
 * @returns {Array} - Lip sync data with mapped shape indices (0-based)
 */
function mapShapesToAvailable(lipSyncData, availableShapes) {
  // Standard Rhubarb shapes: A, B, C, D, E, F
  // Map to available indices based on how many images we have

  const shapeMapping = {
    3: { A: 0, B: 1, C: 2, D: 2, E: 1, F: 1, X: 0 }, // closed, mid, open
    4: { A: 0, B: 1, C: 2, D: 3, E: 2, F: 1, X: 0 }, // closed, slight, open, wide
    5: { A: 0, B: 1, C: 2, D: 3, E: 4, F: 1, X: 0 }, // + rounded
    6: { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, X: 0 }  // all shapes
  };

  const mapping = shapeMapping[availableShapes] || shapeMapping[6];

  return lipSyncData.map(cue => ({
    ...cue,
    shapeIndex: mapping[cue.shape] ?? 0
  }));
}

/**
 * Generate lip-sync from ElevenLabs alignment data (character timestamps)
 * @param {object} alignment - ElevenLabs alignment object with characters and timing
 * @param {number} mouthShapeCount - Number of available mouth shapes (3-6)
 * @returns {Array<{start: number, end: number, shapeIndex: number}>}
 */
function generateTimestampLipSync(alignment, mouthShapeCount = 4) {
  if (!alignment || !alignment.characters || !alignment.character_start_times_seconds) {
    return [{ start: 0, end: 1, shapeIndex: 0 }];
  }

  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  const cues = [];

  // Map characters to mouth openness
  // Vowels = open, consonants = varied, spaces/punctuation = closed
  const getShapeForChar = (char) => {
    const c = char.toLowerCase();

    // Spaces and punctuation - closed mouth
    if (/[\s.,!?;:\-]/.test(c)) return 0;

    // Open vowels (Hebrew and English)
    if (/[aeouאאָאַאֵאֶאִאֻאוֹעיו]/.test(c)) {
      return mouthShapeCount - 1; // Most open
    }

    // Semi-open sounds
    if (/[iéèêëןם]/.test(c)) {
      return Math.floor((mouthShapeCount - 1) * 0.7);
    }

    // Lip consonants (closed or rounded)
    if (/[bpmwבפמו]/.test(c)) {
      return Math.floor((mouthShapeCount - 1) * 0.3);
    }

    // Other consonants - mid position
    return Math.floor((mouthShapeCount - 1) * 0.5);
  };

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const start = character_start_times_seconds[i];
    const end = character_end_times_seconds[i];

    if (start === undefined || end === undefined) continue;

    const shapeIndex = getShapeForChar(char);

    cues.push({
      start,
      end,
      shapeIndex: Math.min(shapeIndex, mouthShapeCount - 1)
    });
  }

  // Add closed mouth at the end
  if (cues.length > 0) {
    const lastEnd = cues[cues.length - 1].end;
    cues.push({
      start: lastEnd,
      end: lastEnd + 0.1,
      shapeIndex: 0
    });
  }

  return cues;
}

module.exports = {
  generateAmplitudeLipSync,
  generateTimestampLipSync,
  mapShapesToAvailable
};
