import {sameSide} from './island.js';

const interests={spaceResearch:'research',voyage:'explore',lightGrow:'garden',lightParty:'chat',lightDaily:'relax',releaseBugs:'garden',catchBugs:'garden',traceRelic:'research',decodeRelic:'research',decodeTogether:'research',restoreMemory:'research',memoryExpedition:'observe',tuneInsight:'research',tuneSleep:'relax',activateCrystal:'research',passOrb:'chat',chaseOrb:'dance',sootheOrb:'chat',lounge:'chat',joke:'chat',gift:'chat',flirt:'chat',travel:'explore'};
const specialties={spaceResearch:'science',voyage:'science',lightGrow:'botany',catchBugs:'botany',releaseBugs:'botany',traceRelic:'science',decodeRelic:'science',decodeTogether:'science',restoreMemory:'science',memoryExpedition:'science',tuneInsight:'science',tuneSleep:'science',activateCrystal:'science',passOrb:'social',lounge:'social',sootheOrb:'social',gift:'social',flirt:'social',travel:'science'};
export function actionPreference(p,type){return p.position.preferences[type]??(p.position.preferences[interests[type]]||0)*.65;}
const near=(a,b,r)=>sameSide(a,b)&&Math.hypot(a.x-b.x,a.z-b.z)<=r;
export function autonomyBonus(g,p,c,people){
 const o=g.objects.find(o=>o.id===c.targetId),type=c.type,now=(g.day-1)*1440+g.minute;
 let bonus=specialties[type]?Math.min(10,p.skills[specialties[type]]*.3):0;
 if(['lightDaily','lightGrow','lightParty'].includes(type)){
  const grow=g.objects.some(x=>x.plant?.health>0&&x.plant.health<90&&near(x,o,9)),party=people.filter(n=>near(n.position,o,9)&&n.needs.social<65).length>=2;
  const desired=grow?'lightGrow':party?'lightParty':'lightDaily';if(type!==desired)return null;bonus+=grow?12:party?8:1;
 }
 if(['tuneSleep','tuneInsight'].includes(type)){
  if(now<o.wonder.retuneAfter)return null;
  const tired=people.some(n=>near(n.position,o,5)&&n.needs.energy<35),research=g.objects.some(x=>x.type==='lab'&&near(x,o,5));
  if(type!==(research&&!tired?'tuneInsight':'tuneSleep'))return null;bonus+=8;
 }
 if(type==='activateCrystal'){if(!g.objects.some(x=>x.type===(o.wonder.mode==='sleep'?'pod':'lab')&&near(x,o,5)))return null;bonus+=18;}
 if(type==='releaseBugs'){if(g.wonders.dust<2)bonus-=12;bonus+=people.filter(n=>near(n.position,o,6)&&n.needs.fun<70).length*3;}
 if(type==='memoryExpedition')bonus+=14;
 if(type==='voyage'){if(p.ai.lastAction==='voyage')return null;if(c.destinationId==='home')bonus+=Math.min(...Object.values(p.needs))<50?30:2;else {if(Math.min(...Object.values(p.needs))<55)return null;bonus+=5;}}
 if(['passOrb','decodeTogether'].includes(type))bonus+=6;
 if(type==='lounge'&&!people.some(n=>n.id!==p.id&&sameSide(n.position,p.position)&&n.position.age>=g.config.lifeStages.infantEnd&&n.queue.length<6))return null;
 if(type==='travel'){const target=g.objects.find(x=>x.id===c.destinationId);if(!sameSide(o,p.position))return null;if(p.ai.lastAction==='travel')return null;bonus+=people.some(n=>n.id!==p.id&&sameSide(n.position,target)&&n.needs.social<60)?8:1;}
 if(type==='walk'){if(p.ai.lastAction==='walk'||Math.min(...Object.values(p.needs))<65)return null;return 1;}
 if(['gift','flirt','joke'].includes(type)){if(p.needs.social>75)return null;if(type==='gift'&&(p.id==='player'?g.money:p.position.money)<150)return null;}
 return bonus;
}
