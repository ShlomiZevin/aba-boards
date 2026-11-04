import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../Icon';
import './mcp.css';

// The MCP address plus what an AI assistant (ChatGPT / Claude) can read from Doing and write
// into it. The server accepts only the super admin's access code, so the page is super-admin only.
const MCP_URL = 'https://avatar-server-1018338671074.me-west1.run.app/mcp';

const READ = [
  'רשימת הילדים ופרופיל של כל ילד',
  'מטרות, איסוף נתונים ותוכניות למידה',
  'טפסי טיפול, מפגשים וטפסי ישיבות',
  'דיווחים יומיים וסדר יום',
  'נתונים לסיכום תקופתי',
  'המסמכים במחברת',
];

const WRITE = [
  'שמירת מסמך במחברת של ילד: הכנה לפגישה, הדרכה, הערה או סיכום',
  'שמירת מסמך כללי, שלא שייך לילד מסוים',
  'הוספה למסמך שכבר קיים',
  'הוספת ילד ועריכת לוח משימות',
];

const READ_PROMPTS = [
  'מה המצב של לביא בשבועיים האחרונים לפי הדיווחים היומיים?',
  'תכיני סיכום תקופתי לנבו לאוקטובר',
  'אילו מטרות פעילות יש לנגה?',
  'מה יש במחברת של נגה?',
];

const WRITE_PROMPTS = [
  'שמרי את ההכנה הזאת לפגישה ב־Doing אצל לביא',
  'תוסיפי את הנקודות האלה למסמך ההדרכה של נבו',
  'שמרי את זה כמסמך כללי ב־Doing',
];

export default function McpConnect() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  if (!user?.isSuperAdmin) return <Navigate to="/" replace />;

  async function copy() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      (document.getElementById('mcp-url') as HTMLInputElement | null)?.select();
    }
  }

  return (
    <div className="mc">
      <header className="mc-head">
        <h1 className="nb-h1">חיבור <mark className="hl-yellow">לעוזרי AI</mark></h1>
        <div className="mc-brands"><span className="nb-chip tone-mint"><bdi>ChatGPT</bdi></span><span className="nb-chip tone-peach"><bdi>Claude</bdi></span></div>
      </header>

      <section className="nb-card nb-tape mc-url">
        <h2 className="nb-h2">כתובת החיבור</h2>
        <div className="mc-url-row">
          <input id="mcp-url" readOnly value={MCP_URL} dir="ltr" onFocus={e => e.currentTarget.select()} aria-label="כתובת החיבור" />
          <button type="button" className="nb-btn" onClick={copy}>
            <Icon name={copied ? 'check' : 'link'} /> {copied ? 'הועתק' : 'העתקה'}
          </button>
        </div>
      </section>

      <div className="mc-grid">
        <section className="nb-card mc-can">
          <h2 className="nb-h2"><span className="mc-ico tone-sky"><Icon name="search" size={20} /></span> קריאה</h2>
          <p className="nb-muted mc-sub">שואלים על כל ילד, והעוזר עונה מתוך הנתונים ב־<bdi>Doing</bdi>:</p>
          <ul className="mc-list">{READ.map(t => <li key={t}><Icon name="check" size={18} strokeWidth={2.4} /> {t}</li>)}</ul>
        </section>

        <section className="nb-card mc-can">
          <h2 className="nb-h2"><span className="mc-ico tone-pink"><Icon name="edit" size={20} /></span> כתיבה: שליחה ל־<bdi>Doing</bdi></h2>
          <ul className="mc-list">{WRITE.map(t => <li key={t}><Icon name="check" size={18} strokeWidth={2.4} /> {t}</li>)}</ul>
          <ul className="mc-rules">
            <li><b>מסמכים מגיעים כ״פרטי״</b>, רק את רואה אותם. בדף המסמך אפשר להעביר ל״צוות״ או ל״הורים״.</li>
            <li><b>העוזר מבקש אישור</b> לפני כל כתיבה.</li>
            <li><b>לכל מסמך יש קישור</b> לדף שלו ב־<bdi>Doing</bdi>.</li>
          </ul>
        </section>
      </div>

      <div className="mc-grid">
        <section className="nb-sec">
          <h2 className="nb-h2">דוגמאות לקריאה</h2>
          <ul className="mc-prompts">{READ_PROMPTS.map(t => <li key={t} className="nb-card">״{t}״</li>)}</ul>
        </section>
        <section className="nb-sec">
          <h2 className="nb-h2">דוגמאות לכתיבה</h2>
          <ul className="mc-prompts">{WRITE_PROMPTS.map(t => <li key={t} className="nb-card">״{t}״</li>)}</ul>
        </section>
      </div>

      <section className="mc-facts">
        <div><b>טיפ:</b> בשיחה חדשה לוחצים קודם על הפלוס ובוחרים <bdi>Doing</bdi>. אחר כך מספיק להזכיר את שם הילד.</div>
        <div><b>פרטיות:</b> אחרי החיבור, נתוני הילדים עוברים לחברת <bdi>OpenAI</bdi> או <bdi>Anthropic</bdi> תחת החשבון שלך.</div>
      </section>
    </div>
  );
}
