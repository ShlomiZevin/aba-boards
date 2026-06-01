import SlideLayout from './SlideLayout';
import SlideShot from './SlideShot';

export default function Slide09_Plans() {
  return (
    <SlideLayout slideId={9} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">תוכניות מעקב ולמידה</h1>
          <p className="sl-lead">לכל ילד בונים תוכניות — מה עוקבים, מה לומדים, ואיך.</p>
          <ol className="sl-num">
            <li><span>01</span>תוכניות מעקב — איזה מטרות, ואיזה התקדמות צופים</li>
            <li><span>02</span>תוכניות למידה — שלבים, צעדים, פירוק משימה</li>
            <li><span>03</span>הכל מתחבר לטופס הסשן ולגרפים</li>
          </ol>
        </div>
        <SlideShot slideId={9} />
      </div>
    </SlideLayout>
  );
}
