import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';
import SlideEmbed from './SlideEmbed';

export default function Slide17_Feedback() {
  return (
    <SlideLayout slideId={17} section="סיום">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">שותפים בתהליך</h1>
          <p className="sl-lead">זה הכלי שלנו — נשמח לשמוע. משוב, פיצ׳רים חסרים, שיפורים. אנחנו זריזים ומגיבים.</p>
          <ol className="sl-num">
            <li><span>01</span>ספרו לנו מה עובד ומה חסר</li>
            <li><span>02</span>שינויים והתאמות — לא חודשים, ימים</li>
            <li><span>03</span>הולכים יחד, בונים יחד</li>
          </ol>
        </div>
        {/* <SlideShot slideId={17} /> */}
        <SlideEmbed slideId={17} defaultPath="/therapy/" />
      </div>
    </SlideLayout>
  );
}
