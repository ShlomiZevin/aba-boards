import { Link } from 'react-router-dom';
import './knowledge.css';
import { TOPICS } from './topics';

// Knowledge Center hub — catalog of guides and reference material.
export default function KnowledgeCenter() {
  return (
    <div className="kc">
      <div className="kc-hero">
        <span className="kc-eyebrow">Doing · ידע</span>
        <h1 className="kc-title">מרכז הידע</h1>
        <p className="kc-sub">חומרי הדרכה והסבר על שיטת ה-ABA — מוכנים להצגה ולשיתוף עם הורים וצוות.</p>
      </div>

      <div className="kc-grid">
        {TOPICS.map(t => (
          <Link className="kc-card" key={t.id} to={t.to}>
            <div className="kc-card-emoji">{t.emoji}</div>
            <h2 className="kc-card-title">{t.title}</h2>
            <p className="kc-card-desc">{t.desc}</p>
            <span className="kc-card-cta">פתח ←</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
