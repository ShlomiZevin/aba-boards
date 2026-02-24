# Boards to Generate

## Board 1: הילה (Hila)

### Child Info
- **Name:** הילה
- **Age:** 10
- **Gender:** girl
- **Color:** pink
- **Coin Style:** points
- **Daily Reward:** 5 points
- **Show Dino:** true
- **Sounds:** true
- **Has Image:** Yes (base64 from parent)
- **Parent:** שרית אלתרמן | saritr4@gmail.com | 0545201721

### Child Description
ריקוד, תיאטרון, חברות, אקרובטיקה, תנועת נוער (התנועה החדשה), צחוקים שטויות ולהיות בתנועה

### Behavior Goals
- להפחית שימוש בטלפון ולעשות יצירה במקום
- יכולת להרגע בערב כשמפחדת
- להפרד ממני בערב ולהצליח ללכת לישון בזמן
- להצליח לשהות במיטה כשהולכת לישון
- להרגיע פחדי לילה
- להיות עצמאית במעברים בבוקר

### Additional Notes
אוהבת אקרובטיקה. זקוקה לטכניקות הרגעות. מנחי יוגה נשימות וכו. שפחות מצליחה לעשות באופן עצמאי

---

### Board Layout

**Kid ID:** `הילה_<timestamp>` or `hila_<timestamp>`

#### Items:

| # | type | taskType | icon | title | details |
|---|------|----------|------|-------|---------|
| 1 | bank | - | - | קופת הנקודות של הילה | - |
| 2 | progress | - | - | ההתקדמות שלי היום | - |
| 3 | header (medium) | - | - | ✨ המשימות שלי ✨ | - |
| 4 | task | regular | 🛏️ | סידור חדר | activeDays: all |
| 5 | task | regular | 🎒 | הכנת תיק | activeDays: Sun-Thu (0,1,2,3,4) |
| 6 | task | regular | 👗 | הכנת בגדים | activeDays: all |
| 7 | task | regular | 🏠 | מטלת בית (כביסה/ מדיח) | activeDays: all |
| 8 | task | regular | 🌙 | ללכת לישון ב-21:00 | activeDays: all |
| 9 | task | regular | 🪥 | להכין מברשת שיניים | activeDays: all |
| 10 | task | regular | 🦷 | לצחצח שיניים | activeDays: all |
| 11 | task | regular | 💊 | לקחת תרופה בערב | activeDays: all |
| 12 | task | regular | 🐕 | לצאת עם באני הכלבה לטיילת | activeDays: all |
| 13 | header (medium) | - | - | 🧘 פינת ההרגעה 🧘 | - |
| 14 | task | calm-down | 🎨 | לוח ציור | activityType: paint |
| 15 | task | calm-down | 🫧 | בועות סבון | activityType: bubbles |
| 16 | task | calm-down | 🌬️ | תרגיל נשימות | activityType: breathing |
| 17 | header (medium) | - | - | 🎁 הפרסים שלי 🎁 | - |
| 18 | goal | - | 🎨 | יצירה | pointsRequired: 30 |
| 19 | goal | - | ☕ | יציאה לבית קפה | pointsRequired: 50 |

#### Settings:
```
dailyReward: 5
coinStyle: 'points'
colorSchema: 'pink'
showDino: true
soundsEnabled: true
savingsLabel: 'הנקודות שלי'
regularTasksHeader: '✨ המשימות שלי ✨'
calmDownHeader: '🧘 פינת ההרגעה 🧘'
builderPin: '1234'
imageName: <base64 from request>
```

#### Notes for board:
- Calm-down section is **critical** for this child — she has night fears and needs calming techniques (yoga, breathing) but struggles to do them independently. The breathing and paint activities give her accessible in-app tools.
- No bonus tasks defined — all tasks are regular daily tasks.
- Dog walk task says "at least once a day" — kept as regular task.

---

## Board 2: אורי (Ori)

### Child Info
- **Name:** אורי
- **Age:** 11
- **Gender:** girl
- **Color:** purple
- **Coin Style:** points
- **Daily Reward:** 1 point
- **Show Dino:** false
- **Sounds:** true
- **Has Image:** No
- **Parent:** דורית שחם | dorthsh@gmail.com | (no phone)

### Behavior Goals
- מעבר בין פעילויות
- ניהול זמנים
- דחיית סיפוקים

### Additional Notes
(none)

---

### Board Layout

**Kid ID:** `אורי_<timestamp>` or `ori_<timestamp>`

#### Items:

| # | type | taskType | icon | title | details |
|---|------|----------|------|-------|---------|
| 1 | bank | - | - | קופת הנקודות של אורי | - |
| 2 | progress | - | - | ההתקדמות שלי היום | - |
| 3 | header (medium) | - | - | ✨ המשימות שלי ✨ | - |
| 4 | task | regular | 📚 | הכנת שיעורי בית | activeDays: Sun-Thu (0,1,2,3,4) |
| 5 | task | regular | 🛏️ | סידור חדר | activeDays: all |
| 6 | task | regular | 🎒 | סידור ילקוט | activeDays: Sun-Thu (0,1,2,3,4) |
| 7 | task | regular | 🍽️ | ארוחת ערב | activeDays: all |
| 8 | task | regular | 🚿 | מקלחת | activeDays: all |
| 9 | header (medium) | - | - | 🎁 הפרסים שלי 🎁 | - |
| 10 | goal | - | 💕 | זמן איכות עם אמא או אבא | pointsRequired: 10 |

#### Settings:
```
dailyReward: 1
coinStyle: 'points'
colorSchema: 'purple'
showDino: false
soundsEnabled: true
savingsLabel: 'הנקודות שלי'
regularTasksHeader: '✨ המשימות שלי ✨'
builderPin: '1234'
imageName: ''
```

#### Notes for board:
- Simple, clean board — 5 daily tasks focused on routine and independence.
- No calm-down section (not requested).
- No bonus tasks.
- Reward "זמן איכות עם אמא או אבא" set to 10 points (= ~2 weeks of full daily completion at 1 pt/day with 5 tasks contributing). Adjust if needed.
- Dino is OFF per parent request.

---

## How to Generate

Run the script `generate-boards.js` from `aba-boards/scripts/` which:
1. Connects to Firestore via existing `server/services/firebase.js`
2. Creates kid documents with the board layouts above
3. Stores parent info in the `parents` collection
4. Outputs the board URLs for sharing with parents
