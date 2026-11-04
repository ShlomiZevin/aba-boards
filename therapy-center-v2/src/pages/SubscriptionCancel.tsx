import { useNavigate } from 'react-router-dom';
import Icon from '../v2/Icon';
import '../v2/pages/dr-admin.css';

const BASE = import.meta.env.BASE_URL;

export default function SubscriptionCancel() {
  const navigate = useNavigate();

  return (
    <div className="dr-status-page" dir="rtl">
      <div className="dr-status-card nb-card nb-tape">
        <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="dr-status-logo" />
        <span className="dr-status-ico tone-yellow" aria-hidden><Icon name="back" size={34} /></span>
        <h2 className="dr-status-title">התשלום בוטל</h2>
        <p className="dr-status-text">לא בוצע חיוב. תוכל לשדרג בכל עת.</p>
        <button type="button" onClick={() => navigate('/')} className="nb-btn block">
          חזרה
        </button>
      </div>
    </div>
  );
}
