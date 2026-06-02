import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';
import SlideEmbed from './SlideEmbed';

export default function Slide15_Boards() {
  return (
    <SlideLayout slideId={15} section="לוחות + דינו">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">לוחות לילדים</h1>
          <p className="sl-lead">לוח משימות יומי לילד — תגמולים, אמוג׳ים, שגרה. מתחבר ישירות למרכז הטיפול.</p>
          <ol className="sl-num">
            <li><span>01</span>בונים לבד בקליקים — או ה-AI בונה</li>
            <li><span>02</span>או שאנחנו עוזרים לכם להתחיל</li>
          </ol>
        </div>
        {/* <SlideShot slideId={15} /> */}
        <SlideEmbed slideId={15} defaultPath="/therapy/board-builder" />
      </div>
    </SlideLayout>
  );
}
