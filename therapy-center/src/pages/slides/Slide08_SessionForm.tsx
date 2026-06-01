import SlideLayout from './SlideLayout';
import SlideShot from './SlideShot';

export default function Slide08_SessionForm() {
  return (
    <SlideLayout slideId={8} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">מילוי טופס סשן</h1>
          <p className="sl-lead">אחרי הסשן ממלאים. שיתוף פעולה, מצב רוח, מה עבדנו עליו, הערות.</p>
          <ol className="sl-num">
            <li><span>01</span>סעיפים מותאמים אישית לכל ילד</li>
            <li><span>02</span>סימון מטרות שעבדנו עליהן בסשן</li>
            <li><span>03</span>שמירה אוטומטית — אפשר לחזור ולערוך</li>
          </ol>
        </div>
        <SlideShot slideId={8} />
      </div>
    </SlideLayout>
  );
}
