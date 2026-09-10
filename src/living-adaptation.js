import {livingResident,mutableResident,livingPeople,bondTo,bounded,LIVING_LIMITS} from './living-state.js';
import {isNether,isRadiant} from './prayer.js';

export const IMPRINTS={bloom:'花契',shade:'守影',roots:'根誓'};
export function adaptationCap(p,kind){
 const inclination=kind==='garden'?(p.preferences.garden??0):(p.preferences.observe??0)+(p.preferences.explore??0);
 return Math.min(85,35+Math.round(inclination*1.5)+(kind==='shadow'&&isNether(p)?15:0));
}
export function practiceToday(g,p,kind){
 const practice=mutableResident(g,p).practice[kind];if(practice.day===g.day)return false;
 practice.days=practice.day===g.day-1?Math.min(LIVING_LIMITS.practiceDays,practice.days+1):1;practice.day=g.day;return true;
}
export function adapt(g,p,kind,amount=8){
 const s=mutableResident(g,p),other=kind==='garden'?'shadow':'garden';
 s[kind]=Math.min(adaptationCap(p,kind),bounded(s[kind]+amount));
 s[other]=Math.min(s[other],LIVING_LIMITS.adaptationBudget-s[kind]);
}
export function fadeAdaptation(g,p,days){
 if(!g.living.residents[p.uid])return;
 const s=livingResident(g,p);
 for(const kind of ['garden','shadow'])if(g.day-s.practice[kind].day>2){
  const floor=s.imprint===(kind==='garden'?'bloom':'shade')?24:0;
  s[kind]=Math.max(Math.min(s[kind],floor),s[kind]-6*days);
 }
}
export function awaken(g,p,kind,witnesses){
 const s=mutableResident(g,p);if(s.imprint)return false;
 const people=livingPeople(g),limit=Math.max(1,Math.floor(people.length/8));
 if(people.filter(p=>livingResident(g,p).imprint!==null).length>=limit)return false;
 const track=kind==='bloom'?'garden':kind==='shade'?'shadow':'tree';
 if(s.practice[track].days<5||s.practice[track].day!==g.day)return false;
 if(kind==='roots'?!(isRadiant(p)||isNether(p)):s[track]<55)return false;
 if(witnesses.filter(other=>other.uid!==p.uid&&(bondTo(g,p,other)?.trust??0)>=15).length<(kind==='roots'?2:1))return false;
 s.imprint=kind;g.log.unshift({text:`${p.name}在共同经历中留下永久印记「${IMPRINTS[kind]}」。`,at:g.minute});return true;
}
export function livingSummary(g,p){
 const s=livingResident(g,p);
 return [s.imprint?`永久印记：${IMPRINTS[s.imprint]}`:null,s.garden?`花园适应 ${s.garden} · 活性 ${s.charge}`:null,s.shadow||s.fear?`森林适应 ${s.shadow} · 不安 ${s.fear}`:null].filter(Boolean).join(' · ');
}
export function livingAppearance(s){
 return {buds:s.imprint==='bloom'?2:s.garden>=24?(s.charge>0?2:1):s.garden>=8&&s.charge>0?1:0,mark:s.imprint,shadow:s.imprint==='shade'||s.shadow>=24};
}
