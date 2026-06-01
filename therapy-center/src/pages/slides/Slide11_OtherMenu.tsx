import SlideLayout from './SlideLayout';
import SlideShot from './SlideShot';

export default function Slide11_OtherMenu() {
  return (
    <SlideLayout slideId={11} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">שאר התפריט</h1>
          <p className="sl-lead">עוד שלושה כלים בתפריט הצד.</p>
          <ol className="sl-num">
            <li><span>01</span>טפסים — מבט-על על כל מה שמולא, פילטרים וחיפוש</li>
            <li><span>02</span>שעות צוות — שעות עבודה, סשנים, נוכחות</li>
            <li><span>03</span>מרכז הודעות — תקשורת פנימית עם הצוות וההורים</li>
          </ol>
        </div>
        <SlideShot slideId={11} />
      </div>
    </SlideLayout>
  );
}
