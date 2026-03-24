# Task 001: Free-to-Pro Journey — Full Technical Spec

> **Status:** Pending
> **Priority:** High
> **Scope:** Therapy Center (React frontend + Express backend)

---

## Overview

Add a complete new-user journey to the therapy center: **self-signup → 7-day free trial → PayPal payment → Pro subscription**. This also includes a small product feature: letting admins edit their own profile (name, phone, email).

Currently, only the super admin can create center admins manually. After this task, anyone can sign up from the landing page, get 7 days of full access, and then must pay to continue.

---

## Current State (What Exists Today)

### Authentication
- **Passkey-based** (not Firebase Auth, not email/password)
- Each admin has a record in `adminKeys` Firestore collection with fields: `key`, `adminId` (UUID), `name`, `isSuperAdmin`, `active`, `createdAt`, `createdBy`
- Login: user enters access key → `GET /api/admin/me` validates it → returns `{ adminId, isSuperAdmin, name }`
- Key stored in `localStorage` as `admin_key`
- Every API request sends `X-Admin-Key` header
- Middleware (`server/middleware/auth.js`) validates and sets `req.adminId`, `req.isSuperAdmin`, `req.adminName`

### Admin Creation (Super Admin Only)
- `POST /api/admin/create-key` — requires super admin auth
- Creates entry in `adminKeys` + parallel entry in `practitioners` collection
- Fields collected: name (required), key (required, min 4 chars), mobile (optional), email (optional)
- The practitioner entry stores: name, mobile, email, type (hardcoded 'מנתחת התנהגות'), isSuperAdmin, createdAt, createdBy

### Admin Profile
- **No self-edit capability** — admins can only change their access key (modal in AppShell.tsx)
- Name is displayed in sidebar (`AppShell.tsx`) but cannot be edited by the admin
- No phone/email visible or editable by the admin
- No profile/settings page exists

### Billing
- **Nothing** — no plans, subscriptions, trials, or payment integration anywhere in the codebase

### Key Files
| File | Purpose |
|------|---------|
| `therapy-center/src/contexts/AuthContext.tsx` | Auth state, login/logout, stores `{ adminId, isSuperAdmin, name }` |
| `therapy-center/src/pages/Login.tsx` | Login UI (passcode input) |
| `therapy-center/src/pages/AdminManagement.tsx` | Super admin creates/manages center admins |
| `therapy-center/src/components/AppShell.tsx` | Sidebar shell, shows admin name, has "change key" modal |
| `therapy-center/src/api/client.ts` | All API calls, `fetchApi` wrapper with `X-Admin-Key` header |
| `therapy-center/src/types/index.ts` | All shared TypeScript types |
| `server/routes/admin.js` | Admin CRUD endpoints |
| `server/middleware/auth.js` | Auth middleware (validates key, sets req.adminId) |
| `server/routes/therapy.js` | All therapy-center API routes |
| `server/services/therapy.js` | All Firestore CRUD logic |
| `server/services/firebase.js` | Firestore `db` instance |

---

## Feature 1: Admin Profile Editing

### What to Build
A "My Profile" section (modal or page — modal is more consistent with existing UX since "change key" is already a modal) where the logged-in admin can view and edit:
- **Name** (text, required)
- **Phone** (text, optional)
- **Email** (text, optional)

### Backend Changes
- **New endpoint:** `PUT /api/admin/profile` (authenticated)
  - Accepts `{ name, mobile, email }`
  - Updates `adminKeys` doc: `name` field
  - Updates matching `practitioners` doc (same `adminId`): `name`, `mobile`, `email`
  - Returns updated profile
- **Extend `GET /api/admin/me`** to also return `mobile` and `email` (currently only returns `adminId`, `isSuperAdmin`, `name`)
  - Fetch from the `practitioners` doc linked by `adminId`

### Frontend Changes
- **Extend `AuthUser` type** in `types/index.ts` to include `mobile?: string` and `email?: string`
- **Update `AuthContext`** to store and expose the new fields
- **Add profile modal/section** in `AppShell.tsx` (near the existing "change key" modal)
  - Show current name, phone, email in editable form
  - Save button calls `PUT /api/admin/profile`
  - On success, update AuthContext user state

### Important Notes
- The `practitioners` collection already has `mobile` and `email` fields — they're set during admin creation but never exposed to the admin themselves
- Keep the existing "change key" functionality separate — it's a security action, not profile editing
- The admin's `name` exists in TWO places (`adminKeys.name` and `practitioners.name`) — update both

---

## Feature 2: Self-Signup Flow

### What to Build
A public signup page where anyone can create a new center admin account without super admin intervention.

### Signup Page (`/signup`)
Collect:
- **Name** (required) — center/admin name
- **Phone** (required) — mobile number
- **Email** (required) — email address
- **Access key** (required, min 4 chars) — the passcode they'll use to log in
- **Confirm access key** (required) — must match

All fields required at signup (unlike super-admin creation where phone/email are optional).

Design should match the existing Login.tsx style (Hebrew, RTL, clean). Add a link from Login page → Signup page and vice versa.

### Backend Changes
- **New endpoint:** `POST /api/admin/signup` (**public, no auth required**)
  - Accepts `{ name, mobile, email, key }`
  - Validates: name not empty, key min 4 chars, key unique in `adminKeys`
  - Creates `adminKeys` doc: `{ key, adminId: uuid, name, isSuperAdmin: false, active: true, createdAt, createdBy: 'self-signup' }`
  - Creates `practitioners` doc: `{ name, mobile, email, type: 'מנתחת התנהגות', isSuperAdmin: false, adminId, createdAt, createdBy: 'self-signup' }`
  - Creates `subscriptions` doc (see Feature 3 below)
  - Returns `{ key, adminId, name }` — same shape as login response
  - **Rate limiting**: Consider basic protection (e.g., max 5 signups per IP per hour) to prevent abuse

### Frontend Changes
- **New page:** `therapy-center/src/pages/Signup.tsx`
- **Route:** Add `/signup` to the router (public, no auth guard)
- After successful signup, auto-login (store key in localStorage, set AuthContext) and redirect to Dashboard
- **Landing page CTA buttons** ("התחילו בחינם", "התחילו לעשות — חינם") should navigate to `/signup` instead of `/login`

### Important Notes
- This endpoint must be **public** (no `X-Admin-Key` required) — it's for new users who don't have a key yet
- The existing `POST /api/admin/create-key` (super admin) should ALSO create a subscription doc (trial) for the new admin
- Reuse as much logic as possible between signup and super-admin creation

---

## Feature 3: Subscription & Trial System

### Data Model

**New Firestore collection: `subscriptions`**

```typescript
interface Subscription {
  adminId: string;              // links to adminKeys.adminId
  plan: 'trial' | 'pro';       // current plan
  status: 'active' | 'expired' | 'cancelled'; // subscription status
  trialStartDate: Timestamp;    // when trial began (signup date)
  trialEndDate: Timestamp;      // trialStartDate + 7 days
  proStartDate?: Timestamp;     // when pro subscription started (after payment)
  proEndDate?: Timestamp;       // current billing period end
  billingCycle?: 'monthly' | 'yearly'; // chosen billing cycle
  priceILS: number;             // 20 (monthly) or 200 (yearly)
  paypalSubscriptionId?: string; // PayPal subscription ID for managing/cancelling
  paypalPayerId?: string;       // PayPal payer ID
  lastPaymentDate?: Timestamp;  // last successful payment
  nextPaymentDate?: Timestamp;  // next expected payment
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Trial Logic
- On signup (or super-admin creating a center admin): create `subscriptions` doc with `plan: 'trial'`, `status: 'active'`, `trialEndDate: now + 7 days`
- **Super admin (`michal-super-admin`)** is exempt — no subscription doc needed, always has access

### Access Control (The "Gate")

**Backend — middleware level:**
- Extend `server/middleware/auth.js` (or create new middleware `subscription.js`)
- After authenticating the admin, check their subscription:
  1. If `isSuperAdmin` → always allow
  2. Fetch `subscriptions` doc by `adminId`
  3. If `plan === 'trial'` and `now < trialEndDate` → allow
  4. If `plan === 'pro'` and `status === 'active'` → allow
  5. Otherwise → return `403` with `{ error: 'subscription_expired', message: '...' }`
- Apply this middleware to ALL therapy routes (`/api/therapy/*`) and admin data routes
- **Exempt routes** (no subscription check): `/api/admin/me`, `/api/admin/signup`, `/api/admin/profile`, `/api/admin/subscription` (the user needs these to see their status and pay)

**Frontend — blocking screen:**
- Extend `AuthContext` to also fetch and store subscription status
- Add subscription info to `GET /api/admin/me` response (or new endpoint `GET /api/admin/subscription`)
- Create a `SubscriptionGate` component that wraps the app inside `AppShell`
- If subscription is expired → render a full-screen "Your trial has ended" page with:
  - Message explaining the trial is over
  - The two pricing options (monthly/yearly)
  - PayPal payment buttons
  - Contact WhatsApp link for questions
- If subscription is active → render children normally
- Show trial countdown in sidebar/header (e.g., "3 days left in trial") with upgrade CTA

### Subscription Status Endpoint
- **`GET /api/admin/subscription`** (authenticated)
  - Returns current subscription doc
  - Frontend uses this to display trial status, plan info, etc.

---

## Feature 4: PayPal Payment Integration

### PayPal Setup
Use **PayPal Subscriptions API** (not one-time payments) for recurring billing.

PayPal supports paying with:
- PayPal account balance
- Credit/debit card (even without PayPal account) — this is built into PayPal checkout

### PayPal Products & Plans to Create (in PayPal Dashboard)
1. **Product:** "Doing Pro — Therapy Center Management"
2. **Plan — Monthly:** 20 ILS/month, auto-renew
3. **Plan — Yearly:** 200 ILS/year, auto-renew

### Backend Changes

**Environment variables needed:**
```
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MONTHLY_PLAN_ID=...    # Created in PayPal dashboard
PAYPAL_YEARLY_PLAN_ID=...     # Created in PayPal dashboard
PAYPAL_WEBHOOK_ID=...         # For webhook signature verification
PAYPAL_MODE=sandbox|live      # Toggle between sandbox and production
```

**New endpoints:**

1. **`POST /api/admin/subscription/create`** (authenticated)
   - Accepts `{ billingCycle: 'monthly' | 'yearly' }`
   - Creates a PayPal subscription via API
   - Returns the PayPal approval URL to redirect the user to

2. **`POST /api/admin/subscription/activate`** (authenticated)
   - Called after user returns from PayPal approval
   - Accepts `{ subscriptionId: string }` (from PayPal return URL params)
   - Verifies subscription is active with PayPal API
   - Updates Firestore `subscriptions` doc: `plan: 'pro'`, `status: 'active'`, billing details
   - Returns updated subscription

3. **`POST /api/webhooks/paypal`** (public, no auth — PayPal calls this)
   - Handles PayPal webhook events:
     - `BILLING.SUBSCRIPTION.ACTIVATED` — activate pro
     - `BILLING.SUBSCRIPTION.CANCELLED` — set status to cancelled
     - `BILLING.SUBSCRIPTION.SUSPENDED` — payment failed, set status to expired
     - `PAYMENT.SALE.COMPLETED` — update lastPaymentDate, nextPaymentDate
   - **Verify webhook signature** using PayPal SDK to prevent spoofing
   - Update `subscriptions` doc accordingly

4. **`POST /api/admin/subscription/cancel`** (authenticated)
   - Cancels PayPal subscription via API
   - Updates Firestore doc: `status: 'cancelled'`
   - User keeps access until current period ends (`proEndDate`)

### Frontend — Payment UI

**On the blocking screen (trial expired) and optionally in settings:**

Two pricing cards:
| | Monthly | Yearly |
|---|---------|--------|
| Price | 20 ILS/month | 200 ILS/year |
| Savings | — | Save 40 ILS (17%) |

Use **PayPal JavaScript SDK** (`@paypal/react-paypal-js`) to render PayPal subscription buttons.
- Load with `intent=subscription` and the correct `plan_id`
- PayPal's button automatically handles credit card option (no extra work needed)
- On approval → call `POST /api/admin/subscription/activate`
- On success → update AuthContext subscription state → redirect to Dashboard

**In sidebar/header (during active subscription):**
- Show plan badge: "Pro" or "Trial (X days left)"
- Settings area: show current plan, next billing date, cancel option

---

## Feature 5: Trial Expiry Banner & UX

### During Trial (Days 1-7)
- Show subtle badge in sidebar: "ניסיון — X ימים נותרו" (Trial — X days left)
- On days 6-7 (last 2 days): make the badge more prominent (yellow/orange)
- Add "Upgrade to Pro" button in sidebar that opens pricing modal

### Trial Expired
- Full-screen blocking overlay (rendered by `SubscriptionGate`)
- User can still see their profile and subscription page but NOTHING else
- All API calls return 403 (backend enforcement — frontend is just UX)
- Clear messaging: "תקופת הניסיון הסתיימה" + pricing + payment

### After Payment
- Immediate access restoration
- Badge changes to "Pro"
- Show billing management in settings (next payment date, cancel option)

---

## Implementation Order (Suggested)

1. **Subscription data model** — create collection, add to types
2. **Admin profile endpoint** — `PUT /api/admin/profile`, extend `GET /api/admin/me`
3. **Self-signup endpoint** — `POST /api/admin/signup` (creates adminKeys + practitioners + subscriptions)
4. **Signup page** — new React page with form
5. **Subscription middleware** — gate all therapy routes
6. **SubscriptionGate component** — frontend blocking screen
7. **Trial badge** — sidebar countdown
8. **PayPal integration (backend)** — create subscription, activate, webhook, cancel endpoints
9. **PayPal integration (frontend)** — payment buttons on blocking screen
10. **Admin profile modal** — UI for editing name/phone/email
11. **Landing page updates** — CTAs point to `/signup`
12. **Testing** — full flow: signup → trial → expiry → payment → access restored

---

## Dev Environment

- **Test center admin:** passkey `8888` (admin name: Kosta) — use for testing the full journey
- **Super admin:** passkey `6724` (Michal, `adminId: 'michal-super-admin'`) — always exempt from billing
- **CRITICAL: The super admin account has REAL production data — real kids, real therapists, real session forms and goals. DO NOT create, modify, or delete ANY data under this account. Only use it to verify super admin exemption from billing/trial. All dev/test work must use Kosta's account (`8888`) or new self-signup accounts.**

---

## Edge Cases & Notes

- **Super admin is ALWAYS exempt** — `adminId === 'michal-super-admin'` or `isSuperAdmin === true` skips all subscription checks
- **Clock/timezone** — use server-side UTC timestamps for all trial/subscription dates, never trust client time
- **Existing `POST /api/admin/create-key`** (super admin creating admins) should also create a subscription doc with trial
- **Multiple tabs** — if user pays in one tab, other tabs should detect the change (re-fetch subscription on focus or use polling)
- **PayPal sandbox** — develop and test with PayPal sandbox credentials first, switch to live for production
- **Currency** — ILS (Israeli New Shekel), PayPal supports it
- **No free tier after trial** — there is no limited free plan, it's trial → pay or be blocked
- **Cancellation** — user keeps access until end of current billing period, then gets blocked
- **Failed recurring payment** — PayPal handles retries; after final failure, webhook fires `SUSPENDED` → we set status to expired

---

## Environment & Deployment Notes

- Server runs on port 3001, Express
- Frontend is Vite React, proxied at `/therapy`
- No `.env` file currently visible — PayPal credentials need to be added to server environment
- PayPal webhook URL will be: `https://startdoing.co.il/api/webhooks/paypal` (or whatever the production domain is)
- The PayPal JavaScript SDK is loaded client-side — add `@paypal/react-paypal-js` to therapy-center dependencies
