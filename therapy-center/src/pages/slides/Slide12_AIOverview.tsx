import SlideLayout from './SlideLayout';
// import SlideShot from './SlideShot';
import SlideEmbed from './SlideEmbed';

export default function Slide12_AIOverview() {
  return (
    <SlideLayout slideId={12} section="עוזרת AI">
      <div className="sl-split">
        <div className="sl-split-text">
          <h1 className="sl-h1">עוזרת AI שמכירה את הילד</h1>
          <p className="sl-lead">לא צ׳אט גנרי. מחוברת לכל הנתונים שלכם — סשנים, טפסים, מטרות, צוות.</p>
          <ol className="sl-num">
            <li><span>01</span>קוראת כל סשן וכל טופס — של כל ילד</li>
            <li><span>02</span>יודעת מי המטפלות, מי ההורים, ומה התוכניות</li>
            <li><span>03</span>עונה בעברית טבעית — כמו עוזרת מנהלית 24/7</li>
          </ol>
        </div>
        {/* <SlideShot slideId={12} /> */}
        <SlideEmbed slideId={12} defaultPath="/therapy/chat" />
      </div>
    </SlideLayout>
  );
}
