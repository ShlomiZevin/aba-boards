import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';
import SlideEmbed from './SlideEmbed';

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
        {/* <SlideShot slideId={16} /> */}
        <SlideEmbed slideId={16} defaultPath="https://startdoing.co.il/board.html?kid=%D7%A2%D7%95%D7%9E%D7%A8" />
      </div>
    </SlideLayout>
  );
}
