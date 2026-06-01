import SlideLayout from './SlideLayout';

const LOGO_URL = '/therapy/doing-logo-transparent2.png';

export default function Slide01_Cover() {
  return (
    <SlideLayout slideId={1} section="" variant="cover">
      <div className="sl-cover">
        <img src={LOGO_URL} alt="Doing" className="sl-cover-logo" />
        <h1 className="sl-cover-h1">סיור במערכת</h1>
        <p className="sl-cover-sub">ניהול טיפול ABA + לוחות לילדים</p>
      </div>
    </SlideLayout>
  );
}
