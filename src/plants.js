export const CROPS={garden:{key:'spores',name:'发光孢子',minutes:360,yield:3,price:18,giantChance:3},mushroom:{key:'mushrooms',name:'星伞菇',minutes:720,yield:2,price:25,giantChance:3}};
export const cropVisualScale=(growth,giant)=> (.3+growth*.7)*(giant?2:1);
export const createPlant=()=>({growth:.15,water:75,health:100,harvests:0,giant:false});
export function plantStatus(o){const p=o.plant;return p.health<=0?'枯萎':p.growth>=1?(p.giant?'巨型成熟可收获':'成熟可收获'):p.water<25?'缺水':p.growth<.35?'幼苗':p.growth<.75?'生长中':'开花结实';}
export function advancePlants(objects,minutes,crops=CROPS,random=Math.random){
 for(const o of objects){if(!crops[o.type])continue;const p=o.plant;if(p.health<=0)continue;const before=p.growth;const watered=Math.min(minutes,p.water/.06);p.water=Math.max(0,p.water-minutes*.06);p.growth=Math.min(1,p.growth+watered/crops[o.type].minutes);p.health=Math.max(0,p.health-(minutes-watered)*.18);if(before<1&&p.growth>=1&&!p.giant&&random()<(crops[o.type].giantChance??0)/100)p.giant=true;}
}
export function plantActionError(o,type){
 if(!o||!CROPS[o.type])return '请选择可栽培的植物。';
 if(type==='replant')return o.plant.health>0?'这株植物仍在生长，无需补种。':null;
 if(o.plant.health<=0)return '植物已枯萎，请先补种。';
 if(type==='harvest'&&o.plant.growth<1)return '植物尚未成熟。';
 return null;
}
export function tendPlant(o){o.plant.water=Math.min(100,o.plant.water+65);o.plant.health=Math.min(100,o.plant.health+20);}
export function harvestPlant(o,crops=CROPS){const amount=Math.max(1,Math.floor(crops[o.type].yield*(o.plant.giant?2:1)*o.plant.health/100));o.plant.growth=0;o.plant.water=Math.max(0,o.plant.water-10);o.plant.harvests++;o.plant.giant=false;return amount;}
export function validPlant(p){return p&&Number.isFinite(p.growth)&&p.growth>=0&&p.growth<=1&&Number.isFinite(p.water)&&p.water>=0&&p.water<=100&&Number.isFinite(p.health)&&p.health>=0&&p.health<=100&&Number.isSafeInteger(p.harvests)&&p.harvests>=0&&typeof p.giant==='boolean';}
