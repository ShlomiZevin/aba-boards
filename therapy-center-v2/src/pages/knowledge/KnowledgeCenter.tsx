import { Link } from 'react-router-dom';
import './knowledge.css';
import '../../v2/pages/tm.css';
import { TOPICS } from './topics';
import type { KnowledgeTopic } from './topics';
import Icon, { type IconName } from '../../v2/Icon';
import type { Tone } from '../../v2/kidColor';

// Line icons + marker tones for the catalog (the topics' emoji stay in the data for other uses)
const TOPIC_LOOK: Record<string, { icon: IconName; tone: Tone }> = {
  aba: { icon: 'sparkle', tone: 'lilac' },
  dsm5: { icon: 'target', tone: 'sky' },
  'staff-training': { icon: 'team', tone: 'mint' },
  play: { icon: 'blocks', tone: 'yellow' },
  'problem-solving': { icon: 'chart', tone: 'peach' },
  learning: { icon: 'book', tone: 'pink' },
  rapport: { icon: 'user', tone: 'mint' },
};

function TopicCard({ t }: { t: KnowledgeTopic }) {
  const look = TOPIC_LOOK[t.id] || { icon: 'book' as IconName, tone: 'lilac' as Tone };
  return (
    <Link className={`kc-card${t.ready ? '' : ' is-soon'}`} to={t.to}>
      <span className={`kc-ic tone-${look.tone}`}><Icon name={look.icon} size={26} /></span>
      <h3 className="kc-card-title">{t.title}</h3>
      {t.ready ? <span className="kc-go"><Icon name="chevron" /></span> : <span className="kc-go kc-soon">בקרוב</span>}
      <p className="kc-card-desc">{t.desc}</p>
    </Link>
  );
}

// Knowledge Center hub — catalog of guides and reference material.
export default function KnowledgeCenter() {
  const ready = TOPICS.filter(t => t.ready);
  const soon = TOPICS.filter(t => !t.ready);
  return (
    <div className="kc">
      <div className="kc-hero">
        <span className="kc-eyebrow">Doing · ידע</span>
        <h1 className="kc-title">מרכז ה<mark className="hl-yellow">ידע</mark></h1>
        <p className="kc-sub">חומרי הדרכה והסבר על שיטת ה-ABA — מוכנים להצגה ולשיתוף עם הורים וצוות.</p>
      </div>

      <section className="kc-sec">
        <h2 className="nb-h2">מוכן להצגה</h2>
        <div className="kc-grid">
          {ready.map(t => <TopicCard key={t.id} t={t} />)}
        </div>
      </section>

      {soon.length > 0 && (
        <section className="kc-sec">
          <h2 className="nb-h2">בהכנה</h2>
          <div className="kc-grid">
            {soon.map(t => <TopicCard key={t.id} t={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}
