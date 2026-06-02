import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';
import SlideEmbed from './SlideEmbed';

export default function Slide10_DataCollection() {
  return (
    <SlideLayout slideId={10} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">טופס איסוף נתונים</h1>
          <p className="sl-lead">לכל מטרה בוחרים איך אוספים נתונים — ניסיונות, הצלחות, אחוזים, סקאלה.</p>
          <ol className="sl-num">
            <li><span>01</span>מגדירים פעם אחת — שדות, סוג נתון, יחידה</li>
            <li><span>02</span>המטפלת מזינה את הנתונים תוך כדי הסשן</li>
            <li><span>03</span>הופך אוטומטית לגרף ולמדד התקדמות</li>
          </ol>
        </div>
        {/* <SlideShot slideId={10} /> */}
        <SlideEmbed slideId={10} defaultPath="/therapy/" />
      </div>
    </SlideLayout>
  );
}
