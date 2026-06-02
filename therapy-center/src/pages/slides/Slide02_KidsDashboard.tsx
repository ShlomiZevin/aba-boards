import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';   // ← static upload version (kept for fallback)
import SlideEmbed from './SlideEmbed';

export default function Slide02_KidsDashboard() {
  return (
    <SlideLayout slideId={2} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">דשבורד הילדים</h1>
          <p className="sl-lead">המסך הראשי. רשימת כל הילדים שלך וגישה מהירה לכל מסך.</p>
          <ol className="sl-num">
            <li><span>01</span>כרטיסי ילדים — תמונה, שם, סטטוס</li>
            <li><span>02</span>התראות על סשנים וטפסים שמחכים</li>
            <li><span>03</span>כניסה לכרטיס ילד בקליק אחד</li>
          </ol>
        </div>
        {/* <SlideShot slideId={2} /> */}
        <SlideEmbed slideId={2} defaultPath="/therapy/" />
      </div>
    </SlideLayout>
  );
}
