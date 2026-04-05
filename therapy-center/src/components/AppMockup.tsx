/* ------------------------------------------------------------------ */
/*  App mockup — immersive kid detail with calendar + sessions         */
/*  Matches the real app: purple bg, white cards, green/orange events   */
/* ------------------------------------------------------------------ */
export default function AppMockup() {
  /* Calendar events: day → [{name, color}] */
  const events: Record<number, { name: string; color: string }[]> = {
    1:  [{ name: 'רונית', color: '#48bb78' }],
    2:  [{ name: '2 טיפולים', color: '#48bb78' }, { name: 'רונית', color: '#48bb78' }],
    3:  [{ name: 'סלומון', color: '#48bb78' }],
    5:  [{ name: 'רונית', color: '#48bb78' }],
    6:  [{ name: 'ישיבה', color: '#9f7aea' }],
    8:  [{ name: 'רונית', color: '#48bb78' }, { name: 'סלומון', color: '#48bb78' }],
    9:  [{ name: '2 טיפולים', color: '#48bb78' }],
    10: [{ name: 'סלומון', color: '#48bb78' }],
    12: [{ name: 'רונית', color: '#48bb78' }],
    15: [{ name: 'רונית', color: '#48bb78' }],
    16: [{ name: 'סלומון', color: '#f6ad55' }],
    17: [{ name: 'רונית', color: '#f6ad55' }],
    19: [{ name: 'סלומון', color: '#f6ad55' }],
    22: [{ name: 'רונית', color: '#48bb78' }],
    23: [{ name: '2 טיפולים', color: '#48bb78' }],
    24: [{ name: 'ישיבה', color: '#9f7aea' }],
    26: [{ name: 'סלומון', color: '#48bb78' }],
    29: [{ name: 'רונית', color: '#48bb78' }],
    30: [{ name: 'סלומון', color: '#48bb78' }],
  };

  const calRows = [
    [null, null, null, 1, 2, 3, 4],
    [5, 6, 7, 8, 9, 10, 11],
    [12, 13, 14, 15, 16, 17, 18],
    [19, 20, 21, 22, 23, 24, 25],
    [26, 27, 28, 29, 30, null, null],
  ];

  return (
    <div className="mk">
      {/* ---- Purple app background ---- */}
      <div className="mk-bg">
        {/* ---- Kid header card ---- */}
        <div className="mk-header-card">
          <div className="mk-profile">
            <img src="/therapy/tamar.jpg" alt="תמר" className="mk-avatar" />
            <div className="mk-profile-info">
              <div className="mk-name">הראל</div>
              <div className="mk-badges">
                <span className="mk-badge">55 מטרות פעילות</span>
                <span className="mk-badge">31 טיפולים</span>
                <span className="mk-badge warn">2 ממתינים לטופס</span>
              </div>
            </div>
          </div>
          {/* Quick actions */}
          <div className="mk-quick-actions">
            <span className="mk-quick-btn">לוח</span>
            <span className="mk-quick-btn">עדכן לוח</span>
            <span className="mk-quick-btn">סטטיסטיקה</span>
          </div>
        </div>

        {/* ---- Tab bar ---- */}
        <div className="mk-tab-bar">
          <span className="mk-tab active">טיפולים</span>
          <span className="mk-tab">התקדמות</span>
          <span className="mk-tab">סקירה</span>
          <span className="mk-tab">הודעות</span>
          <span className="mk-tab">איסוף נתונים</span>
          <span className="mk-tab">תכניות למידה</span>
          <span className="mk-tab">שעות צוות</span>
        </div>

        {/* ---- Sessions content card ---- */}
        <div className="mk-content-card">
          {/* Section header */}
          <div className="mk-section-bar">
            <span className="mk-section-title">טיפולים</span>
            <div className="mk-section-actions">
              <span className="mk-action-btn">תבנית טופס</span>
              <span className="mk-action-btn outline">מלא טופס</span>
              <span className="mk-action-btn primary">+ פגישה חדשה</span>
            </div>
          </div>

          {/* Pending alert */}
          <div className="mk-alert">2 טיפולים ממתינים לטופס</div>

          {/* Calendar nav */}
          <div className="mk-cal-nav">
            <div className="mk-cal-nav-btns">
              <span>היום</span>
              <span>הקודם</span>
              <span>הבא</span>
            </div>
            <span className="mk-cal-month">אפריל 2026</span>
          </div>

          {/* Calendar grid */}
          <div className="mk-cal">
            <div className="mk-cal-header">
              {['ש׳','ו׳','ה׳','ד׳','ג׳','ב׳','א׳'].map(d => <span key={d}>{d}</span>)}
            </div>
            {calRows.map((row, ri) => (
              <div key={ri} className="mk-cal-row">
                {row.map((day, ci) => (
                  <div key={ci} className="mk-cal-day">
                    {day && (
                      <>
                        <span className="mk-cal-num">{day}</span>
                        {events[day] && (
                          <div className="mk-cal-events">
                            {events[day].map((ev, ei) => (
                              <div key={ei} className="mk-cal-ev" style={{ background: ev.color }}>
                                <span className="mk-cal-ev-check">&#10003;</span>
                                <span>{ev.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
