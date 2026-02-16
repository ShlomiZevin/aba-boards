#!/usr/bin/env node
/**
 * Deploy script for ABA Boards
 *
 * This script:
 * 1. Builds the therapy center React app
 * 2. Copies built files to public/therapy/
 * 3. Deploys to Firebase Hosting
 *
 * Usage: node deploy.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const THERAPY_DIR = path.join(ROOT_DIR, 'therapy-center');
const THERAPY_DIST = path.join(THERAPY_DIR, 'dist');
const PUBLIC_THERAPY = path.join(ROOT_DIR, 'public', 'therapy');

function run(cmd, cwd = ROOT_DIR) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function copyDir(src, dest) {
  // Create destination if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

console.log('========================================');
console.log('  ABA Boards - Deploy Script');
console.log('========================================');

// Step 1: Build therapy center
console.log('\n[1/3] Building therapy center...');
run('npm run build', THERAPY_DIR);

// Step 2: Copy to public/therapy
console.log('\n[2/3] Copying to public/therapy...');
cleanDir(PUBLIC_THERAPY);
copyDir(THERAPY_DIST, PUBLIC_THERAPY);
console.log('Copied successfully!');

// Step 3: Deploy to Firebase
console.log('\n[3/3] Deploying to Firebase...');
run('firebase deploy --only hosting');

console.log('\n========================================');
console.log('  Deploy complete!');
console.log('========================================\n');
