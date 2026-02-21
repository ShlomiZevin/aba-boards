# Notification Center — Implementation Plan

## What It Does
Admin sends targeted messages to practitioners or parents of a specific kid (e.g. "bring extra clothes tomorrow"). Recipients see them in their view and mark them as read. Polling-based — no WebSockets. All notifications are kid-scoped.

---

## Firestore — `notifications` Collection

```js
{
  id: auto,
  kidId: string,           // which kid this is about
  adminId: string,         // data isolation
  message: string,
  createdAt: Timestamp,
  recipientType: 'practitioner' | 'parent',
  recipientId: string,     // practitionerId  OR  kidId
                           // (parents all share the same /p/:kidId link — no individual auth)
  recipientName: string,   // display label for admin sent-log
  read: boolean,
  readAt: Timestamp | null,
}
```

**Fan-out:** Admin sends one request with a `targets[]` array. Server creates one Firestore doc per target in a batch write.

| Targeting | What gets created |
|-----------|------------------|
| All practitioners | One doc per practitioner linked to the kid |
| Specific practitioner | One doc (`recipientId = practitionerId`) |
| All parents | One doc (`recipientId = kidId`, name = `'כל ההורים'`) |
| Specific parent | One doc (`recipientId = kidId`, name = parent name) — display only, all parents share the link |

---

## API Routes — `server/routes/therapy.js`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/notifications` | admin only | Create (fan-out per target) |
| `GET` | `/notifications/mine` | practitioner or parent | Fetch own notifications |
| `GET` | `/notifications/sent?kidId=` | admin only | Admin sent log for a kid |
| `PUT` | `/notifications/:id/read` | practitioner or parent | Mark as read |
| `DELETE` | `/notifications/:id` | admin only | Delete |

**POST body:**
```json
{
  "kidId": "...",
  "message": "...",
  "targets": [
    { "type": "practitioner", "id": "pract-uuid", "name": "שם המטפלת" },
    { "type": "parent",       "id": "kid123",     "name": "שם ההורה" }
  ]
}
```

**GET /mine query logic (server):**
```js
if (req.authType === 'therapist')
  → where('recipientType','==','practitioner').where('recipientId','==',req.practitionerId)
else if (req.authType === 'parent')
  → where('recipientType','==','parent').where('recipientId','==',req.kidViewId)
// order by createdAt desc
```

**PUT /read guard:** Verify doc's `recipientId` matches the caller's practitionerId or kidViewId before updating.

---

## Service Functions — `server/services/therapy.js`

```js
createNotifications(kidId, adminId, message, targets)    // batch write
getMyNotifications(recipientType, recipientId)            // ordered by createdAt desc
getSentNotifications(kidId, adminId)                      // ordered by createdAt desc
markNotificationRead(notificationId, recipientType, recipientId)
deleteNotification(notificationId, adminId)
```

---

## TypeScript — `src/types/index.ts`

```ts
export interface Notification {
  id: string;
  kidId: string;
  adminId: string;
  message: string;
  createdAt: Date;
  recipientType: 'practitioner' | 'parent';
  recipientId: string;
  recipientName: string;
  read: boolean;
  readAt?: Date;
}
```

---

## API Client — `src/api/client.ts`

```ts
export const notificationsApi = {
  send: (data: { kidId: string; message: string; targets: { type: string; id: string; name: string }[] }) =>
    fetchApi<void>('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  getMine: () => fetchApi<Notification[]>('/notifications/mine'),
  getSent:  (kidId: string) => fetchApi<Notification[]>(`/notifications/sent?kidId=${kidId}`),
  markRead: (id: string) => fetchApi<void>(`/notifications/${id}/read`, { method: 'PUT' }),
  delete:   (id: string) => fetchApi<void>(`/notifications/${id}`, { method: 'DELETE' }),
};
```

---

## Frontend — 3 Touch Points

### 1. `KidDetail.tsx` — Admin creates & views (admin-only section)

New **"התראות"** card below the sessions columns.

**Sent log:**
- Each row: recipient chip (purple = practitioner, green = parent) + message + date + read/unread badge + delete button

**"שלח הודעה" button** → compose modal:
- Textarea for message
- Recipient picker:
  - Row 1: **"כל המטפלות"** toggle + individual practitioner chips (purple, each toggleable)
  - Row 2: **"כל ההורים"** toggle + individual parent chips (green, each toggleable)
- Send → `notificationsApi.send()` → invalidate sent query → close modal

### 2. `Dashboard.tsx` — Therapist sees notifications (therapist view only)

- Fetch `notificationsApi.getMine()` with `refetchInterval: 60_000`
- Bell 🔔 button in header → red badge showing unread count (hidden if 0)
- Click → modal: unread first (bold), read below in muted style
- Each row: message + date + **"סמן כנקרא"** button → `markRead()` → invalidate

### 3. `ParentView.tsx` — Parents see notifications

- Fetch `notificationsApi.getMine()` with `refetchInterval: 60_000`
- **"הודעות מהצוות"** card at top (hidden if no notifications)
- Unread: light yellow background; read: muted
- Each row: message + date + **"סמן כנקרא"** button → `markRead()` → invalidate

---

## Firestore Indexes (add via console when first query fails)

1. `recipientType` ASC + `recipientId` ASC + `createdAt` DESC — for getMine
2. `kidId` ASC + `adminId` ASC + `createdAt` DESC — for getSent

---

## Files to Change

| File | Change |
|------|--------|
| `server/routes/therapy.js` | +5 notification routes |
| `server/services/therapy.js` | +5 notification service functions |
| `src/types/index.ts` | +`Notification` interface |
| `src/api/client.ts` | +`notificationsApi` |
| `src/pages/KidDetail.tsx` | +admin notifications section + compose modal |
| `src/pages/Dashboard.tsx` | +bell icon + notification modal (therapist view) |
| `src/pages/ParentView.tsx` | +"הודעות מהצוות" section |

---

## Verification Checklist

- [ ] Admin → KidDetail → compose message → pick specific practitioner → send → appears in sent log
- [ ] Therapist → Dashboard → bell shows count → click → sees message → mark as read → count drops
- [ ] Admin → send to "כל ההורים" → one doc created with `recipientId = kidId`
- [ ] Parent → `/p/:kidId` → sees "הודעות מהצוות" → marks as read → moves to read style
- [ ] Admin deletes notification → removed from sent log and from recipient view (next poll)
- [ ] Practitioner A cannot see notifications addressed to Practitioner B
