import {autonomousCooperationReady} from './cooperation.js';
import {islandOf,sameSide} from './island.js';
import {projectComplete} from './settlements.js';
import {environmentProfile,migrationPreference,migrationCooldownRemaining,MIGRATION_MIN_ADVANTAGE} from './island-preferences.js';
import {islandDefinition} from './civilization.js';

const interests={starVoyage:'explore',buildUfo1:'research',buildUfo2:'research',buildUfo3:'research',prepareRations:'cook',spaceResearch:'research',voyage:'explore',lightGrow:'garden',lightParty:'chat',lightDaily:'relax',releaseBugs:'garden',catchBugs:'garden',traceRelic:'research',decodeRelic:'research',decodeTogether:'research',restoreMemory:'research',tuneInsight:'research',tuneSleep:'relax',activateCrystal:'research',passOrb:'chat',chaseOrb:'dance',sootheOrb:'chat',lounge:'chat',joke:'chat',gift:'chat',flirt:'chat',travel:'explore'};
const specialties={starVoyage:'science',buildUfo1:'science',buildUfo2:'science',buildUfo3:'science',prepareRations:'cooking',spaceResearch:'science',voyage:'science',lightGrow:'botany',catchBugs:'botany',releaseBugs:'botany',traceRelic:'science',decodeRelic:'science',decodeTogether:'science',restoreMemory:'science',tuneInsight:'science',tuneSleep:'science',activateCrystal:'science',passOrb:'social',lounge:'social',sootheOrb:'social',gift:'social',flirt:'social',travel:'science'};
export function actionPreference(p,type){return p.position.preferences[type]??(p.position.preferences[interests[type]]||0)*.65;}
const near=(a,b,r)=>sameSide(a,b)&&Math.hypot(a.x-b.x,a.z-b.z)<=r;
const residentsOn=(people,island)=>people.filter(person=>islandOf(person.position)===island).length;
const hasSettlementEssentials=(g,position)=>['food','pod','shower'].every(type=>g.objects.some(o=>sameSide(o,position)&&o.type===type));
export function autonomyBonus(g,p,c,people){
 const o=g.objects.find(o=>o.id===c.targetId),type=c.type,now=(g.day-1)*1440+g.minute;
 let bonus=specialties[type]?Math.min(10,p.skills[specialties[type]]*.3):0;
 if(type==='pray')bonus+=p.position.devotion*.35;
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
 if(type==='prepareRations'){if((g.space.provisions[islandOf(p.position)]??0)>=24)return null;bonus+=15;}
 if(type==='extractMaterials'){if((g.space.materials[islandOf(p.position)]??0)>=120)return null;bonus+=70;}
 if(type.startsWith('buildUfo')){const tier=Number(type.at(-1));if(g.space.ships.some(s=>s.island===islandOf(p.position)&&s.tier>=tier)||people.some(n=>n!==p&&n.queue.some(q=>q.type===type)))return null;bonus+=10;}
 if(type==='developBlueprint'||type==='constructIsland'){if(Math.min(p.needs.energy,p.needs.hunger)<40)return null;bonus+=22;}
 if(type==='settleIsland'){
  const targetId=islandOf(p.position),currentId=p.position.homeIsland??'home',now=(g.day-1)*1440+g.minute;
  if(targetId===currentId||migrationCooldownRemaining(p.position,now)>0)return null;
  const preference=migrationPreference(p,targetId,environmentProfile(targetId,islandDefinition(g,targetId)),currentId,environmentProfile(currentId,islandDefinition(g,currentId)));
  if(preference.advantage<MIGRATION_MIN_ADVANTAGE)return null;
  bonus+=4+Math.min(10,(preference.advantage-MIGRATION_MIN_ADVANTAGE)*.3);
 }
 if(type==='voyage'||type==='starVoyage'){
  const lowestNeed=Math.min(...Object.values(p.needs)),current=islandOf(p.position),home=p.position.homeIsland??'home',remote=current!==home;
  const unfinishedReturn=remote&&c.destinationId===home&&!projectComplete(g,current);
  if(p.queue.some(q=>['voyage','boardUfo'].includes(q.type))||!unfinishedReturn&&['voyage','starVoyage'].includes(p.ai.lastAction))return null;
  if(c.destinationId===home){
   if(unfinishedReturn)bonus+=lowestNeed<40?70:50;
   else if(remote&&current!=='home'&&hasSettlementEssentials(g,p.position)){if(lowestNeed>=12)return null;bonus+=36;}
   else bonus+=lowestNeed<25?36:12;
  }else{
   if(remote)return null;
   if(lowestNeed<55)return null;
   const residents=residentsOn(people,c.destinationId);bonus+=residents===0?28:residents<2?18:8;
  }
 }
 if(['passOrb','decodeTogether'].includes(type))bonus+=6;
 if(type==='lounge'&&!people.some(n=>n.id!==p.id&&sameSide(n.position,p.position)&&n.position.age>=g.config.lifeStages.infantEnd&&n.queue.length<6&&autonomousCooperationReady(g,n)))return null;
 if(type==='travel'){const target=g.objects.find(x=>x.id===c.destinationId);if(!sameSide(o,p.position))return null;if(p.ai.lastAction==='travel')return null;bonus+=people.some(n=>n.id!==p.id&&sameSide(n.position,target)&&n.needs.social<60)?8:1;}
 if(type==='walk'){if(c.point?.side==='back'&&!g.space.backs[islandOf(p.position)])return Math.min(...Object.values(p.needs))<45?null:20+actionPreference(p,'explore');if(p.ai.lastAction==='walk'||Math.min(...Object.values(p.needs))<65)return null;return 1;}
 if(['gift','flirt','joke'].includes(type)){if(p.needs.social>75)return null;if(type==='gift'&&(p.id==='player'?g.money:p.position.money)<150)return null;}
 return bonus;
}
