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

---

# Production Deployment (Cloud Run)

The app runs on Google Cloud Run at:
`https://avatar-server-1018338671074.me-west1.run.app`

## Step 1 — Set Environment Variables on Cloud Run

Run this command once (or update via Google Cloud Console → Cloud Run → avatar-server → Edit & Deploy → Variables):

```bash
gcloud run services update avatar-server \
  --region me-west1 \
  --update-env-vars \
"PAYPAL_MODE=live,\
PAYPAL_CLIENT_ID=YOUR_LIVE_CLIENT_ID,\
PAYPAL_CLIENT_SECRET=YOUR_LIVE_CLIENT_SECRET,\
PAYPAL_MONTHLY_PLAN_ID=YOUR_MONTHLY_PLAN_ID,\
PAYPAL_YEARLY_PLAN_ID=YOUR_YEARLY_PLAN_ID,\
PAYPAL_WEBHOOK_ID=YOUR_WEBHOOK_ID,\
APP_BASE_URL=https://avatar-server-1018338671074.me-west1.run.app"
```

> Fill in the actual values from `server/.env` (not committed to git).

## Step 2 — Build Frontend

The frontend must be built with the Live PayPal Client ID. The `therapy-center/.env` file is already set correctly. Run:

```bash
cd therapy-center
npm run build
```

This outputs to `therapy-center/dist/`.

## Step 3 — Deploy to Cloud Run

```bash
cd server
gcloud run deploy avatar-server \
  --source . \
  --region me-west1 \
  --project aba-ai-d74f5
```

> The server serves the built frontend from `therapy-center/dist/` statically.

## PayPal Live Credentials Summary

| Variable | Where to find |
|----------|--------------|
| `PAYPAL_MODE` | `live` |
| `PAYPAL_CLIENT_ID` | PayPal Developer Dashboard → Live App |
| `PAYPAL_CLIENT_SECRET` | PayPal Developer Dashboard → Live App |
| `PAYPAL_MONTHLY_PLAN_ID` | paypal.com/billing/plans |
| `PAYPAL_YEARLY_PLAN_ID` | paypal.com/billing/plans |
| `PAYPAL_WEBHOOK_ID` | PayPal Developer Dashboard → Live App → Webhooks |
| `VITE_PAYPAL_CLIENT_ID` | Same as `PAYPAL_CLIENT_ID` (set in `therapy-center/.env`) |

## PayPal Dashboard

- **Developer console:** https://developer.paypal.com/dashboard/applications/live
- **Subscription plans:** https://www.paypal.com/billing/plans
- **App name:** MyApp_Kofi
