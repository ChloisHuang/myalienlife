import {autonomousCooperationReady} from './cooperation.js';
import {islandOf,sameSide} from './island.js';
import {availableUfo} from './space-logistics.js';
import {projectComplete} from './settlements.js';
import {environmentProfile,environmentFit,migrationPreference,migrationCooldownRemaining,settlementIsland,MIGRATION_MIN_ADVANTAGE,populationPressure,tuning} from './island-preferences.js';
import {islandCatalog,islandDefinition} from './civilization.js';

const interests={starVoyage:'explore',buildUfo1:'research',buildUfo2:'research',buildUfo3:'research',prepareRations:'cook',spaceResearch:'research',voyage:'explore',lightGrow:'garden',lightParty:'chat',lightDaily:'relax',releaseBugs:'garden',catchBugs:'garden',traceRelic:'research',decodeRelic:'research',decodeTogether:'research',restoreMemory:'research',tuneInsight:'research',tuneSleep:'relax',activateCrystal:'research',passOrb:'chat',chaseOrb:'dance',sootheOrb:'chat',lounge:'chat',joke:'chat',gift:'chat',flirt:'chat',travel:'explore'};
const specialties={starVoyage:'science',buildUfo1:'science',buildUfo2:'science',buildUfo3:'science',prepareRations:'cooking',spaceResearch:'science',voyage:'science',lightGrow:'botany',catchBugs:'botany',releaseBugs:'botany',traceRelic:'science',decodeRelic:'science',decodeTogether:'science',restoreMemory:'science',tuneInsight:'science',tuneSleep:'science',activateCrystal:'science',passOrb:'social',lounge:'social',sootheOrb:'social',gift:'social',flirt:'social',travel:'science'};
export function actionPreference(p,type){return p.position.preferences[type]??(p.position.preferences[interests[type]]||0)*.65;}
const near=(a,b,r)=>sameSide(a,b)&&Math.hypot(a.x-b.x,a.z-b.z)<=r;
// Two different populations matter, and they are not the same thing:
//  - settled: how many residents call this island home (their settlement island)
//  - present: how many residents are standing on it right now
// Crowding is felt by the people who are actually there, so presence drives the crowding terms.
const presentResidentsOn=(g,people,island)=>people.filter(person=>islandOf(person.position)===island).length;
const hasSettlementEssentials=(g,position)=>['food','pod','shower'].every(type=>g.objects.some(o=>sameSide(o,position)&&o.type===type));
// Homesickness never replaces the hard return at a critical need; it is the resident's own, gentler wish to go back to their settlement.

// Just-landed residents may fly again, only with a nudge against immediately retracing the trip.
const VOYAGE_REPEAT_PENALTY=tuning('ORBIT_VOYAGE_REPEAT_PENALTY',14);
// How strongly an island's environment lures a resident, discounted by how settled that island
// already is. Everything here is a tendency added to a weighted draw: no island refuses anybody.
const SETTLED_PULL=tuning('ORBIT_ATTRACTION_SCALE',1);
// What a resident weighs a destination against is the settlement they would be giving up, not the
// soil under their feet: they decide on the island itself, so "here" is already the destination.
const islandAttraction=(g,p,island,people)=>SETTLED_PULL*(environmentFit(p.position,environmentProfile(island,islandDefinition(g,island)))-populationPressure(presentResidentsOn(g,people,island),presentResidentsOn(g,people,settlementIsland(g,p.position))));
// Only islands a ship on this side can actually reach: a wish nobody can sail to is not a choice.
const reachableIslands=(g,p)=>Object.entries(islandCatalog(g)).filter(([id,island])=>availableUfo(g,p,island.level,1)&&(g.civilization.visits[id]??0)>0).map(([id])=>id);
// Family and deep bonds make a resident want to be where those people are. Nothing here is tied to
// any particular island: it is read from wherever the resident's own settlement currently is.
const SETTLEMENT_KIN_WEIGHT=10,SETTLEMENT_BOND_WEIGHT=3,SETTLEMENT_BOND_STRENGTH=60,SETTLEMENT_FIT_WEIGHT=8,SETTLEMENT_PULL_CAP=20;
function settlementPull(g,p,people,settlement,current){
 const there=people.filter(person=>islandOf(person.position)===settlement),uid=person=>person.position.uid;
 const relatives=new Set((p.position.parents??[]).map(parent=>parent.uid));
 const kin=there.filter(person=>relatives.has(uid(person))||(person.position.parents??[]).some(parent=>parent.uid===uid(p))).length;
 const relationships=p.id==='player'?g.relationships??{}:p.position.relationships??{};
 const bonds=Object.entries(relationships).filter(([id,score])=>score>=SETTLEMENT_BOND_STRENGTH&&there.some(person=>uid(person)===id)).length;
 const fit=environmentFit(p.position,environmentProfile(settlement,islandDefinition(g,settlement)))-environmentFit(p.position,environmentProfile(current,islandDefinition(g,current)));
 return Math.max(0,Math.min(SETTLEMENT_PULL_CAP,kin*SETTLEMENT_KIN_WEIGHT+bonds*SETTLEMENT_BOND_WEIGHT+(fit>=MIGRATION_MIN_ADVANTAGE?SETTLEMENT_FIT_WEIGHT:0)));
}
// Which island this resident would rather settle on, and how strongly. Environment fit sets the
// baseline and crowding discounts a packed island, so a sprawling settlement slowly stops being
// the best offer. The number is a score, never a permission check: relocationChance() turns it into
// the odds of an actual move.
export function settlementAppeal(g,p,people,island){
 const current=settlementIsland(g,p.position);
 if(island===current)return 0;
 // A resident only weighs living on an island they have actually landed on; the rest are rumours.
 if((g.civilization.visits[island]??0)<=0)return 0;

 const fit=environmentFit(p.position,environmentProfile(island,islandDefinition(g,island)));
 const advantage=fit-environmentFit(p.position,environmentProfile(current,islandDefinition(g,current)))+islandAttraction(g,p,island,people)+balancePull(g,island,reachableIslands(g,p.position),people);
 return advantage>0?advantage:0;
}
// A settled island compares itself with its neighbours: below them it looks roomy and inviting,
// above them it looks full. Expressed per resident-of-the-others so it stays a gentle pull the
// environment can still out-argue, and it is the only term that pushes toward an even spread.
const BALANCE_STRENGTH=tuning('ORBIT_BALANCE_STRENGTH',3),BALANCE_PULL_CAP=tuning('ORBIT_BALANCE_CAP',6);
export function balancePull(g,island,islands,people){
 const here=id=>presentResidentsOn(g,people,id);
 const others=islands.filter(id=>id!==island);
 if(!others.length)return 0;
 const average=others.reduce((sum,id)=>sum+here(id),0)/others.length;
 // Scale by the size of a typical island so the nudge stays a tiebreaker: a two-resident world
 // must not make leaving look more urgent than the resident's own preferences.
 const scaled=BALANCE_STRENGTH*(average-here(island))/(1+average);
 return Math.max(-BALANCE_PULL_CAP,Math.min(BALANCE_PULL_CAP,scaled));
}
// Living somewhere is weighed where a resident can actually feel it: standing on the island they
// just landed on. The chance rises with how much better that island suits them than the settlement
// they would leave, and falls with how crowded it already is, so a packed island is unlikely to win
// a newcomer without ever being refused outright, and a good island still never wins for certain.
const RELOCATION_APPEAL_HALF=tuning('ORBIT_RELOCATION_APPEAL_HALF',40);
export function relocationChance(g,p,people,island){
 const appeal=settlementAppeal(g,p,people,island);
 return appeal<=0?0:appeal/(appeal+RELOCATION_APPEAL_HALF);
}
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
  const targetId=c.destinationId??islandOf(o),currentId=settlementIsland(g,p.position),now=(g.day-1)*1440+g.minute;
  if(targetId===currentId||migrationCooldownRemaining(p.position,now)>0)return null;
  const appeal=settlementAppeal(g,p,people,targetId);
  if(!appeal)return null;
  bonus+=4+Math.min(10,appeal*.6);
 }
 if(type==='voyage'||type==='starVoyage'){
  const lowestNeed=Math.min(...Object.values(p.needs)),current=islandOf(p.position),settlement=settlementIsland(g,p.position),remote=current!==settlement;
  const unfinishedReturn=remote&&c.destinationId===settlement&&!projectComplete(g,current);
  if(p.queue.some(q=>['voyage','boardUfo'].includes(q.type)))return null;
  // Repeating the same errand is mildly discouraged elsewhere; a voyage used to be forbidden
  // outright after any earlier flight, which stranded whoever had just landed somewhere.
  if(!unfinishedReturn&&['voyage','starVoyage'].includes(p.ai.lastAction))bonus-=VOYAGE_REPEAT_PENALTY;
  // One rule for every island. `settlement` is only ever the resident's own settlement island, and
  // the destination is judged by what it is, never by whether it happens to be the original island.
  const goingToSettlement=c.destinationId===settlement;
  // Standing on your own island means a trip away is a move, not a return, so it needs a real
  // reason; a resident who is away may always head back, but only with one.
  if(goingToSettlement){
   // Heading back to your own settlement always needs a reason: standing there already, being fine,
   // or having no ties all mean there is nothing to go back for.
   if(!remote)return null;
   if(unfinishedReturn)bonus+=lowestNeed<40?70:50;
   else{
    const pull=settlementPull(g,p,people,settlement,current);
    if(lowestNeed>=12&&!pull)return null;
    bonus+=lowestNeed<12?36:pull;
   }
  }else{
   // Every other island is judged the same way, whoever it belongs to: an unfinished island is a
   // work site anyone may sail to, and a finished one is a place to visit or to make a new home.
   // Nothing here depends on which island it is.
   if(lowestNeed<25)return null;
   const finished=projectComplete(g,c.destinationId);
   const appeal=finished?settlementAppeal(g,p,people,c.destinationId):0;
   // Away from their own settlement, a resident sails on only for a destination that could become a
   // better home, or to leave a work site they are only visiting; otherwise the trip that matters is
   // the way back. This reads the destination and their own settlement, never an island's name.
   if(remote&&(!projectComplete(g,current)||appeal<=0))return null;
   if(appeal>0)bonus+=appeal;
   else{
    const residents=presentResidentsOn(g,people,c.destinationId);
    bonus+=residents===0?28:residents<2?18:8;
   }
  }
 }
 if(['passOrb','decodeTogether'].includes(type))bonus+=6;
 if(type==='lounge'&&!people.some(n=>n.id!==p.id&&sameSide(n.position,p.position)&&n.position.age>=g.config.lifeStages.infantEnd&&n.queue.length<6&&autonomousCooperationReady(g,n)))return null;
 if(type==='travel'){const target=g.objects.find(x=>x.id===c.destinationId);if(!sameSide(o,p.position))return null;if(p.ai.lastAction==='travel')return null;bonus+=people.some(n=>n.id!==p.id&&sameSide(n.position,target)&&n.needs.social<60)?8:1;}
 if(type==='walk'){if(c.point?.side==='back'&&!g.space.backs[islandOf(p.position)])return Math.min(...Object.values(p.needs))<45?null:20+actionPreference(p,'explore');if(p.ai.lastAction==='walk'||Math.min(...Object.values(p.needs))<65)return null;return 1;}
 if(['gift','flirt','joke'].includes(type)){if(p.needs.social>75)return null;if(type==='gift'&&(p.id==='player'?g.money:p.position.money)<150)return null;}
 return bonus;
}
