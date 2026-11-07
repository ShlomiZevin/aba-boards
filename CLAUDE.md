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

## Daily Report (דיווח יומי)

The school/therapy day report that replaces the centre's paper form. One
document per kid per date, holding lists of lessons, breaks and ABC events.

```
server/services/therapy.js     # listDailyReports / getDailyReport / saveDailyReportMeta / save|deleteDailyReportItem
server/routes/therapy.js       # /kids/:kidId/daily-reports/*

therapy-center/src/
├── pages/DailyReportsPage.tsx              # history → one day → one item (its own nested routes)
├── components/daily-report/forms.tsx       # LessonForm / BreakForm / AbcForm
├── components/daily-report/controls.tsx    # MarkField (+/−/ר), Chips, PercentSlider, YesNo…
├── components/daily-report/daily-report.css  # classes prefixed `dr-`
└── utils/dailyReport.ts                    # option lists and labels, worded like the paper
```

| Where | What |
|-------|------|
| `kidDailyReports/{kidId}/reports/{YYYY-MM-DD}` | `{ date, reporter, lessons[], breaks[], abc[] }` |

**Item shapes belong to the UI** (`LessonReport`, `BreakReport`, `AbcReport` in
`types/index.ts`). The server does not know the fields — it only enforces a
bounded, plain-data shape (`sanitizeReportValue`), so adding a field (as with
`cooperationPct`, the 0–100 slider beside the lesson smiley) needs no server change.

**Keep every field the paper has.** The form may add to the paper, never drop
from it; `MarkField` is the paper's cell ("+" did it right away, "−" didn't and
what help was given, "ר").

**Access:** admins and therapists write; parents read their own kid's reports
(`reportHandler(..., { write: true })` rejects parent writes). Routes:
`/kid/:kidId/daily-reports`, `/t/:practitionerId/kid/:kidId/daily-reports`,
`/p/:kidId/daily-reports`, each with `/:date` and `/:date/:kind/:itemId`.

**AI chat:** `get_daily_reports` (in `server/services/chat-center.js`) reads a
date range of reports for the chat, rendering the paper marks in words and
adding period totals (average lesson cooperation, moods, ABC behaviour counts).
Its sibling `get_daily_agenda` reads the day plan (סדר יום). Both are
read-only and open to admins, linked therapists and the kid's own parents,
under the chat's usual per-role kid scoping.

---

## Email Notifications

`server/services/email.js` sends mail through Google SMTP as `SMTP_USER`, using a
Google **app password** in `SMTP_PASS`. Without both it logs and skips.

Today it has one use: when a session form is submitted (`POST /forms`), the
centre's manager gets a mail with the kid, the therapist, the date and links to
the form and the kid page. It goes by **whose form it is, not who is logged
in** — the manager often files a form on a therapist's behalf. Only a form
recorded as the manager's own (`practitionerId === kid.adminId`) is skipped.
Every skip logs its reason as `[email] … skipped: …`.

Its second use: **a new daily report.** A report fills in through the day, so
the manager is mailed **once per kid per day**, when that day's report is first
created (by a meta or item save), with a link to the live report. The
"already sent" mark is `notifiedAt` on the report document, claimed in a
transaction (`claimDailyReportNotification`) so concurrent saves can't both
send; if the send fails the claim is released and the next save retries.

- **No clinical content in the mail** — names, date and links only; the form
  stays behind login.
- **Never blocks the form.** The send is awaited (Cloud Run may freeze a
  fire-and-forget send once the response is out) but capped at 8s, and every
  failure is logged and swallowed.
- **Recipient:** `FORM_NOTIFY_TO`, and only for kids of `michal-super-admin` —
  other centres get no mail (`formNotifyRecipient`).
- `deploy.sh` passes env vars with `--set-env-vars`, which *replaces* the whole
  set: a new variable must be added to that line or it never reaches Cloud Run.

---

## Treatment Agreement (הסכם טיפול)

A single signable agreement per kid, signed by the behaviour analyst and by
each registered parent. It exists so that ending a treatment is a pre-agreed,
orderly event: either side may terminate on **two weeks' written notice**.

**There is no "centre".** The professional party is one behaviour analyst
(מנתח/ת התנהגות) — a person, not an organisation, with no staff. The
therapists (מטפלות) around a child belong to the child's environment, not to
the analyst, so the document never presents them as her team or makes her
answerable for them. Keep that framing in any future edit to the wording:
nothing in the agreement should say המרכז or הצוות.

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
3. **Therapists are not party to it.** `assertAgreementAccess` rejects
   `authType === 'therapist'` on both read and sign, and the kid page hides the
   card and skips the query in therapist view. Only parents and the analyst.

| Where | What |
|-------|------|
| `agreements/{kidId}` | the document, plus `signatures` keyed `admin:<adminId>` / `parent:<parentId>` |

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/therapy/kids/:kidId/agreement` | admin / parent (**not therapist**) | fetch; parents get `null` for a draft |
| `PUT /api/therapy/kids/:kidId/agreement` | admin | create or edit while unsigned |
| `POST /api/therapy/kids/:kidId/agreement/sign` | admin / parent | add or replace own signature |
| `DELETE /api/therapy/kids/:kidId/agreement` | admin | only while unsigned |
| `POST /api/therapy/kids/:kidId/agreement/email-parents` | admin (own centre) | email each unsigned parent with an email their `/p/:kidId/agreement` link |

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

**Getting it to the parents.** Once the agreement is sent for signing, the
admin can email the parents (each unsigned parent with an email on record gets
their family link; replies go to the admin's own email; send times are kept in
`parentEmails`), copy the link, or share it on WhatsApp. The link needs no
login — `/p/:kidId` is the credential.

**A parent not on record** (reached through a shared link) signs as "השם שלי לא
ברשימה": the full name they type registers them as the kid's parent
(`newParentName` on `/sign`; capped at 4 parents per kid, same name reuses the
same parent).

**Mail on signing.** When a parent signs, the centre's manager is mailed with a
link to the agreement (Michal's centre only — see Email Notifications).

**The name box must start empty.** The signing modal's confirm button needs a
typed name; a placeholder showing the signer's own name looked already filled
and left signers stuck, so the placeholder is neutral and a hint says what is
missing.

**The default text** is generated by `buildDefaultAgreement()` from details
already on record (child, parents, analyst name and contact), so in the common
case nothing is typed. It is a general-purpose Israeli service agreement — a
sensible default, not legal advice. Placeholders: `{{ANALYST}}`,
`{{ANALYST_ROLE}}`, `{{CONTACT_CLAUSE}}`, `{{PARENTS}}`, `{{CHILD}}`,
`{{START_VERB}}`, `{{START_DATE}}`, `{{NOTICE_WEEKS}}`.

`{{START_VERB}}` resolves to החל ביום for a start date already past and
יחל ביום for one still ahead — these agreements are often signed after the
work began. `{{ANALYST_ROLE}}` comes from the agreement's `adminRole` field,
which the analyst edits in the form (default
מדריכת הורים ומנתחת התנהגות) and which the signing route copies onto
the signature, so the stored record matches the document that was read.

While the wording is still the untouched default, changing the date, role or
notice period regenerates it; once edited by hand it is never overwritten.

The Hebrew prose is drafted with `gpt-5.6-sol` rather than written directly —
see the `hebrew-copy-via-gpt` memory.

---

## AI Chat History

Every chat turn is saved server-side in `chatConversations/{id}` (`server/services/chat-history.js`),
so nothing depends on the browser. The UI is a drawer in `ChatCenter.tsx` (`components/ChatHistoryPanel.tsx`).

- **Owner comes from the auth headers**: admin → `adminId`, therapist → `practitionerId`, parent → `kidId`
  (both parents share the family link, so they share one history).
- **Everyone sees only their own** conversations — including other centre admins. The **super admin
  (Michal)** can also list (`?scope=all`) and read everyone's, filtered by role; she cannot post into
  or continue someone else's conversation (403). Therapists and parents see a one-line notice that
  chats are kept 14 days and are visible to the system manager.
- **Retention: 14 days from the last message.** `expiresAt` is pushed forward on every turn; a Firestore
  TTL policy on `chatConversations.expiresAt` deletes them (it can lag ~24h, so reads also filter
  expired docs). Re-create with
  `gcloud firestore fields ttls update expiresAt --collection-group=chatConversations --enable-ttl --project=aba-ai-d74f5`.
- Messages are embedded in the document; the oldest are trimmed past ~900KB. Image generations
  (super admin) are saved too.

| Route | Purpose |
|-------|---------|
| `POST /api/therapy/chat` | now takes `conversationId`; `done` event / JSON returns `conversationId` |
| `GET /api/therapy/chat/conversations[?scope=all]` | list (summaries, no messages) |
| `GET /api/therapy/chat/conversations/:id` | one conversation with messages (`isMine` false = read-only) |
| `DELETE /api/therapy/chat/conversations/:id` | owner or super admin |

---

## MCP Server (ChatGPT / Claude connectors)

The same data tools as the AI chat, exposed over MCP so a user can connect their own ChatGPT, Claude
or other MCP client.

**Currently Michal (super admin) only** — `SUPER_ADMIN_ONLY` in `services/mcp-auth.js`, enforced at
sign-in, on refresh and on every call. Everything below about therapists and parents is ready but
switched off; flip the flag to open it. The how-to-connect page is `/therapy/mcp-connect` in the
redesigned app (`therapy-center-v2`, admin nav "חיבור לעוזרי AI"), shown only to the super admin.

- **URL:** `https://avatar-server-1018338671074.me-west1.run.app/mcp` (Streamable HTTP, stateless,
  JSON responses — `routes/mcp.js`, hand-written JSON-RPC, no SDK dependency).
- **Auth: OAuth 2.1** with dynamic client registration and PKCE (`services/mcp-auth.js`). The sign-in
  page (`/oauth/authorize`) takes the person's normal site credential: an admin access code, a
  therapist link (`/t/<id>`) or a parent link (`/p/<kidId>`). The token stores that identity and it is
  re-checked on every call (deactivated code / deleted practitioner → cut off).
- **Same scoping as the site chat:** tools come from `toolsForRole()` and run through
  `executeToolCall` (`chat-center.js`). Parents default to their own kid. On top of that, a non-super
  admin can't reach another centre's kid by raw ID (`adminMayAccess`). Extra `search` / `fetch` tools
  for OpenAI connectors.
- Tokens: access 24h, refresh 90 days (rotated). Stored only as sha256 in `mcpTokens`,
  `mcpAuthCodes`; clients in `mcpClients`. TTL policies on `expiresAt` for both token collections.
- Failed sign-ins are rate-limited per IP (8 per 15 min) — admin codes are short.
- Discovery: `/.well-known/oauth-protected-resource[/mcp]`, `/.well-known/oauth-authorization-server`.

---

## Documents (מסמכים / מחברת)

Free markdown documents, per kid or general for the centre (`kidId: null`): meeting prep, guidance,
notes. Written in the app, or sent in from ChatGPT / Claude through the MCP (`save_document`,
`update_document` with replace/append, `list_documents`, `get_document`). Separate from `summaries`
(periodic summaries keep their own flow).

| Where | What |
|-------|------|
| `docs/{id}` | `{ kidId\|null, adminId, type, title, content, visibility, source, createdBy, createdAt, updatedAt }` |

- `type`: `meeting-prep` · `guidance` · `note` · `summary` · `other`. `source`: `chatgpt` · `claude` · `mcp` · `app` · `site-chat`.
- **Visibility is enforced in `services/docs.js`**: `private` (default — the centre's admins only),
  `team` (+ the kid's linked therapists, read-only), `parents` (+ the kid's parents, read-only).
  A doc the caller may not see answers 404. Only admins write; other centres can't reach it.

| Route | Purpose |
|-------|---------|
| `GET /api/therapy/kids/:kidId/docs` | the kid's docs visible to the caller, newest first |
| `GET /api/therapy/docs?scope=general` | the centre's general docs (not for parents) |
| `GET /api/therapy/docs/:id` | one doc |
| `POST /api/therapy/docs` · `PUT /docs/:id` · `DELETE /docs/:id` | admin only |

UI (in `therapy-center-v2`): a "מחברת" tab on the kid page and "מסמכים כלליים"; a doc opens at
`/docs/:id` (`/t/:practitionerId/docs/:id`, `/p/:kidId/docs/:id`) — the links the MCP returns.

---

## Build Models (מודלים לבנייה) — all users

Step-by-step Lego / magnet / ironing-bead (`type: "beads"`, 2D pegboard pattern) guides, produced by a separate Claude session ("ABBA") in
`../reports/nevo-models/` (`<id>/index.html` self-contained 3D guide, `<id>/thumb.png`,
`concepts/`, `models-manifest.json`; `_src/` is build source and is never served). **Don't edit the
model pages** — they are regenerated from `_src`.

- Page in all three views: `/models` (admin sidebar), `/t/:practitionerId/models` (therapist sidebar),
  `/p/:kidId/models` (button in the parent's kid header) — `pages/BuildModels.tsx`. Grid from the
  manifest (filter Lego / magnets), opens a model full-screen in a new tab (made for the child's tablet).
- `MODELS_BASE` in `api/client.ts`: dev → `/api/nevo-models` (Express serves the folder live, blocks
  `_src`); prod → `/build-models-n7q4` on Firebase Hosting, copied by `deploy.js` on every deploy.
  **New models reach production only with a hosting deploy.** The URLs are public but unlisted.
- Each model's 🏠 link goes to `../index.html`, which returns to the models page saved in
  `localStorage.models_home` (set by `BuildModels`, so each view gets back to its own page).

---

## Running Locally

```bash
# Server (port 3001)
cd server && node index.js

# Frontend dev server (port 5173, proxies /api to 3001)
cd therapy-center && npm run dev
```

The Vite dev server proxies `/api` → `http://localhost:3001`. In production, Express serves the built frontend statically.
