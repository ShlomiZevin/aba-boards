import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';
import SlideEmbed from './SlideEmbed';

export default function Slide04_KidCard() {
  return (
    <SlideLayout slideId={4} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">כרטיס הילד</h1>
          <p className="sl-lead">כל המידע על ילד אחד — מקום אחד. נקודת המוצא לכל מה שעושים איתו.</p>
          <ol className="sl-num">
            <li><span>01</span>צוות, הורים, מטרות</li>
            <li><span>02</span>סשנים, טפסים, גרפים</li>
            <li><span>03</span>גישה מהירה לכל פעולה — מילוי, תזמון, עריכה</li>
          </ol>
        </div>
        {/* <SlideShot slideId={4} /> */}
        <SlideEmbed slideId={4} defaultPath="/therapy/" />
      </div>
    </SlideLayout>
  );
}
