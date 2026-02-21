# Goal Library Manager — Implementation Plan

## Context
The `goalsLibrary` Firestore collection grows unboundedly — every unique goal title+category ever created gets added automatically. Admins need a way to review and prune it. The library can be large so the UI must have fast search and category filtering without extra API round-trips.

---

## Current State (read-only)

| Item | Detail |
|------|--------|
| Collection | `goalsLibrary` |
| Fields | `id`, `title`, `categoryId`, `usageCount` |
| Existing search route | `GET /goals/library?search=` (min 3 chars, top 100 by usageCount, in-memory filter) |
| Existing API method | `goalsApi.searchLibrary(search)` |
| No delete exists | Neither route nor service function |

---

## New API — add to `server/routes/therapy.js`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/goals/library/all` | `requireAdmin` | Load full library (for management UI) |
| `DELETE` | `/goals/library/:id` | `requireAdmin` | Delete a library entry |

### GET /goals/library/all
Returns all `goalsLibrary` docs ordered by `usageCount` desc. No search param — filtering is done client-side so the UI stays instant.
Cap at 1000 docs (Firestore limit per query; the library is unlikely to exceed this).

### DELETE /goals/library/:id
Deletes the single doc. Does **not** affect any existing kid goals — those are in the `goals` collection and are independent.

---

## New Service Functions — `server/services/therapy.js`

```js
getAllGoalsLibrary()          // db.collection('goalsLibrary').orderBy('usageCount','desc').limit(1000).get()
deleteGoalLibraryItem(id)     // db.collection('goalsLibrary').doc(id).delete()
```

---

## New API Client method — `src/api/client.ts`

Add to `goalsApi`:
```ts
getAllLibrary: () =>
  fetchApi<GoalLibraryItem[]>('/goals/library/all'),
deleteLibraryItem: (id: string) =>
  fetchApi<void>(`/goals/library/${id}`, { method: 'DELETE' }),
```

---

## Frontend — New Page `src/pages/GoalLibraryManager.tsx`

Admin-only page. Route: `/goal-library` (add to `App.tsx` inside `AuthGuard`).
Linked from `GoalsPage.tsx` header (admin-only button: "ניהול ספריית מטרות").

### Layout

**Mobile (single column):**
```
[ Search input                    ]
[ Category filter chips: הכל | מוטוריקה גסה | ... ]
[ List of results — card per item ]
```

**Desktop (same layout, wider container, table instead of cards):**
```
[ Search input              ] [ Category filter chips         ]
┌──────────────────────────────────────────────────────────┐
│ קטגוריה    │ מטרה                    │ שימושים │  פעולה  │
├──────────────────────────────────────────────────────────┤
│ שפה/תקשורת │ לזהות צבעים             │   12    │  [מחק]  │
│ קוגנטיבי   │ להתאים צורות            │    3    │  [מחק]  │
└──────────────────────────────────────────────────────────┘
```

### Behavior

- **Load once:** On mount, fetch `goalsApi.getAllLibrary()`. All filtering/search is in-memory — no extra API calls.
- **Search:** Controlled text input, filters `item.title.toLowerCase().includes(query)` in real time.
- **Category filter:** Chip row — "הכל" + one chip per `GOAL_CATEGORIES`. Click to toggle filter. Combined with search.
- **Sort:** By `usageCount` desc (already from server). Add a "לפי שם" toggle for alpha sort.
- **Delete:** Each row has a "מחק" button. Click → inline confirmation ("בטוח? כן / לא") replaces the button — no modal needed. On confirm → `goalsApi.deleteLibraryItem(id)` → remove from local list (optimistic, no refetch needed).
- **Empty state:** "לא נמצאו מטרות" when search/filter yields nothing.
- **Loading:** Spinner while initial fetch runs.
- **Count display:** Header shows "N מטרות בספרייה" (total, not filtered count).

### No pagination needed
Even at 500+ items, the list renders fine in a virtualized-feeling way if we cap display at the filtered results. If the library exceeds ~500 items this can be revisited.

---

## Route Addition — `src/App.tsx`

```tsx
<Route path="/goal-library" element={<AuthGuard><GoalLibraryManager /></AuthGuard>} />
```

---

## Entry Point — `src/pages/GoalsPage.tsx`

Add an "ניהול ספרייה" button in the page header (admin-only, next to existing controls):
```tsx
{!isTherapistView && (
  <Link to="/goal-library" className="btn-secondary btn-small">ניהול ספרייה</Link>
)}
```

---

## Files to Change

| File | Change |
|------|--------|
| `server/routes/therapy.js` | +2 routes (GET all, DELETE by id) |
| `server/services/therapy.js` | +2 functions (getAllGoalsLibrary, deleteGoalLibraryItem) |
| `src/api/client.ts` | +2 methods to `goalsApi` |
| `src/pages/GoalLibraryManager.tsx` | **New file** — full management UI |
| `src/App.tsx` | +1 route |
| `src/pages/GoalsPage.tsx` | +1 link button (admin-only) |

---

## Verification Checklist

- [ ] Admin opens GoalsPage → sees "ניהול ספרייה" button → clicks → lands on `/goal-library`
- [ ] Page loads all items, shows count in header
- [ ] Type 3+ chars in search → list filters instantly, no API call
- [ ] Click a category chip → filters by that category, combined with any active search text
- [ ] Click "מחק" → inline confirm appears → confirm → item removed from list, gone on next search in GoalsTab autocomplete
- [ ] Therapist visiting `/goal-library` → redirected to login (AuthGuard)
- [ ] Library with 0 results after filter → shows empty state message
