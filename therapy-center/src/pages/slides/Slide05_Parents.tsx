import SlideLayout from './SlideLayout';
import SlideShot from './SlideShot';

export default function Slide05_Parents() {
  return (
    <SlideLayout slideId={5} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">הורים — פרטים וגישה</h1>
          <p className="sl-lead">כל ילד יכול לקבל הורה אחד או שניים, וגישת קריאה אישית.</p>
          <ol className="sl-num">
            <li><span>01</span>שם, טלפון, אימייל</li>
            <li><span>02</span>קישור אישי — בלי הרשמה, בלי סיסמה</li>
            <li><span>03</span>הורה רואה התקדמות וטפסים, בקריאה בלבד</li>
          </ol>
        </div>
        <SlideShot slideId={5} />
      </div>
    </SlideLayout>
  );
}
