#!/usr/bin/env node
/**
 * Deploy script for ABA Boards
 *
 * This script:
 * 1. Builds the therapy center React app (the redesign, therapy-center-v2)
 * 2. Copies built files to public/therapy/
 *    and builds the previous app (therapy-center) into public/therapy-classic/ as a fallback
 * 3. Deploys to Firebase Hosting
 *
 * Usage: node deploy.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
// /therapy is the redesigned app ("מחברת שטח", Nov 2026). The previous app is kept,
// unchanged, at /therapy-classic so anyone can switch back.
const THERAPY_DIR = path.join(ROOT_DIR, 'therapy-center-v2');
const THERAPY_DIST = path.join(THERAPY_DIR, 'dist');
const PUBLIC_THERAPY = path.join(ROOT_DIR, 'public', 'therapy');
const CLASSIC_DIR = path.join(ROOT_DIR, 'therapy-center');
const CLASSIC_DIST = path.join(CLASSIC_DIR, 'dist-classic');
const PUBLIC_CLASSIC = path.join(ROOT_DIR, 'public', 'therapy-classic');
// Build-model guides from the ABBA session — must match MODELS_BASE in therapy-center/src/api/client.ts
const MODELS_SRC = path.join(ROOT_DIR, '..', 'reports', 'nevo-models');
const PUBLIC_MODELS = path.join(ROOT_DIR, 'public', 'build-models-n7q4');
const MODELS_SKIP = new Set(['_src', 'prompts', 'index.html']);

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

// Step 2a: The previous app, built under /therapy-classic/
console.log('\n[2a] Building the previous app into public/therapy-classic...');
run('npx vite build --base /therapy-classic/ --outDir dist-classic', CLASSIC_DIR);
cleanDir(PUBLIC_CLASSIC);
copyDir(CLASSIC_DIST, PUBLIC_CLASSIC);

// Step 2b: Copy build models (sources excluded; the folder index redirects to the Models tab)
if (fs.existsSync(MODELS_SRC)) {
  console.log('\n[2b] Copying build models...');
  cleanDir(PUBLIC_MODELS);
  for (const entry of fs.readdirSync(MODELS_SRC, { withFileTypes: true })) {
    if (MODELS_SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
    const src = path.join(MODELS_SRC, entry.name);
    const dest = path.join(PUBLIC_MODELS, entry.name);
    if (entry.isDirectory()) copyDir(src, dest); else fs.copyFileSync(src, dest);
  }
  fs.writeFileSync(path.join(PUBLIC_MODELS, 'index.html'),
    '<!doctype html><meta charset="utf-8"><script>var h="/therapy/models";try{h=localStorage.getItem("models_home")||h}catch(e){}location.replace(h)</script>');
}

// Step 3: Deploy to Firebase
console.log('\n[3/3] Deploying to Firebase...');
run('firebase deploy --only hosting');

console.log('\n========================================');
console.log('  Deploy complete!');
console.log('========================================\n');
