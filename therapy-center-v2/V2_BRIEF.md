# v2 redesign brief — "מחברת שטח" (Field Notebook)

You are restyling part of the Doing therapy-center app inside `C:\workspace\aba\aba-boards\therapy-center-v2` (a copy of the live app). Michal (centre manager) and therapists use it on phones in the field. Hebrew, RTL. **Mobile first.**

## Hard rules
- Work ONLY inside `therapy-center-v2/`. Never touch `therapy-center/`, `public/`, `server/`, firebase files. Never build/deploy, never run the real server, never call the real API.
- **Keep every feature and behaviour.** Change presentation (JSX structure/classes/CSS/copy polish), not data logic, API calls, mutations, routes or permissions (admin / therapist `/t/:id` / parent `/p/:kidId` read-only).
- Do NOT edit these shared files (others own them): `src/v2/notebook.css`, `src/v2/NbNav.tsx`, `src/App.tsx`, `src/main.tsx`, `src/api/client.ts`, `src/contexts/*`, `mock/*`, `vite.config.ts`, `index.html`. You MAY import from `src/v2/Icon.tsx`, `src/v2/KidAvatar.tsx`, `src/v2/kidColor.ts`. If you need a new icon, add a local SVG in your own file (don't edit Icon.tsx).
- Put your CSS in your own file(s) `src/v2/pages/<area>.css`, imported from the pages you own. Scope every rule under `html.nb` (e.g. `html.nb .ff-goal {}`); prefix your new classes with your area prefix. Don't restyle global classes others share (`.btn-primary`, `.modal`, `.content-card`, `.form-group`…) — they're already skinned in notebook.css.
- No emoji in UI chrome (icons via `Icon` / inline SVG). Kids' avatars: `KidAvatar`. Category colours: `CATEGORY_TONE` + `.tone-*` classes (marker pastels), never the old `GOAL_CATEGORIES` hex colours.
- Run `npx tsc -b` in therapy-center-v2 at the end; it must pass.

## Design language (read `src/v2/notebook.css` first — tokens + primitives)
Tokens: `--paper #FFFBF3`, `--card #fff`, `--ink #2A2140`, `--ink-2`, `--muted #7B7088`, `--line #E8DDC8` (dashed dividers), `--pen #6B4FD8` (the one accent), markers `--m-yellow/pink/mint/sky/peach/lilac`, `--red`, `--green`. Fonts: `--f-display` Secular One (headings), `--f-body` Heebo, `--f-hand` Playpen Sans Hebrew (only for big friendly notes/empty states, never small labels).
Primitives available: `.nb-card` (paper card) + `.nb-tape`, `.nb-sticker` (+ `.tone-*`, `--rot`), `.nb-chip`, `.nb-dot`, `.nb-btn` (`.xl`, `.block`), `.nb-btn-ghost` (`.sm`), `.nb-h1`, `.nb-h2`, `.nb-sec`, `.nb-sec-head`, `mark.hl-yellow|pink|mint|sky|peach|lilac` (marker behind a word), `.nb-av` avatar, `.hand`, `.nb-muted`, `.tabular`.
Principles: one big primary action per screen within thumb reach (sticky bottom on focused task screens, above the 68px bottom nav — use `bottom: calc(68px + 12px + env(safe-area-inset-bottom))` on mobile, plain on ≥900px where the nav is a side bar); touch targets ≥ 44px; dashed dividers instead of boxes; lists over nested cards; stickers for status; text never overflows; no horizontal page scroll at 390px. Desktop ≥900px: content area right of a 248px side bar — use space well (2 columns where natural).
Reference for look & copy: `src/v2/pages/Today.tsx` + `today.css`, `src/v2/pages/Kids.tsx` + `kids.css`, the header in `src/pages/KidDetail.tsx` + `src/v2/pages/kid.css`. Design concept images: `C:\workspace\aba\reports\design-concepts\img\c4-flare.jpg`, `c4-sun.jpg`, `c4-desk.jpg` (view with Read).

## Checking your work visually
Dev server is already running at http://127.0.0.1:5199/therapy-v2/ (mock data, admin key 1234 is auto-set by the script). Screenshot helper (phone emulation):
```
S=/c/Users/shazb/AppData/Local/Temp/claude/c--workspace-aba/d3d8d183-c4e0-4ac9-adc9-83251635d1ae/scratchpad
cd $S/pw && MSYS_NO_PATHCONV=1 node shot.mjs "$(cygpath -m $S)" 390 844 "/therapy-v2/calendar|<unique-name>|full"
```
(width 1366 for desktop; `|full` = full page). Name your screenshots with your area prefix. Mock ids: kids `k-noga k-liam k-omer k-tamar k-yoav`, practitioners `p-shira p-dana p-rotem p-yael`; therapist view `/therapy-v2/t/p-shira/...`, parent view `/therapy-v2/p/k-noga`. Forms exist with ids `f-*` (get one from `curl -s http://127.0.0.1:5199/api/therapy/kids/k-noga/forms`). The mock answers unknown GETs with `[]`; if a page needs data the mock lacks, render the empty state nicely — don't edit the mock (report what's missing instead).
Take a phone screenshot of every screen you own, fix what looks off, and re-check once.

## Report back
One short paragraph: what you changed (files), anything you could not finish, and any mock data you'd need.
