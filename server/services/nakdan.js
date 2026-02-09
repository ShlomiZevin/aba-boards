/**
 * Dicta Nakdan Service - Adds Hebrew nikud (vowel marks) to text
 * Uses the free Dicta API from Bar-Ilan University
 */

const NAKDAN_API_URL = 'https://nakdan-u1-0.loadbalancer.dicta.org.il/api';

/**
 * Add nikud to Hebrew text using Dicta's Nakdan API
 * @param {string} text - Hebrew text without nikud
 * @returns {Promise<string>} - Text with nikud added
 */
async function addNikud(text) {
  if (!text || text.trim() === '') {
    return text;
  }

  try {
    const response = await fetch(NAKDAN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Accept': '*/*'
      },
      body: JSON.stringify({
        task: 'nakdan',
        data: text,
        addmorph: true,
        keepmetagim: true,
        keepqq: false,
        nodageshdefmem: false,
        patachma: false,
        useTokenization: true,
        genre: 'modern'
      })
    });

    if (!response.ok) {
      console.error('Nakdan API error:', response.status, response.statusText);
      return text; // Return original text on error
    }

    const result = await response.json();

    // Build the nikud text from the response
    let nikudText = '';

    for (const item of result.data) {
      if (item.sep) {
        // Separator (space, punctuation, etc.)
        nikudText += item.str;
      } else if (item.nakdan && item.nakdan.options && item.nakdan.options.length > 0) {
        // Word with nikud options - take the first (best) option
        const bestOption = item.nakdan.options[0];
        nikudText += bestOption.w;
      } else {
        // No nikud options available, use original
        nikudText += item.str;
      }
    }

    return nikudText;
  } catch (error) {
    console.error('Nakdan service error:', error);
    return text; // Return original text on error
  }
}

module.exports = {
  addNikud
};
