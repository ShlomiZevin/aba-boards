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

## Daily Agenda (סדר יום)

A per-kid day plan — what happens in the morning (בוקר), afternoon (צהריים)
and evening (ערב). Built for a family to sit down, usually the evening before,
and lay out tomorrow together. **Independent of the board**: ticking an item
off is only a convenience for following the day — no coins, no rewards, no
board fields are touched.

```
server/
├── services/therapy.js    # getKidAgenda / saveKidAgendaRoutine / saveKidAgendaDay / setKidAgendaItemDone
└── routes/therapy.js      # /kids/:kidId/agenda/*

therapy-center/src/
├── pages/AgendaPage.tsx                      # the page (week grid ≥900px, one day on phones)
├── components/agenda/AgendaItemSheet.tsx     # add / edit one activity
├── components/agenda/agenda.css              # its own look, all classes `ag-`
└── utils/agenda.ts                           # periods, date helpers, suggestions, starter routine
```

**Routine vs. days.** The weekly routine (שגרה קבועה) is the usual week. A date
with no saved plan simply shows its weekday's routine; editing a date saves a
plan for that date only (a purple dot marks it). A day can go back to the
routine, copy the previous day, or become the routine for its weekday.

| Where | What |
|-------|------|
| `kidAgendas/{kidId}` | `{ routine: { '0'..'6': { morning, noon, evening } } }` (0 = Sunday) |
| `kidAgendas/{kidId}/days/{YYYY-MM-DD}` | `{ items: DayPlan \| null, done: string[] }` — `items: null` → follows routine |

Items are `{ id, title, icon (emoji), time? }`, sanitised server-side (max 15
per period). `done` holds item ids and is updated with `arrayUnion` /
`arrayRemove`, so a child ticking on a tablet never races a parent on a phone.

| Route | Purpose |
|-------|---------|
| `GET /api/therapy/kids/:kidId/agenda?from=&to=` | routine + saved days in range (≤ 42 days) |
| `PUT /api/therapy/kids/:kidId/agenda/routine` | replace the routine |
| `PUT /api/therapy/kids/:kidId/agenda/days/:date` | save a day's plan (`items: null` → back to routine) |
| `PUT /api/therapy/kids/:kidId/agenda/days/:date/done` | `{ itemId, done }` |

**Everyone edits** — admin, therapist and parent. Parents are locked to their
own kid, therapists to kids they're linked to, admins to their own kids.

**Routes:** `/kid/:kidId/agenda`, `/t/:practitionerId/kid/:kidId/agenda`,
`/p/:kidId/agenda`. The page renders outside `AppShell` / `TherapistShell` and
sets `body.agenda-open` to drop the app's body padding and gradient. Entry point:
a "📅 סדר יום" button in the kid's top panel, shown in all three views.

---

## Treatment Agreement (הסכם טיפול)

A single signable agreement per kid, signed by the centre admin and by each
registered parent. It exists so that ending a treatment is a pre-agreed,
orderly event: either side may terminate on **two weeks' written notice**.

```
server/
├── services/therapy.js    # getAgreement / saveAgreement / signAgreement / deleteAgreement
└── routes/therapy.js      # /kids/:kidId/agreement  (+ /sign)

therapy-center/src/
├── pages/AgreementPage.tsx        # the whole feature's UI (admin + parent)
├── components/SignaturePad.tsx    # pointer-event canvas, PNG data URL out
└── utils/agreementTemplate.ts     # default Hebrew text + placeholder filling
```

**Two rules the server enforces** (the UI only mirrors them):

1. **The text freezes on first signature.** `saveAgreement` returns 409 once any
   signature exists — nobody can change what was already agreed to.
2. **Signatures are never removed.** A signer may re-draw their own signature
   (`revision` increments, the original `signedAt` is kept), but no route
   deletes one. An unsigned agreement may be deleted; a signed one may not.

| Where | What |
|-------|------|
| `agreements/{kidId}` | the document, plus `signatures` keyed `admin:<adminId>` / `parent:<parentId>` |

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/therapy/kids/:kidId/agreement` | admin / parent | fetch; parents get `null` for a draft |
| `PUT /api/therapy/kids/:kidId/agreement` | admin | create or edit while unsigned |
| `POST /api/therapy/kids/:kidId/agreement/sign` | admin / parent | add or replace own signature |
| `DELETE /api/therapy/kids/:kidId/agreement` | admin | only while unsigned |

**Status flow:** `draft` (admin still writing, parents see nothing) →
`active` (open for signing) → signed (text locked).

**Who signs what.** The signer is resolved from the auth headers, never from
the request body, so a parent link cannot sign on the centre's behalf. The
admin signs the `admin:` slot. A parent picks which of the kid's registered
parents they are (auto-selected when only one is on record) and the server
checks that `parentId` is actually one of that kid's parents. Note this inherits
the app's existing trust model: `/p/:kidId` is itself the credential, so anyone
holding the family's link can sign as any parent on that kid.

**Routes:** admin `/kid/:kidId/agreement`, parents `/p/:kidId/agreement`.
Entry points are a card in the kid's סקירה tab and, for parents with a
signature outstanding, a banner at the top of the kid page.

**The default text** is generated by `buildDefaultAgreement()` from the details
the centre already holds (child, parents, centre name and contact), so in the
common case the admin types nothing. It is a general-purpose Israeli service
agreement — a sensible default, not legal advice. Placeholders are
`{{CENTER}}`, `{{CONTACT_CLAUSE}}`, `{{PARENTS}}`, `{{CHILD}}`,
`{{START_DATE}}`, `{{NOTICE_WEEKS}}`.

---

## Running Locally

```bash
# Server (port 3001)
cd server && node index.js

# Frontend dev server (port 5173, proxies /api to 3001)
cd therapy-center && npm run dev
```

The Vite dev server proxies `/api` → `http://localhost:3001`. In production, Express serves the built frontend statically.
