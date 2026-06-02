import SlideLayout from './SlideLayout';

const LOGO_URL = '/therapy/doing-logo-transparent2.png';

export default function Slide18_End() {
  return (
    <SlideLayout slideId={18} section="" variant="closing">
      <div className="sl-cover">
        <img src={LOGO_URL} alt="Doing" className="sl-cover-logo" />
        <h1 className="sl-cover-h1">תודה</h1>
        <p className="sl-cover-sub">שאלות? בואו נדבר.</p>
      </div>
    </SlideLayout>
  );
}
