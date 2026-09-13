import * as sim from './simulation.js';
import {loadShipFood,loadShipMaterials,unloadShipMaterials,removeUfo} from './space-logistics.js';
import {islandCatalog} from './civilization.js';
import {SIDES} from './island.js';
import {SKILLS} from './characters.js';

const invalid=()=>{throw Object.assign(new Error('无效的操作参数'),{status:400});};
const string=v=>typeof v==='string'&&v.length>0&&v.length<=160;
const number=v=>Number.isFinite(v);
const nullable=v=>v==null||string(v);
const bool=v=>typeof v==='boolean';
const id=v=>Number.isSafeInteger(v)&&v>0;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const point=v=>v==null||object(v)&&number(v.x)&&number(v.z)&&Object.keys(v).every(k=>['x','z'].includes(k));
const spec={
 enqueue:[[v=>string(v)&&Object.hasOwn(sim.ACTIONS,v),nullable,point,nullable,nullable,v=>v==null||Array.isArray(v)&&v.length<=24&&v.every(string),nullable],1,(g,type,target,position,partner,destination,passengers,ship)=>sim.enqueue(g,type,target,position??undefined,partner??null,destination??null,passengers??[],ship??null)],
 enqueueStudy:[[],0,sim.enqueueStudy],cancelAction:[[id],1,sim.cancelAction],
 buyItem:[[string,number,number,number],3,sim.buyItem],sellItem:[[string],1,sim.sellItem],removeUfo:[[string],1,removeUfo],
 setCareer:[[v=>string(v)&&Object.hasOwn(sim.CAREERS,v)],1,sim.setCareer],setAutonomy:[[bool],1,sim.setAutonomy],
 switchControl:[[string],1,sim.switchControl],takeOver:[[string],1,sim.takeOver],
 destroyIsland:[[string],1,sim.destroyIsland],randomizeHeads:[[],0,sim.randomizeHeads],
 updateResident:[[string,object],2,sim.updateResident],
 loadShipFood:[[string],1,loadShipFood],loadShipMaterials:[[string,number],2,loadShipMaterials],unloadShipMaterials:[[string],1,unloadShipMaterials],
 speed:[[v=>[0,1,3].includes(v)],1,(g,v)=>{g.speed=v;}],
 config:[[object],1,(g,v)=>{const c=sim.normalizeConfig(v);if(!sim.validConfig(c))invalid();g.config=c;}],
 studyFocus:[[v=>v===null||Object.hasOwn(SKILLS,v)],1,(g,v)=>{g.player.education.focus=v;}],
 familyDesire:[[string,v=>number(v)&&v>=0&&v<=1],2,(g,id,v)=>{if(id!=='player'&&!Object.hasOwn(g.npcs,id))invalid();const person=id==='player'?g.player:g.npcs[id];person.familyDesire=v;}]
};

export function applyCommand(g,command){
 if(!object(command)||!Object.hasOwn(spec,command.name)||!Array.isArray(command.args))invalid();
 const [checks,min,run]=spec[command.name],args=command.args;
 if(args.length<min||args.length>checks.length||args.some((v,i)=>!checks[i](v)))invalid();
 if(command.view){const v=command.view;if(!object(v)||!Object.hasOwn(islandCatalog(g),v.island)||!Object.hasOwn(SIDES,v.side))invalid();}
 const previous={island:g.viewIsland,side:g.viewSide};
 if(command.view){g.viewIsland=command.view.island;g.viewSide=command.view.side;}
 try{const result=run(g,...args);return result===false?{ok:false,message:'当前状态无法执行这个操作。'}:result&&typeof result==='object'?result:{ok:true};}
 finally{if(command.view&&!['switchControl','takeOver','destroyIsland'].includes(command.name)){g.viewIsland=previous.island;g.viewSide=previous.side;}}
}
