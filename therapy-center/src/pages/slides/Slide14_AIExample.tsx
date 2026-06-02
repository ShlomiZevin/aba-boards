import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';
import SlideEmbed from './SlideEmbed';

export default function Slide14_AIExample() {
  return (
    <SlideLayout slideId={14} section="עוזרת AI">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">דוגמה — סיכום בלחיצה</h1>
          <p className="sl-lead">״סכמי לי את 3 השבועות האחרונים של יואב.״ זהו — היא קוראת את כל הסשנים, הנתונים והמטרות, ומחזירה סיכום מקצועי מוכן לשליחה.</p>
          <ol className="sl-num">
            <li><span>01</span>בוחרים ילד וטווח תאריכים</li>
            <li><span>02</span>היא קוראת את כל הסשנים והנתונים בטווח</li>
            <li><span>03</span>סיכום מוכן — אפשר לערוך, לשמור, או לשלוח</li>
          </ol>
        </div>
        {/* <SlideShot slideId={14} /> */}
        <SlideEmbed slideId={14} defaultPath="/therapy/chat" />
      </div>
    </SlideLayout>
  );
}
