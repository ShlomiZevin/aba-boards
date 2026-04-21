import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL;

type Platform = 'ios' | 'android';

export default function InstallApp() {
  const [platform, setPlatform] = useState<Platform>('ios');

  useEffect(() => {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) setPlatform('android');
    else if (/iPhone|iPad|iPod/i.test(ua)) setPlatform('ios');
  }, []);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px', direction: 'rtl' }}>
      {/* Hero */}
      <div className="content-card" style={{ textAlign: 'center', padding: '26px 20px 20px' }}>
        <h1
          style={{
            margin: '0 0 10px',
            fontSize: 'clamp(1.15em, 4.5vw, 1.5em)',
            color: '#1a1a2e',
            lineHeight: 1.4,
            fontWeight: 700,
          }}
        >
          איך מוסיפים את{' '}
          <img
            src={`${BASE}doing-logo-transparent2.png`}
            alt="Doing"
            style={{
              height: '0.95em',
              verticalAlign: '-0.15em',
              margin: '0 2px',
            }}
          />{' '}
          למסך הבית?
        </h1>
        <p style={{ margin: 0, color: '#718096', fontSize: 'clamp(0.88em, 3.4vw, 1em)', lineHeight: 1.6 }}>
          כמה נקישות קטנות ויש לכם אייקון קבוע במכשיר —<br />
          בדיוק כמו אפליקציה אמיתית. פשוט, מהיר ובלי הורדות.
        </p>
      </div>

      {/* Tabs — segmented control on white so it doesn't blend into the purple body */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          background: 'white',
          padding: 6,
          borderRadius: 14,
          marginBottom: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <TabButton active={platform === 'ios'} onClick={() => setPlatform('ios')}>
          <span style={{ marginLeft: 8 }}></span>
          אייפון (iPhone / iPad)
        </TabButton>
        <TabButton active={platform === 'android'} onClick={() => setPlatform('android')}>
          <span style={{ marginLeft: 8 }}>🤖</span>
          אנדרואיד (Android)
        </TabButton>
      </div>

      {platform === 'ios' ? <IosSteps /> : <AndroidSteps />}

      {/* General FAQ */}
      <div className="content-card" style={{ marginTop: 20 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1.1em', color: '#4a5568' }}>למה בכלל להתקין?</h3>
        <ul style={{ margin: 0, paddingInlineStart: 20, color: '#4a5568', lineHeight: 1.8, fontSize: '0.95em' }}>
          <li>אייקון קבוע במסך הבית — גישה בלחיצה אחת.</li>
          <li>פתיחה מסך מלא, בלי סרגלי הדפדפן.</li>
          <li>טעינה מהירה יותר בפעמים הבאות.</li>
          <li>לא תופס מקום ולא צריך להוריד מחנות אפליקציות.</li>
        </ul>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 14px',
        border: 'none',
        borderRadius: 10,
        fontSize: '1em',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: active ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
        color: active ? 'white' : '#64748b',
        boxShadow: active ? '0 4px 12px rgba(102, 126, 234, 0.35)' : 'none',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #f0edf7' }}>
      <div
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 700,
          fontSize: '1.05em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, paddingTop: 4 }}>
        <div style={{ fontWeight: 700, color: '#2d3748', fontSize: '1.02em', marginBottom: 4, lineHeight: 1.4 }}>
          {title}
        </div>
        <div style={{ color: '#718096', fontSize: '0.93em', lineHeight: 1.65 }}>{children}</div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#f0edf7',
        color: '#4a3b7a',
        padding: '3px 10px',
        borderRadius: 10,
        fontWeight: 600,
        fontSize: '0.9em',
        margin: '0 2px',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </span>
  );
}

function Callout({ kind, title, children }: { kind: 'info' | 'tip'; title: string; children: React.ReactNode }) {
  const colors =
    kind === 'info'
      ? { bg: '#f8f5ff', border: '#667eea', text: '#4a3b7a', titleC: '#36286b' }
      : { bg: '#fff8e1', border: '#f59e0b', text: '#78550d', titleC: '#5a3f0a' };
  return (
    <div
      style={{
        background: colors.bg,
        borderInlineEnd: `4px solid ${colors.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        color: colors.text,
        fontSize: '0.94em',
        lineHeight: 1.6,
        marginTop: 14,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 3, color: colors.titleC }}>{title}</div>
      {children}
    </div>
  );
}

function IosSteps() {
  return (
    <div className="content-card" style={{ padding: '8px 22px 20px' }}>
      <Callout kind="info" title="חשוב">
        פתחו את האתר דווקא בדפדפן <b>Safari</b> (המצפן הכחול). זה לא יעבוד בדפדפנים אחרים באייפון.
      </Callout>

      <Step n={1} title="פתחו את האתר ב-Safari">
        היכנסו לכתובת של Doing מהדפדפן <b>Safari</b>.
      </Step>

      <Step n={2} title="לחצו על כפתור השיתוף">
        זה הריבוע עם חץ הפונה כלפי מעלה <Chip>⬆ שיתוף</Chip> — בתחתית המסך (או למעלה באייפד).
      </Step>

      <Step n={3} title='בחרו "הוסף למסך הבית"'>
        גללו קצת ברשימה ולחצו על <b>הוסף למסך הבית</b> (Add to Home Screen).
      </Step>

      <Step n={4} title='לחצו "הוסף" למעלה מימין'>
        אפשר להשאיר את השם "Doing" או לשנות, ואז ללחוץ <b>הוסף</b>.
      </Step>

      <Step n={5} title="זהו — האייקון במסך הבית">
        מכאן לוחצים על האייקון כמו על כל אפליקציה רגילה.
      </Step>

      <Callout kind="tip" title="טיפ קטן">
        אם אתם לא רואים את כפתור השיתוף — גללו את הדף קצת למעלה, או לחצו באמצע המסך כדי שסרגל הכלים יופיע שוב.
      </Callout>
    </div>
  );
}

function AndroidSteps() {
  return (
    <div className="content-card" style={{ padding: '8px 22px 20px' }}>
      <Callout kind="info" title="מומלץ">
        פתחו את האתר בדפדפן <b>Chrome</b> (האייקון הצבעוני העגול). זה הדפדפן שהכי תומך בהתקנת אפליקציות.
      </Callout>

      <Step n={1} title="פתחו את האתר ב-Chrome">
        היכנסו לכתובת של Doing מהדפדפן <b>Chrome</b>.
      </Step>

      <Step n={2} title="לחצו על שלוש הנקודות">
        בפינה הימנית העליונה של הדפדפן <Chip>⋮ תפריט</Chip> — שם נמצאות כל האפשרויות.
      </Step>

      <Step n={3} title='בחרו "התקן אפליקציה" או "הוספה למסך הבית"'>
        לפי דגם הטלפון, הכיתוב יהיה <b>Install app</b> / <b>התקן אפליקציה</b> או <b>Add to Home screen</b> / <b>הוספה למסך הבית</b>. שניהם עובדים.
      </Step>

      <Step n={4} title='אשרו בלחיצה על "התקן"'>
        אפשר להשאיר את השם "Doing" או לשנות, ואז ללחוץ <b>התקן</b> / <b>הוסף</b>.
      </Step>

      <Step n={5} title="זהו — האייקון במסך הבית">
        המכשיר יוסיף את Doing למסך הבית או למגירת האפליקציות, ומכאן פותחים כמו כל אפליקציה.
      </Step>

      <Callout kind="tip" title="טיפ קטן">
        לפעמים מופיעה למטה הודעה קטנה "הוספה למסך הבית" — אפשר פשוט ללחוץ עליה ולדלג על התפריט.
      </Callout>
    </div>
  );
}
