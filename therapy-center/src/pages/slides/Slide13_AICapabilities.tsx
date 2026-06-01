import SlideLayout from './SlideLayout';
import SlideShot from './SlideShot';

export default function Slide13_AICapabilities() {
  return (
    <SlideLayout slideId={13} section="עוזרת AI">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">מה היא יודעת לעשות</h1>
          <p className="sl-lead">שיחה רגילה בעברית. היא תפעיל את הכלים הנכונים מאחורי הקלעים.</p>
          <ol className="sl-num">
            <li><span>01</span>סיכומים תקופתיים — שבוע, חודש, או טווח שתבחר</li>
            <li><span>02</span>יצירת טפסים, מטרות ולוחות — בבקשה אחת</li>
            <li><span>03</span>ניתוח נתונים וייעוץ מקצועי ב-ABA</li>
          </ol>
        </div>
        <SlideShot slideId={13} />
      </div>
    </SlideLayout>
  );
}
