import {seededRandom} from './island-generator.js';

export const HOUSE_NAMES=['庭院合院','L 形连廊','双翼长屋','主屋与独立侧室'];
export function housingFurniture(plan,baseLayout){
 const existing=new Set(baseLayout.map(o=>o.type)),items=[];
 for(const r of plan.rooms){
  const back=-r.d/2+1.15,slots={
   '卧室':[['pod',0,back]],
   '客厅':[['sofa',-r.w/2+.85,0],['music',r.w/2-.8,back]],
   '厨房':[['stove',-r.w/2+1.1,back],['tea',r.w/2-.7,back],['banquet',0,r.d/2-1],['food',0,back]],
   '卫浴':[['shower',0,back]],'育生室':[['nursery',0,0]],'研究室':[['lab',0,back]]
  }[r.type];
  for(const [type,x,z] of slots)if(!existing.has(type)){existing.add(type);items.push({type,x:r.x+x,z:r.z+z,rotation:0});}
 }
 return items;
}
export function housingLayout(seed){
 const random=seededRandom(seed^0x92a481),kind=(Math.imul(seed^(seed>>>16),0x45d9f3b)>>>16)%4,rooms=[],corridors=[];
 const types=['卧室','客厅','厨房','卫浴','育生室','研究室'];
 for(let i=types.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
 const add=(x,z,w,d)=>rooms.push({x,z,w,d,type:types[rooms.length]});
 const hall=(x,z,w,d)=>corridors.push({x,z,w,d});
 const shift=(random()-.5)*.3;
 if(kind===0){
  add(-3.6,-7.1,7.2,3.8);add(3.6,-7.1,7.2,3.8);
  for(const x of [-10,10])for(const z of [-2.7,1.5])add(x,z,3.6,4.2);
  hall(0,-4.95,20, .7);hall(-10,-4.65,1,1.2);hall(10,-4.65,1,1.2);
 }else if(kind===1){
  for(const x of [-5.1,0,5.1])add(x,-7.1,5.1,3.8);
  for(const z of [-3.3,.3,3.9])add(-10.1,z,3.6,3.6);
  hall(-7.8,-5.15,4.6,1.2);
 }else if(kind===2){
  for(const x of [-10,10])for(const z of [-4,0,4])add(x,z,3.8,4);
  hall(0,-6.45,20,.9);
 }else{
  const split=3.6+random()*.5;
  let x=-7.5;for(const width of [split,7.5-split,split,7.5-split]){add(x+width/2,-7.1,width,3.8);x+=width;}
  add(-10,-.5,3.8,6);add(0,7.1,6,3.8);hall(-8.5,-4.4,3,1.1);
 }
 for(const r of rooms)r.z+=shift;
 for(const c of corridors)c.z+=shift;
 return {kind,name:HOUSE_NAMES[kind],rooms,corridors};
}

export function insideOutline(outline,x,z){let inside=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;}
export function footprintInside(outline,x,z,radius){
 return Array.from({length:24},(_,i)=>i*Math.PI/12).every(a=>insideOutline(outline,x+Math.cos(a)*radius,z+Math.sin(a)*radius));
}
