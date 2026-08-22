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

## Per-Kid Mini-Games

Standalone reward games for a kid, living inside the therapy centre. **They are
independent of the board** — they never read or write `tasks`, `completedTasks`,
`totalMoney` or `dailyReward`. A game is its own reward loop: the adult in the
room gives a piece when the child succeeds at something real.

```
therapy-center/src/
├── games/
│   ├── registry.ts          # the one list of games + their settings schema
│   ├── LegoTower.tsx        # a game
│   ├── lego-tower.css
│   ├── GameSettingsSheet.tsx # settings form, built from any game's schema
│   └── useGameSound.ts      # shared synthesised sounds
├── pages/GamePage.tsx       # /kid/:kidId/game/:gameId — loads, saves, renders
└── components/GameLauncher.tsx  # hover menu in the kid's top panel
```

**Adding a game is two steps:**
1. Write the component (props: `GameComponentProps`) and add it to
   `GAME_COMPONENTS` in `GamePage.tsx`.
2. Add an entry to `GAMES` in `registry.ts`, with its `settings` schema.

The launcher menu, the settings form and the route all build themselves from
that entry.

### Where things live

| What | Where |
|------|-------|
| Which games a kid has + their settings | `kids/{kidId}.games = [{ id, enabled, config }]` |
| Play state | `kidGames/{kidId} = { [gameId]: {...} }` |

Play state sits in its own collection so gameplay never touches the kid
document's board fields. All access is server-side (Admin SDK), so no
`firestore.rules` entry is needed.

| Route | Purpose |
|-------|---------|
| `GET /api/therapy/kids/:kidId/game-state` | current play state |
| `PUT /api/therapy/kids/:kidId/game-state/:gameId` | save play state (sanitised server-side) |
| `POST /api/therapy/kids/:kidId/game-state/:gameId/reset` | clear the round, keep the tally |

Config saves through the ordinary `PUT /kids/:kidId` (`games` is on the
`updateKid` allowlist).

Each game has **its own page and URL**, so it can be opened full-screen,
bookmarked or sent to a parent — and it works in all three views
(`/kid/:kidId/game/:gameId`, `/t/:practitionerId/kid/...`, `/p/:kidId/game/...`).
Settings live on the game page behind a gear; parents get a playable game with
settings locked (`canEdit={!isParentView}`).

### lego-tower

The adult taps **+ הוסף חתיכה** when the child succeeds; the child drags the
brick onto the tower. Bricks go on **strictly bottom to top** — only the next
one is draggable, so there is always exactly one right move. Empty storeys are
drawn as brick-shaped outlines, studs and all. Finishing raises a roof, a flag
and the prize.

Bricks are plain 4-stud CSS bricks — no windows or doors, matching the printed
poster. Studs are drawn *inside* the element box (so a brick never overflows its
slot or gets clipped mid-drag) and are hidden once the next storey covers them,
the way a real stack looks. All sizing derives from the measured viewport, so
the tower fits any phone without scrolling.

The game renders through a **portal into `<body>`** and sets `body.lego-open`:
the app's page padding and any transformed ancestor in the shell would otherwise
shrink or offset a `position: fixed` full-screen game.

Config: `title`, `goal` (3–12), `prize`, `scene` (`plain` | `city`), `sound`.

---

## Running Locally

```bash
# Server (port 3001)
cd server && node index.js

# Frontend dev server (port 5173, proxies /api to 3001)
cd therapy-center && npm run dev
```

The Vite dev server proxies `/api` → `http://localhost:3001`. In production, Express serves the built frontend statically.
