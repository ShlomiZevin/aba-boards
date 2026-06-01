import SlideLayout from './SlideLayout';
import SlideShot from './SlideShot';

export default function Slide16_Dino() {
  return (
    <SlideLayout slideId={16} section="לוחות + דינו">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">דינו — חבר AI שמדבר עם הילד</h1>
          <p className="sl-lead">דינוזאור שעונה בקול, מכיר את המשימות של הילד, ומעודד אותו ברגעים הנכונים.</p>
          <ol className="sl-num">
            <li><span>01</span>הילד מדבר — דינו מקשיב ועונה</li>
            <li><span>02</span>חוויה לילד, נתונים למרכז</li>
          </ol>
        </div>
        <SlideShot slideId={16} />
      </div>
    </SlideLayout>
  );
}
