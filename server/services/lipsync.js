const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Rhubarb mouth shapes mapping
// A: Closed mouth (rest position, "M", "B", "P")
// B: Slightly open (consonants like "K", "G")
// C: Open (vowels like "EH", "AH")
// D: Wide open (vowels like "AA")
// E: Rounded (vowels like "OH", "OO")
// F: Upper teeth on lower lip ("F", "V")

const RHUBARB_PATH = process.env.RHUBARB_PATH || 'rhubarb'; // Assumes rhubarb is in PATH

/**
 * Generate lip-sync data from audio file using Rhubarb
 * @param {string} audioPath - Path to the audio file
 * @returns {Promise<Array<{start: number, end: number, shape: string}>>}
 */
async function generateLipSync(audioPath) {
  return new Promise((resolve, reject) => {
    const args = [
      audioPath,
      '-f', 'json', // Output format
      '--machineReadable' // No progress output
    ];

    const rhubarb = spawn(RHUBARB_PATH, args);

    let stdout = '';
    let stderr = '';

    rhubarb.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    rhubarb.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    rhubarb.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Rhubarb exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        // Rhubarb returns { mouthCues: [{ start, end, value }] }
        const lipSyncData = result.mouthCues.map(cue => ({
          start: cue.start,
          end: cue.end,
          shape: cue.value
        }));
        resolve(lipSyncData);
      } catch (e) {
        reject(new Error(`Failed to parse Rhubarb output: ${e.message}`));
      }
    });

    rhubarb.on('error', (err) => {
      reject(new Error(`Failed to run Rhubarb: ${err.message}. Make sure Rhubarb is installed and in PATH.`));
    });
  });
}

/**
 * Simple fallback lip-sync generator based on audio duration
 * This creates a basic mouth movement pattern without Rhubarb
 * @param {number} durationMs - Audio duration in milliseconds
 * @returns {Array<{start: number, end: number, shape: string}>}
 */
function generateSimpleLipSync(durationMs) {
  const shapes = ['A', 'B', 'C', 'D', 'C', 'B']; // Natural talking pattern
  const cues = [];
  const interval = 100; // Change mouth every 100ms

  let currentTime = 0;
  let shapeIndex = 0;

  while (currentTime < durationMs / 1000) {
    const nextTime = currentTime + interval / 1000;
    cues.push({
      start: currentTime,
      end: Math.min(nextTime, durationMs / 1000),
      shape: shapes[shapeIndex % shapes.length]
    });
    currentTime = nextTime;
    shapeIndex++;
  }

  // End with closed mouth
  if (cues.length > 0) {
    cues[cues.length - 1].shape = 'A';
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

module.exports = {
  generateLipSync,
  generateSimpleLipSync,
  mapShapesToAvailable
};
