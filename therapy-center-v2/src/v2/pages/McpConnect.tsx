import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../Icon';
import './mcp.css';

// Guide for connecting ChatGPT / Claude to Doing through the MCP server.
// The server accepts only the super admin's access code, so the page is super-admin only too.
const MCP_URL = 'https://avatar-server-1018338671074.me-west1.run.app/mcp';

const CAN_DO = [
  'רשימת הילדים ופרופיל כל ילד',
  'מטרות, תוכניות למידה ואיסוף נתונים',
  'טפסי טיפול, מפגשים וטפסי ישיבות',
  'דיווחים יומיים וסדר יום',
  'נתונים לסיכום תקופתי',
  'הוספת ילד ועריכת לוח משימות',
];

const PROMPTS = [
  'מה המצב של לביא בשבועיים האחרונים לפי הדיווחים היומיים?',
  'תכיני סיכום תקופתי לנבו לאוקטובר',
  'אילו מטרות פעילות יש לנגה?',
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
      const el = document.getElementById('mcp-url') as HTMLInputElement | null;
      el?.select();
    }
  }

  return (
    <div className="mc">
      <header className="mc-head">
        <h1 className="nb-h1">חיבור <mark className="hl-yellow">לעוזרי AI</mark></h1>
        <div className="mc-brands"><span className="nb-chip tone-mint"><bdi>ChatGPT</bdi></span><span className="nb-chip tone-peach"><bdi>Claude</bdi></span></div>
        <p className="nb-muted">אפשר לשאול את <bdi>ChatGPT</bdi> או את <bdi>Claude</bdi> על הילדים במרכז, והם עונים מתוך הנתונים של <bdi>Doing</bdi>. הכלים זהים לאלה של הצ׳אט באתר.</p>
      </header>

      <section className="nb-card nb-tape mc-url">
        <h2 className="nb-h2">כתובת החיבור</h2>
        <div className="mc-url-row">
          <input id="mcp-url" readOnly value={MCP_URL} dir="ltr" onFocus={e => e.currentTarget.select()} />
          <button type="button" className="nb-btn" onClick={copy}>
            <Icon name={copied ? 'check' : 'link'} /> {copied ? 'הועתק' : 'העתקה'}
          </button>
        </div>
        <p className="mc-note">בחיבור ייפתח דף כניסה של <bdi>Doing</bdi>. מזינים בו את מפתח הגישה שבו נכנסים לאתר.</p>
      </section>

      <div className="mc-grid">
        <section className="nb-card mc-steps">
          <h2 className="nb-h2"><span className="nb-chip tone-mint">ChatGPT</span></h2>
          <ol>
            <li>הגדרות ← <bdi><b>Apps &amp; Connectors</b></bdi> ← <bdi><b>Advanced</b></bdi></li>
            <li>מפעילים את <bdi><b>Developer mode</b></bdi></li>
            <li>יוצרים חיבור חדש (<bdi>Create connector</bdi>) ומדביקים את הכתובת</li>
            <li>סוג אימות: <bdi><b>OAuth</b></bdi></li>
            <li>בדף הכניסה של <bdi>Doing</bdi> מזינים את מפתח הגישה</li>
          </ol>
        </section>
        <section className="nb-card mc-steps">
          <h2 className="nb-h2"><span className="nb-chip tone-peach">Claude</span></h2>
          <ol>
            <li>הגדרות ← <bdi><b>Connectors</b></bdi></li>
            <li>לוחצים <bdi><b>Add custom connector</b></bdi> ומדביקים את הכתובת</li>
            <li>בדף הכניסה של <bdi>Doing</bdi> מזינים את מפתח הגישה</li>
          </ol>
          <p className="mc-note">עובד באתר <bdi>claude.ai</bdi> ובאפליקציה למחשב.</p>
        </section>
      </div>

      <div className="mc-grid">
        <section className="nb-sec">
          <h2 className="nb-h2">מה אפשר לבקש</h2>
          <ul className="mc-list">
            {CAN_DO.map(t => <li key={t}><Icon name="check" size={18} strokeWidth={2.4} /> {t}</li>)}
          </ul>
        </section>
        <section className="nb-sec">
          <h2 className="nb-h2">דוגמאות לשאלות</h2>
          <ul className="mc-prompts">
            {PROMPTS.map(t => <li key={t} className="nb-card">״{t}״</li>)}
          </ul>
        </section>
      </div>

      <section className="mc-facts">
        <div><b>החיבור תקף עד 90 יום.</b> אפשר לנתק בכל רגע מההגדרות של <bdi>ChatGPT</bdi> או <bdi>Claude</bdi>.</div>
        <div><b>פרטיות:</b> אחרי החיבור, נתוני הילדים עוברים לחברת <bdi>OpenAI</bdi> או <bdi>Anthropic</bdi> תחת החשבון שלך.</div>
      </section>
    </div>
  );
}
