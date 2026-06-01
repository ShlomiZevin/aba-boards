import SlideLayout from './SlideLayout';
import SlideShot from './SlideShot';

export default function Slide03_AddKid() {
  return (
    <SlideLayout slideId={3} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">הוספת ילד חדש</h1>
          <p className="sl-lead">ילד חדש מתחיל כאן. פרטים בסיסיים — ויש כרטיס מוכן.</p>
          <ol className="sl-num">
            <li><span>01</span>שם, גיל, מין, תמונה</li>
            <li><span>02</span>שיוך הורים ומטפלות</li>
            <li><span>03</span>כרטיס הילד נפתח אוטומטית</li>
          </ol>
        </div>
        <SlideShot slideId={3} />
      </div>
    </SlideLayout>
  );
}
