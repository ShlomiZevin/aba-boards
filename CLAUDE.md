# ABA Boards — Therapy Center

## What This Is

A Hebrew-language (RTL, Israeli) web platform for ABA (Applied Behavior Analysis) therapy centers. It has two parts that share a single Firestore database:

1. **Board system** (`board.html`, `board-builder.html`, `stats.html`) — parent/child-facing reward boards. Kids earn coins by completing tasks; parents track progress.
2. **Therapy center** (`therapy-center/`) — practitioner-facing management app. Admins and therapists manage kids, goals, sessions, and session forms.

Both parts read from and write to the same `kids` Firestore collection.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| State / data fetching | TanStack Query (React Query) |
| Routing | React Router v6 |
| Backend | Node.js + Express |
| Database | Firestore (Firebase Admin SDK on server) |
| UI | Inline styles + custom CSS (`index.css`) — no UI library |
| Rich text | Tiptap (inside `RichTextEditor.tsx`) |
| Calendar | react-big-calendar |
| Date utils | date-fns |

---

## Project Structure

```
aba-boards/
├── server/                        # Express API server (port 3001)
│   ├── index.js                   # Entry point, mounts routes
│   ├── middleware/auth.js         # Passkey auth → sets req.adminId
│   ├── routes/
│   │   ├── therapy.js             # All therapy-center API routes
│   │   └── admin.js               # Admin management routes
│   └── services/
│       ├── firebase.js            # Firestore db instance
│       └── therapy.js             # All Firestore CRUD logic
│
├── therapy-center/src/            # Vite React app (proxied at /therapy)
│   ├── api/client.ts              # All fetch calls; exports *Api objects
│   ├── types/index.ts             # All shared TypeScript types
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Admin passkey auth state
│   │   └── TherapistContext.tsx   # Therapist view state (practitionerId)
│   ├── hooks/
│   │   └── useTherapistLinks.ts   # Route helpers with /t/:id prefix
│   ├── pages/
│   │   ├── Dashboard.tsx          # Kids list + admin panel
│   │   ├── KidDetail.tsx          # Per-kid: calendar, goals, sessions, forms
│   │   ├── GoalsPage.tsx          # Goals management (admin)
│   │   ├── FormFill.tsx           # Therapy session form (fill/edit)
│   │   ├── FormView.tsx           # Therapy session form (read-only)
│   │   ├── MeetingFormFill.tsx    # Meeting form (fill/edit, admin only)
│   │   ├── MeetingFormView.tsx    # Meeting form (read-only)
│   │   ├── AllPractitioners.tsx   # Practitioners list
│   │   ├── ParentView.tsx         # Read-only parent portal (no auth)
│   │   └── Login.tsx              # Passkey login page
│   └── components/
│       ├── GoalsTab.tsx           # Goals tab inside KidDetail
│       ├── FormsTab.tsx           # Forms tab inside KidDetail
│       ├── SessionsTab.tsx        # Sessions tab inside KidDetail
│       ├── TeamTab.tsx            # Team tab inside KidDetail
│       ├── RichTextEditor.tsx     # Tiptap wrapper (editing)
│       ├── FormTemplateEditor.tsx # Drag-to-reorder form template config
│       ├── GoalsWeeklyTable.tsx   # Weekly goals progress table
│       └── ImageCropModal.tsx     # Canvas-based avatar crop (200×200px)
│
├── board.html                     # Parent/child reward board
├── board-builder.html             # Admin board builder
└── stats.html                     # Kid statistics
```

---

## Authentication

**Passkey-based** (not Firebase Auth). Each admin has a secret key stored in Firestore `adminKeys` collection.

- Frontend stores key in `localStorage` as `admin_key`
- Every API request sends `X-Admin-Key: <key>` header
- `server/middleware/auth.js` looks up key → sets `req.adminId` and `req.isSuperAdmin`
- `AuthContext.tsx` holds `{ user, isLoading }` — `user` is `null` until key validated
- Routes without a valid key get `401`

**Super admin key:** `6724` → `adminId: 'michal-super-admin'`. Can create/delete other center admins.

**Therapist view:** Practitioners access via `/t/:practitionerId/*` URLs. No passkey — these links are shared directly. `TherapistContext` detects the prefix and sets `isTherapistView = true`.

---

## Data Model (Firestore Collections)

| Collection | Purpose |
|-----------|---------|
| `kids` | Core kid document. Also holds board state: `totalMoney`, `tasks[]`, `completedTasks[]` (today's regular task IDs), `completedBonusTasks[]` (today's bonus task IDs), `dailyReward` |
| `adminKeys` | `{ key, adminId, name, isSuperAdmin, active }` — auth lookup |
| `practitioners` | `{ name, type, mobile, email, isSuperAdmin, adminId }` |
| `kidPractitioners` | `{ kidId, practitionerId, role, addedAt, addedBy }` |
| `parents` | `{ kidId, name, mobile, email }` |
| `sessions` | `{ kidId, therapistId, scheduledDate, type, status, formId }` |
| `sessionForms` | Therapy session forms (rich text + goals worked on) |
| `meetingForms` | Team meeting forms (attendees + 7 structured text fields) |
| `goalLibrary` | Shared goal title suggestions |
| `goals/{adminId}/items` | Per-admin kid goals |
| `formTemplates` | Per-kid customizable session form section order |

**Data isolation:** Every admin's kids are filtered by `adminId` field. Super admin's `adminId` is `'michal-super-admin'`.

---

## Session Types

```ts
type SessionType = 'therapy' | 'meeting';
```

- **therapy** — individual child therapy session. Filled by assigned therapist. Form stored in `sessionForms`.
- **meeting** — team/parent meeting. Admin-only fill. Form stored in `meetingForms`. Shown in purple on calendar.

Sessions can be scheduled as **recurring** (weekly, until a date) via `sessionsApi.scheduleRecurring()`.

---

## Form System

**Therapy forms** (`SessionForm`) have a customizable template (`FormTemplate`). Default sections: cooperation (%), session duration, sitting duration, mood, concentration, reinforcers, words produced, break activities, end-of-session activity, successes, difficulties, notes. Admins can add/remove/reorder sections per kid via `FormTemplateEditor`.

**Meeting forms** (`MeetingForm`) have fixed fields: attendees (practitioners + parents multi-select), generalNotes, behaviorNotes, adl, grossMotorPrograms, programsOutsideRoom, learningProgramsInRoom, tasks.

---

## Key Patterns

**API calls** — all in `therapy-center/src/api/client.ts`. Uses a single `fetchApi` wrapper that auto-attaches `X-Admin-Key` and `Content-Type`. Returns `{ success, data?, error? }` — never throws. React Query is used everywhere; don't call APIs outside query/mutation functions.

**Date handling** — Firestore Timestamps come back as objects with `.seconds`. Always pass dates through `toDate()` from `utils/date.ts` before using with date-fns.

**RTL** — the UI is Hebrew and right-to-left. `direction: 'rtl'` is set on the root container. All new UI should follow RTL conventions (right = start, left = end).

**Avatar images** — stored as base64 data URLs in `kid.imageName`. When rendering:
```ts
const avatarUrl = kid.imageName
  ? (kid.imageName.startsWith('data:') ? kid.imageName : `${BASE}${kid.imageName}`)
  : DEFAULT_AVATAR;
```

**Therapist links** — always use `useTherapistLinks()` hook for navigation. It automatically prefixes routes with `/t/:practitionerId` when in therapist view.

**Board data on Kid** — the `kids` Firestore document is shared with the board app. Fields like `totalMoney`, `tasks`, `completedTasks`, `completedBonusTasks` live on the same document. `completedTasks` and `completedBonusTasks` are arrays of task IDs (numbers) representing what was completed *today* (reset daily by the board).

---

## Running Locally

```bash
# Server (port 3001)
cd server && node index.js

# Frontend dev server (port 5173, proxies /api to 3001)
cd therapy-center && npm run dev
```

The Vite dev server proxies `/api` → `http://localhost:3001`. In production, Express serves the built frontend statically.
