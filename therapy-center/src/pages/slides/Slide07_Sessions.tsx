import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';
import SlideEmbed from './SlideEmbed';

export default function Slide07_Sessions() {
  return (
    <SlideLayout slideId={7} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">סשנים ולוח פגישות</h1>
          <p className="sl-lead">יומן אחד לכל המרכז — מי מטפל, מתי, ועם איזה ילד.</p>
          <ol className="sl-num">
            <li><span>01</span>תזמון סשן בודד או חוזר</li>
            <li><span>02</span>צבע לכל מטפלת — רואים מי עבד מתי</li>
            <li><span>03</span>תצוגות שבועית וחודשית, סינון לפי מטפלת או ילד</li>
          </ol>
        </div>
        {/* <SlideShot slideId={7} /> */}
        <SlideEmbed slideId={7} defaultPath="/therapy/calendar" />
      </div>
    </SlideLayout>
  );
}
