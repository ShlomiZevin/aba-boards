# Local Development Setup

## Quick Start

1. **Clone the repo** and place the files from this folder:
   - `service-account.json` → `server/service-account.json`
   - `.env` → `server/.env`

2. **Install dependencies:**
   ```bash
   cd server && npm install
   cd ../therapy-center && npm install
   ```

3. **Start the server** (terminal 1):
   ```bash
   cd server
   npm start
   ```
   Server runs on `http://localhost:3001`

4. **Start the frontend** (terminal 2):
   ```bash
   cd therapy-center
   npm run dev
   ```
   Frontend runs on `http://localhost:5173` — proxies `/api` to the server automatically.

5. **Open in browser:** `http://localhost:5173/login`

## Test Accounts

| Role | Passkey | Name | Notes |
|------|---------|------|-------|
| **Dev/Test admin** | `8888` | Kosta | Use for all development and testing |
| **Super admin** | `6724` | Michal | **REAL DATA — DO NOT modify any data under this account** |

## What's in This Folder

| File | Place it at | Purpose |
|------|-------------|---------|
| `service-account.json` | `server/service-account.json` | Firebase Admin SDK credentials — connects to Firestore |
| `.env` | `server/.env` | API keys (OpenAI, ElevenLabs, Anthropic) |
| `SETUP.md` | (this file) | Setup instructions |

## Architecture Overview

- **Server:** Express on port 3001, uses Firebase Admin SDK to talk to Firestore
- **Frontend:** React + Vite on port 5173, proxies `/api/*` to server
- **Database:** Firestore (cloud) — project `aba-ai-d74f5`
- **Auth:** Passkey-based (not Firebase Auth) — admin enters a secret key, server validates against `adminKeys` collection
- **No local database needed** — everything reads/writes to the cloud Firestore

## Important

- The `.env` and `service-account.json` files contain **real credentials** — do not commit them to git
- The super admin account has **real production data** (real kids, therapists, session forms) — only use it to verify super admin exemption from billing
- All testing should use the `8888` account or new accounts created via the signup flow
- See `CLAUDE.md` at the project root for full architecture documentation
