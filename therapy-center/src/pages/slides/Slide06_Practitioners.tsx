import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';
import SlideEmbed from './SlideEmbed';

export default function Slide06_Practitioners() {
  return (
    <SlideLayout slideId={6} section="מרכז הטיפול">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">אנשי צוות</h1>
          <p className="sl-lead">מנהלים את כל המטפלות במרכז ומשייכים אותן לילדים.</p>
          <ol className="sl-num">
            <li><span>01</span>פרופיל לכל מטפלת — תפקיד, מומחיות, פרטי קשר</li>
            <li><span>02</span>שיוך לילדים — מי מטפלת במי</li>
            <li><span>03</span>גישה אישית — היא רואה רק את הילדים שלה</li>
          </ol>
        </div>
        {/* <SlideShot slideId={6} /> */}
        <SlideEmbed slideId={6} defaultPath="/therapy/practitioners" />
      </div>
    </SlideLayout>
  );
}
