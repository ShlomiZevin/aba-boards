import { useEffect, useState } from 'react';

import Icon from '../v2/Icon';
import '../v2/pages/tm.css';

const BASE = import.meta.env.BASE_URL;

function ShareIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 9H6v11h12V9h-2 M12 3v12 M8.5 6.5L12 3l3.5 3.5" />
    </svg>
  );
}

type Platform = 'ios' | 'android';

export default function InstallApp() {
  const [platform, setPlatform] = useState<Platform>('ios');

  useEffect(() => {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) setPlatform('android');
    else if (/iPhone|iPad|iPod/i.test(ua)) setPlatform('ios');
  }, []);

  return (
    <div className="tm-install">
      <header className="tm-install-hero">
        <h1>
          איך מוסיפים את{' '}
          <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" />{' '}
          ל<mark className="hl-yellow">מסך הבית</mark>?
        </h1>
        <p>כמה נקישות קטנות ויש לכם אייקון קבוע במכשיר — בדיוק כמו אפליקציה אמיתית. פשוט, מהיר ובלי הורדות.</p>
      </header>

      <div className="tm-seg" role="tablist" aria-label="סוג המכשיר">
        <button type="button" role="tab" aria-selected={platform === 'ios'} className={platform === 'ios' ? 'is-on' : ''} onClick={() => setPlatform('ios')}>
          <span>אייפון / אייפד</span>
        </button>
        <button type="button" role="tab" aria-selected={platform === 'android'} className={platform === 'android' ? 'is-on' : ''} onClick={() => setPlatform('android')}>
          <span>אנדרואיד</span>
        </button>
      </div>

      {platform === 'ios' ? <IosSteps /> : <AndroidSteps />}

      <section className="nb-card tm-why">
        <h2 className="nb-h2">למה בכלל להתקין?</h2>
        <ul>
          <li><Icon name="check" size={20} /> אייקון קבוע במסך הבית — גישה בלחיצה אחת.</li>
          <li><Icon name="check" size={20} /> פתיחה מסך מלא, בלי סרגלי הדפדפן.</li>
          <li><Icon name="check" size={20} /> טעינה מהירה יותר בפעמים הבאות.</li>
          <li><Icon name="check" size={20} /> לא תופס מקום ולא צריך להוריד מחנות אפליקציות.</li>
        </ul>
      </section>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="tm-step">
      <span className="tm-step-n" aria-hidden="true">{n}</span>
      <div className="tm-step-b">
        <b>{title}</b>
        <div>{children}</div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="tm-kbd">{children}</span>;
}

function Callout({ kind, title, children }: { kind: 'info' | 'tip'; title: string; children: React.ReactNode }) {
  return (
    <div className={`tm-note tone-${kind === 'info' ? 'sky' : 'yellow'}`}>
      <b>{title}</b>
      {children}
    </div>
  );
}

function IosSteps() {
  return (
    <div className="nb-card tm-steps">
      <Callout kind="info" title="חשוב">
        פתחו את האתר דווקא בדפדפן <b>Safari</b> (המצפן הכחול). זה לא יעבוד בדפדפנים אחרים באייפון.
      </Callout>

      <Step n={1} title="פתחו את האתר ב-Safari">
        היכנסו לכתובת של Doing מהדפדפן <b>Safari</b>.
      </Step>

      <Step n={2} title="לחצו על כפתור השיתוף">
        זה הריבוע עם חץ הפונה כלפי מעלה <Chip><ShareIcon /> שיתוף</Chip> — בתחתית המסך (או למעלה באייפד).
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
    <div className="nb-card tm-steps">
      <Callout kind="info" title="מומלץ">
        פתחו את האתר בדפדפן <b>Chrome</b> (האייקון הצבעוני העגול). זה הדפדפן שהכי תומך בהתקנת אפליקציות.
      </Callout>

      <Step n={1} title="פתחו את האתר ב-Chrome">
        היכנסו לכתובת של Doing מהדפדפן <b>Chrome</b>.
      </Step>

      <Step n={2} title="לחצו על שלוש הנקודות">
        בפינה הימנית העליונה של הדפדפן <Chip><Icon name="more" size={16} strokeWidth={3} className="tm-rot90" /> תפריט</Chip> — שם נמצאות כל האפשרויות.
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
