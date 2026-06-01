import type { ComponentType } from 'react';

import Slide01_Cover from './Slide01_Cover';
import Slide02_KidsDashboard from './Slide02_KidsDashboard';
import Slide03_AddKid from './Slide03_AddKid';
import Slide04_KidCard from './Slide04_KidCard';
import Slide05_Parents from './Slide05_Parents';
import Slide06_Practitioners from './Slide06_Practitioners';
import Slide07_Sessions from './Slide07_Sessions';
import Slide08_SessionForm from './Slide08_SessionForm';
import Slide09_Plans from './Slide09_Plans';
import Slide10_DataCollection from './Slide10_DataCollection';
import Slide11_OtherMenu from './Slide11_OtherMenu';
import Slide12_AIOverview from './Slide12_AIOverview';
import Slide13_AICapabilities from './Slide13_AICapabilities';
import Slide14_AIExample from './Slide14_AIExample';
import Slide15_Boards from './Slide15_Boards';
import Slide16_Dino from './Slide16_Dino';
import Slide17_End from './Slide17_End';

export interface SlideMeta {
  id: number;
  section: string;
  title: string;
  Component: ComponentType;
}

export interface SectionMeta {
  name: string;
  range: [number, number];
  brief?: boolean;
  pending?: boolean;
}

export const SECTIONS: SectionMeta[] = [
  { name: 'מרכז הטיפול',  range: [2, 11] },
  { name: 'עוזרת AI',      range: [12, 14] },
  { name: 'לוחות + דינו',  range: [15, 16], brief: true },
  { name: 'סיום',           range: [17, 17] },
];

export function sectionOf(id: number): string {
  const s = SECTIONS.find(s => id >= s.range[0] && id <= s.range[1]);
  return s ? s.name : '';
}

export const SLIDES: SlideMeta[] = [
  { id: 1,  section: '',                 title: 'Doing — סיור במערכת',              Component: Slide01_Cover },
  { id: 2,  section: 'מרכז הטיפול',     title: 'דשבורד הילדים',                     Component: Slide02_KidsDashboard },
  { id: 3,  section: 'מרכז הטיפול',     title: 'הוספת ילד חדש',                      Component: Slide03_AddKid },
  { id: 4,  section: 'מרכז הטיפול',     title: 'כרטיס הילד',                          Component: Slide04_KidCard },
  { id: 5,  section: 'מרכז הטיפול',     title: 'הורים — פרטים וגישה',                Component: Slide05_Parents },
  { id: 6,  section: 'מרכז הטיפול',     title: 'אנשי צוות',                            Component: Slide06_Practitioners },
  { id: 7,  section: 'מרכז הטיפול',     title: 'סשנים ולוח פגישות',                  Component: Slide07_Sessions },
  { id: 8,  section: 'מרכז הטיפול',     title: 'מילוי טופס סשן',                       Component: Slide08_SessionForm },
  { id: 9,  section: 'מרכז הטיפול',     title: 'תוכניות מעקב ולמידה',                 Component: Slide09_Plans },
  { id: 10, section: 'מרכז הטיפול',     title: 'טופס איסוף נתונים',                    Component: Slide10_DataCollection },
  { id: 11, section: 'מרכז הטיפול',     title: 'שאר התפריט — טפסים · שעות · הודעות', Component: Slide11_OtherMenu },
  { id: 12, section: 'עוזרת AI',         title: 'מכירה את הילד',                       Component: Slide12_AIOverview },
  { id: 13, section: 'עוזרת AI',         title: 'מה היא יודעת לעשות',                  Component: Slide13_AICapabilities },
  { id: 14, section: 'עוזרת AI',         title: 'דוגמה — סיכום בלחיצה',                Component: Slide14_AIExample },
  { id: 15, section: 'לוחות + דינו',    title: 'לוחות לילדים',                        Component: Slide15_Boards },
  { id: 16, section: 'לוחות + דינו',    title: 'דינו — חבר AI',                        Component: Slide16_Dino },
  { id: 17, section: 'סיום',              title: 'תודה',                                Component: Slide17_End },
];

export function slidesInSection(sec: SectionMeta) {
  return SLIDES.filter(s => s.id >= sec.range[0] && s.id <= sec.range[1]);
}
