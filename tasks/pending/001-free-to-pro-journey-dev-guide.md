# Free-to-Pro Journey — Developer Guide

> **Task:** 001
> **For:** Developer managing AI-assisted implementation
> **Language note:** UI is Hebrew, RTL. All user-facing text should be in Hebrew.

---

## What We're Building

A complete self-service journey for new users of the "Doing" therapy center management platform:

1. **User signs up** from the landing page (new signup form)
2. **Gets 7 days free** with full access to everything
3. **After 7 days** — locked out, must pay to continue
4. **Pays via PayPal** (credit card also accepted through PayPal) — 20 ILS/month or 200 ILS/year
5. **Gets Pro access** — everything unlocked, subscription auto-renews

Plus one small product feature: **admins can edit their own profile** (name, phone, email).

---

## The Features (5 total)

### Feature A: Admin Profile Editing

**What:** Add a way for the logged-in admin to edit their own name, phone, and email.

**User flow:**
- Admin clicks their name/avatar in the sidebar
- A modal or panel opens showing their current details
- They edit and save
- The sidebar immediately reflects the updated name

**Business rules:**
- Name is required, phone and email are optional (but recommended)
- This is separate from the "change access key" feature which already exists

---

### Feature B: Self-Signup

**What:** A public registration page where anyone can create an account.

**User flow:**
1. User visits the landing page → clicks "Start for free" (התחילו בחינם)
2. Redirected to `/signup` page
3. Fills in: **name**, **phone**, **email**, **access key** (their password), **confirm access key**
4. Clicks "Create account"
5. Automatically logged in → lands on the Dashboard
6. Trial has begun (7 days)

**Business rules:**
- All fields required at signup
- Access key must be at least 4 characters
- Access key must be unique (no two admins can have the same key)
- The existing login page (`/login`) should link to signup ("Don't have an account? Sign up")
- The signup page should link to login ("Already have an account? Log in")
- Landing page CTA buttons should point to `/signup` instead of `/login`

**Current state:** Only the super admin can create center admins via a management panel. That still works, but self-signup is the primary flow going forward.

---

### Feature C: 7-Day Free Trial

**What:** Every new account gets 7 days of unrestricted access.

**User flow:**
- After signup, user sees a small badge in the sidebar: "ניסיון — 7 ימים נותרו" (Trial — 7 days left)
- Countdown decreases daily
- On last 2 days, badge becomes more prominent (warning color)
- Badge includes an "Upgrade" link
- On day 8, user is locked out (see Feature D)

**Business rules:**
- Trial starts at the moment of signup
- 7 calendar days (not business days)
- No feature restrictions during trial — everything works
- **Super admin is always exempt** — no trial, no subscription, always full access
- Trial dates calculated server-side (never trust client clock)

---

### Feature D: Paywall / Lockout Screen

**What:** After trial expires (and no payment), the user cannot use the system.

**User flow:**
1. User logs in (their access key still works)
2. Instead of the Dashboard, they see a full-screen message:
   - "תקופת הניסיון הסתיימה" (Your trial has ended)
   - Brief explanation
   - Two pricing cards (monthly / yearly)
   - PayPal payment buttons
   - WhatsApp contact link for questions
3. They cannot navigate to any other page — the paywall blocks everything
4. After paying → immediately redirected to Dashboard with full access

**Business rules:**
- Lockout is enforced on BOTH frontend (blocking screen) and backend (API returns 403)
- Even if someone bypasses the frontend, the server rejects all data requests
- The user can still access: login, their profile, subscription status, and payment page
- The user CANNOT access: kids, sessions, forms, goals, calendar, practitioners, AI — nothing

**Pricing:**

| Plan | Price | Billing |
|------|-------|---------|
| Monthly | 20 ILS/month | Auto-renews monthly |
| Yearly | 200 ILS/year | Auto-renews yearly (save 40 ILS = 17%) |

---

### Feature E: PayPal Payment

**What:** Recurring subscription payment via PayPal.

**User flow:**
1. On the paywall screen, user picks Monthly or Yearly
2. Clicks the PayPal button
3. PayPal popup opens — user can pay with:
   - PayPal account
   - Credit or debit card (no PayPal account needed)
4. User completes payment in PayPal
5. Redirected back to the app
6. App verifies payment → unlocks Pro access immediately
7. Subscription auto-renews (PayPal handles this)

**For cancellation:**
- User can cancel from a settings/billing section
- Access continues until end of current billing period
- After period ends → locked out again (back to paywall)

**If payment fails (card expired, etc.):**
- PayPal retries automatically
- If all retries fail → subscription suspended → user locked out
- User can re-subscribe from the paywall

**Business rules:**
- Currency: ILS (Israeli New Shekel)
- PayPal handles all PCI compliance and card processing
- Payment confirmation is automatic (via PayPal webhooks) — no manual approval needed
- Super admin is always exempt from payment

---

## User Journeys (End-to-End)

### Journey 1: New User — Happy Path
```
Landing Page → "Start Free" → Signup Form → Dashboard (trial active)
→ Uses system for 5 days → Decides to upgrade
→ Clicks "Upgrade" in sidebar → Picks yearly plan → PayPal payment
→ Pro activated → Continues using system
```

### Journey 2: New User — Trial Expires
```
Landing Page → Signup → Dashboard (trial active)
→ Uses system for 7 days → Day 8: logs in → Paywall screen
→ Picks monthly plan → PayPal payment → Pro activated → Dashboard
```

### Journey 3: Pro User — Cancels
```
Pro user → Settings → Cancel subscription → Confirmation
→ Keeps access until period end → Period ends → Paywall screen
→ Can re-subscribe anytime
```

### Journey 4: Super Admin
```
Login → Dashboard → Full access always → No trial, no billing, no restrictions
```

---

## Pages / Screens to Build

| Screen | Route | Auth Required | New/Modify |
|--------|-------|---------------|------------|
| Signup | `/signup` | No | **New** |
| Login | `/login` | No | Modify (add signup link) |
| Landing Page | `/` | No | Modify (CTAs → signup) |
| Dashboard | `/dashboard` | Yes | No change (wrapped by gate) |
| Paywall / Subscribe | N/A (overlay) | Yes | **New** |
| Profile Modal | N/A (modal in sidebar) | Yes | **New** |
| Billing / Subscription Info | In sidebar or settings | Yes | **New** |

---

## Data That Needs to be Stored

### Subscription Record (one per admin)
- Which admin it belongs to
- Current plan: trial or pro
- Status: active, expired, or cancelled
- Trial start and end dates
- Pro billing cycle: monthly or yearly
- Pro period start and end dates
- PayPal subscription ID (for managing the subscription)
- Payment history dates

---

## Integration Points

### PayPal
- **Sandbox first** — develop and test with PayPal sandbox environment
- **Two subscription plans** to create in PayPal dashboard:
  - Monthly: 20 ILS/month
  - Yearly: 200 ILS/year
- **Webhook** — PayPal sends events to our server when payments succeed/fail/cancel
- **PayPal JavaScript SDK** — renders the payment buttons in the frontend (npm package: `@paypal/react-paypal-js`)

### Environment Variables Needed
```
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_MONTHLY_PLAN_ID
PAYPAL_YEARLY_PLAN_ID
PAYPAL_WEBHOOK_ID
PAYPAL_MODE (sandbox / live)
```

---

## What NOT to Change

- **Login system** — keep the passcode-based login as-is, do not switch to email/password or OAuth
- **Super admin flow** — super admin can still create admins manually (and those get a trial too)
- **Existing features** — no changes to kids, goals, sessions, forms, calendar, AI, or any therapy functionality
- **Board system** — the public-facing reward boards are unaffected
- **Therapist view** — practitioners accessing via `/t/:id` links are unaffected (they use their practitioner's admin's subscription)

---

## Testing Checklist

- [ ] Can sign up from landing page with all fields
- [ ] Duplicate access key is rejected
- [ ] After signup, automatically logged in and on Dashboard
- [ ] Trial badge shows correct days remaining
- [ ] After 7 days, API returns 403 for therapy routes
- [ ] After 7 days, frontend shows paywall
- [ ] Can pay with PayPal (sandbox)
- [ ] Can pay with credit card via PayPal (sandbox)
- [ ] After payment, immediately have access
- [ ] Monthly subscription renews (test with sandbox accelerated time)
- [ ] Yearly subscription renews
- [ ] Can cancel subscription
- [ ] After cancellation, access continues until period end
- [ ] Super admin is never blocked
- [ ] Admin can edit their own name/phone/email
- [ ] Profile changes reflect immediately in sidebar
- [ ] Webhook correctly handles: activation, cancellation, suspension, payment
