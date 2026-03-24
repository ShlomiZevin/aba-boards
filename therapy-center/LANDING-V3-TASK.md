# Landing Page V3 — Complete Redesign Task

## Context
The current landing pages (V1 at `/welcome`, V2 at `/welcome-v2`) have been iterated on but still don't feel right. A professional therapist described the design as "childish, not professional." V2 improved by removing emojis and using SVG icons, but the overall layout, visual language, and design system still feel like iterations on the same base rather than a fresh, professional design.

**The goal: Create a completely new landing page from scratch** — new layout, new visual design, new component structure — that looks like it belongs to a serious healthcare/SaaS platform for clinical professionals. Think: Monday.com, Notion, Linear, or healthcare platforms like SimplePractice/TherapyNotes.

## Route
- Create as `LandingPageV3.tsx` in `therapy-center/src/pages/`
- Add route `/welcome-v3` in `App.tsx` (next to existing `/welcome` and `/welcome-v2`)
- All CSS classes prefixed with `v3-` to avoid conflicts
- CSS goes at the end of `therapy-center/src/index.css`

## Design Direction — CRITICAL
This is NOT another iteration. This is a ground-up redesign. Key principles:

1. **Healthcare SaaS aesthetic** — Clean, minimal, lots of whitespace. Think clinical software, not a colorful marketing page. Muted color palette with one strong accent.
2. **Typography-driven** — Large, confident headlines. Professional font stack. Clear hierarchy. No decorative elements — let the text breathe.
3. **Flat, clean mockups** — No 3D transforms, no shadows-on-shadows. Simple bordered cards. Data-focused UI previews.
4. **No emojis anywhere** — Use SVG icons only (Lucide-style stroke icons).
5. **Restrained color palette** — Consider: slate grays (#0f172a, #334155, #64748b, #94a3b8) + ONE accent (indigo #4f46e5 or teal #0d9488 or blue #2563eb). Not multiple bright colors competing.
6. **Asymmetric/modern layouts** — Not just centered text + card grid. Consider offset grids, overlapping elements, full-bleed sections, sticky scroll sections.
7. **Social proof / credibility first** — For a professional audience, trust signals matter more than flashy visuals. Consider: "Built for ABA therapy centers" tagline, clinical terminology, professional language.
8. **RTL Hebrew** — `dir="rtl"` on root. Right = start, left = end.

## What NOT to do
- Don't iterate on V1/V2 code. Start fresh.
- Don't use emojis. Not even one.
- Don't use playful/rounded card designs with large border-radius (20px). Keep it 8-12px max.
- Don't use gradient backgrounds on sections (the V1/V2 hero gradient). Use solid colors or very subtle patterns.
- Don't use 3D perspective transforms on mockups.
- Don't include a "Dino" section (animated dinosaur character — too childish for this audience).
- Don't use fake/inflated stats ("מאות מטפלות", "70% פחות ניירת") — this audience sees through it.
- Don't duplicate mockup components across multiple sections.

## Page Structure (suggested — can be adjusted)

### 1. Navigation
- Fixed top, white/transparent, minimal
- Logo (left in RTL), nav links (center), CTA button (right in RTL)
- Logo: `<img src="/therapy/doing-logo-transparent2.png" />`
- Links: יכולות, בינה מלאכותית, יתרונות, צור קשר
- CTA: "כניסה למערכת" → navigates to `/login`
- Contact link: opens WhatsApp (`https://wa.me/972542801162`)

### 2. Hero Section
- Bold headline, subtitle, CTA buttons
- System preview/screenshot on the side (or below on mobile)
- Consider a more editorial/magazine-style hero instead of the classic split layout

### 3. Features Section (4 features)
**Feature 1: Goals tracking**
- Title: מטרות טיפוליות ומעקב התקדמות
- Description: הגדירו מטרות מדידות לכל ילד, עקבו אחרי אחוזי הצלחה לאורך זמן, וצפו בגרפים שמראים את ההתקדמות האמיתית. כל סשן מזין נתונים שהופכים לתובנות מיידיות.
- Bullets: גרפי התקדמות שבועיים וחודשיים / מטרות עם קריטריונים מדידים / ספריית מטרות משותפת למרכז / עדכון נתונים ישירות מהטופס

**Feature 2: Calendar & Sessions**
- Title: יומן סשנים ולוח שנה
- Description: כל הסשנים של כל המטפלות — ביומן אחד ברור. צפו בלוח השבועי, סננו לפי מטפלת, ותראו מי עבד עם מי ומתי. כל סשן מקושר ישירות לטופס שמולא.
- Bullets: תצוגת יומן שבועית וחודשית / צבע ייחודי לכל מטפלת / קישור ישיר מסשן לטופס / עובד מושלם גם בנייד

**Feature 3: Forms & Data Collection**
- Title: טפסים מקצועיים ואיסוף נתונים
- Description: צרו טפסי מעקב טיפולי מותאמים — עם סעיפים לכל מטרה, מד שיתוף פעולה, ספירת ניסיונות/הצלחות, והערות חופשיות. כל הנתונים נשמרים ומוזנים ישירות לגרפי ההתקדמות.
- Bullets: טפסי סשן מותאמים אישית / טפסי ישיבות צוות / איסוף נתונים כמותי לכל מטרה / שמירה אוטומטית ועריכה חוזרת

**Feature 4: Team Management**
- Title: ניהול צוות מטפלות
- Description: שייכו מטפלות לילדים, עקבו אחרי מספר הסשנים של כל מטפלת, ותנו לכל מטפלת גישה מותאמת — היא רואה רק את הילדים שלה, ממלאה טפסים, ומקבלת התראות רלוונטיות.
- Bullets: פרופיל מטפלת עם תפקיד ומומחיות / גישה מבוקרת לפי שיוך / ממשק מטפלת נפרד ופשוט / סטטיסטיקות פעילות למטפלת

### 4. AI Section
- Title: עוזר AI שמבין טיפול
- Subtitle: לא צריך להיות טכנולוגי — פשוט כתבו מה שאתם צריכים בעברית רגילה והבינה המלאכותית תעשה את השאר
- Chat mockup (animated typing) with these messages:
  1. User: תכין לי טופס הערכה ליואב עם התמקדות במיומנויות קוגניטיביות
  2. AI: הכנתי טופס הערכה עם 4 סעיפים: משחק חברתי בתורות, העתקת דגם קוביות, מיון קטגוריות, ולמידה בספרים. רוצה שאוסיף משהו?
  3. User: תוסיף גם חלק על ויסות רגשי. מה המצב של המטרות שלו השבוע?
  4. AI: הוספתי! לגבי המטרות: משחק בתורות ב‎-78% (עלייה), העתקת דגם ב‎-45% (יציב), מיון קטגוריות ב‎-92% (מצוין!)
- AI capabilities (6 items): יצירת טפסים / הגדרת מטרות / ניתוח נתונים / סיעור מוחות / סיכומים / לוחות משימות
- Highlight box: הבינה המלאכותית מכירה את כל הנתונים שלכם — היא יכולה לגשת למידע על הילדים, לנתח התקדמות, ליצור טפסים ולוחות, להציע מטרות, ולעזור בסיעור מוחות — הכל בשיחה פשוטה. כמו עוזרת מנהלית שעובדת 24/7.

### 5. Benefits (6 items)
1. חסכון בזמן — במקום שעות של ניירת — דקות. טפסים אוטומטיים, נתונים שמתעדכנים לבד, ובינה מלאכותית שעושה בשבילכם.
2. החלטות מבוססות נתונים — כל סשן מייצר נתונים. כל נתון הופך לגרף. כל גרף מספר סיפור. תראו את ההתקדמות האמיתית.
3. עבודת צוות מושלמת — כולם רואים את אותו מידע. מטפלות יודעות מה קרה בסשן הקודם. מנהלות רואות את התמונה הגדולה.
4. נגיש מכל מקום — עובד בנייד, בטאבלט ובמחשב. מטפלות ממלאות טפסים תוך כדי הסשן. הורים צופים מהבית.
5. פרטיות ואבטחה — כל מטפלת רואה רק את הילדים שמשויכים אליה. הורים רואים רק קריאה. הנתונים מוגנים.
6. AI שעוזר באמת — לא גימיק — בינה מלאכותית שמבינה טיפול, יוצרת טפסים, מנתחת נתונים, ומציעה מטרות. באמת עובד.

### 6. Who Is It For (4 personas)
1. מנהלי מרכזי טיפול — ראו את כל הילדים, כל המטפלות, כל הסשנים — מסך אחד. קבלו החלטות מבוססות נתונים. Features: ניהול מרכזי של צוותים / דוחות ותובנות / ספריית מטרות משותפת
2. מטפלות ואנשי מקצוע — מלאו טפסים בקלות, ראו את ההתקדמות של הילדים שלכם, ותקשרו עם הצוות — הכל מהנייד. Features: מילוי טפסים מהיר / גישה מהנייד / צפייה במטרות
3. הורים — קבלו קישור אישי לצפייה בלוח המשימות של ילדכם, ראו את ההתקדמות, ותהיו חלק מהתהליך. Features: לוח משימות ויזואלי / מעקב התקדמות / שקיפות מלאה
4. מטפלות עצמאיות — גם בלי מרכז — נהלו את הילדים שלכם בצורה מקצועית. טפסים, מטרות, לוחות — הכל במקום אחד. Features: ניהול עצמאי / AI שעוזר / חינם להתחלה

### 7. CTA Section
- Title: מוכנים לשדרג את ניהול הטיפול?
- Subtitle: הצטרפו למרכזי טיפול שכבר עובדים עם Doing
- Primary CTA: התחילו לעשות — חינם → navigate('/login')
- Secondary: דברו איתנו בוואטסאפ → WhatsApp link
- Note: ללא כרטיס אשראי • הקמה תוך דקות • תמיכה בעברית

### 8. Footer
- Logo + "ניהול טיפול חכם"
- Links: יכולות / בינה מלאכותית / יתרונות
- Copyright: © 2026 Doing — כל הזכויות שמורות

### 9. Floating WhatsApp Button
- Fixed bottom-left (RTL)
- Green pill with WhatsApp SVG icon + "דברו איתנו"
- Links to `https://wa.me/972542801162`
- Collapses to icon-only on mobile

## Mockup Data for Previews

### Goals mockup data:
- משחק חברתי בתורות: 78%
- העתקת דגם קוביות: 45%
- מיון קטגוריות: 92%
- למידה בספרים: 60%

### Calendar mockup data:
Days: א׳ ב׳ ג׳ ד׳ ה׳ ו׳
Sessions:
- Sun 09:00 רונית כ. (behavioral) color: blue
- Sun 14:00 מיכל ש. (OT) color: amber
- Mon 10:00 רונית כ. (behavioral) color: blue
- Tue 09:00 דנה ל. (speech) color: green
- Tue 16:00 רונית כ. (emotional) color: blue
- Wed 10:00 מיכל ש. (OT) color: amber
- Thu 09:00 רונית כ. (behavioral) color: blue

### Form mockup data:
- Patient: יואב כהן — סשן #34 — 11.03.2026
- Cooperation: 75%
- Goal "משחק חברתי בתורות": 8 attempts, 6 successes, 75%
- Notes: התקדמות יפה במשחק בתורות. הגיב טוב למשחק עם בובות...

### Team mockup data:
- רונית כהן, מטפלת התנהגותית, 12 sessions, initials ר.כ
- מיכל שפירא, ריפוי בעיסוק, 8 sessions, initials מ.ש
- דנה לוי, קלינאית תקשורת, 6 sessions, initials ד.ל
- ד"ר אבי מזרחי, פסיכולוג, 3 sessions, initials א.מ

### Hero preview (dashboard mockup):
- Metrics: 83 מטופלים פעילים, 47 סשנים השבוע, 156 מטרות בהתקדמות
- Bar chart: goal progress over 4 weeks
- Table rows: י.כ/משחק חברתי/78%/בטיפול, נ.ל/העתקת דגם/92%/הושג, ר.ש/חיוי הנגריות/45%/בטיפול

## Technical Notes
- React 18 + TypeScript + Vite
- No UI library — custom CSS only
- All CSS prefixed with `v3-` to avoid conflicts
- Existing pages at `/welcome` (V1) and `/welcome-v2` (V2) must not be modified
- WhatsApp SVG icon is inline data URI (see V2 code for reference)
- Logo image: `/therapy/doing-logo-transparent2.png`
- Login route: `/login`
- WhatsApp: `https://wa.me/972542801162`
- The `Reveal` scroll-animation wrapper pattern from V1/V2 can be reused (IntersectionObserver fade-in)

## Reference for design inspiration
Look at these SaaS landing pages for the right aesthetic:
- **Linear.app** — minimal, dark option, typography-focused, clean mockups
- **Notion.so** — clean white, large headlines, simple illustrations
- **SimplePractice.com** — healthcare SaaS, professional, trustworthy
- **Monday.com** — colorful but organized, clear feature presentation

The key insight: this is for **Israeli clinical professionals** (behavioral therapists, OTs, speech therapists, psychologists, center managers). They need to feel this is a **serious tool for serious work**, not a cute app.
