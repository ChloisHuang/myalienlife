import * as THREE from 'three';
import {StarToonMaterial} from './npr.js';
import {ufoLandingSpot} from './space-logistics.js';
import {groundHeight} from './characters.js';
import {ACTIONS} from './simulation.js';
import {islandDefinition} from './civilization.js';
export const UFO_HOVER_HEIGHT=4.2;
function shipRandom(id,salt){let hash=2166136261;for(const c of `${id}:${salt}`)hash=Math.imul(hash^c.charCodeAt(0),16777619);return (hash>>>0)/4294967296;}
export function ufoDock(g,ship){
 const definition=islandDefinition(g,ship.island),outline=definition.outline;
 const rx=outline?Math.max(...outline.map(p=>Math.abs(p.x))):15.4,rz=outline?Math.max(...outline.map(p=>Math.abs(p.z))):10.9;
 const angle=(.05+shipRandom(ship.id,'angle')*.4)*Math.PI,jitter=shipRandom(ship.id,ship.island)*.3;
 return {x:Math.cos(angle)*(rx+.7+jitter),y:UFO_HOVER_HEIGHT+shipRandom(ship.id,'height')*.8,z:Math.sin(angle)*(rz+.7+jitter)};
}
const smooth=value=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>({x:THREE.MathUtils.lerp(a.x,b.x,t),y:THREE.MathUtils.lerp(a.y,b.y,t),z:THREE.MathUtils.lerp(a.z,b.z,t)});
// The saved action is the single clock for the ship, beam and every passenger.
export function ufoFlightPresentation(g,ship){
 const host=[{person:g.player,queue:g.queue},...Object.values(g.npcs).map(person=>({person,queue:person.queue}))].find(p=>p.queue.some(q=>q.id===ship.reservedBy&&q.type==='voyage'));
 const action=host?.queue.find(q=>q.id===ship.reservedBy),flying=action?.phase==='acting';
 const progress=flying?THREE.MathUtils.clamp(action.elapsed/Math.max(.001,g.config?.actionDurations?.voyage??ACTIONS.voyage.duration),0,1):0;
 const landing=flying&&progress>=.5,location=landing?{...ship,island:action.destinationId,side:'front'}:ship,dock=ufoDock(g,location);
 const spot=landing?ufoLandingSpot(g,action.destinationId):host?.person;
 const pickup=spot?{x:spot.x,y:UFO_HOVER_HEIGHT+1,z:spot.z}:dock;
 let position=dock,scale=1,stage=action?'等待登船':'悬浮停靠',beam=0,bank=0;
 if(flying){
  if(progress<.12){position=mix(dock,pickup,smooth(progress/.12));stage='前往接人';}
  else if(progress<.28){position=pickup;beam=1;stage='光束吸入';}
  else if(progress<.5){const t=smooth((progress-.28)/.22);position={x:pickup.x+t*12,y:pickup.y+t*8,z:pickup.z-t*5};scale=1-t;bank=Math.sin(t*Math.PI)*.18;stage='正在起飞';}
  else if(progress<.70){const t=1-smooth((progress-.5)/.20);position={x:pickup.x-t*12,y:pickup.y+t*8,z:pickup.z-t*5};scale=1-t;bank=-Math.sin(t*Math.PI)*.18;stage='星际航行';}
  else if(progress<.86){position=pickup;beam=1;stage='光束放下';}
  else{position=mix(pickup,dock,smooth((progress-.86)/.14));stage='返回外圈停靠';}
 }
 return {...position,island:location.island,side:location.side,scale,bank,progress,flying,beam,stage,pickup,
  crew:flying?[host.person.uid,...action.passengerUids]:[],
  route:action?`${islandDefinition(g,ship.island).name} → ${islandDefinition(g,action.destinationId).name}`:''};
}
export function ufoPassengerPresentation(flight,person){
 const p=flight.progress;if(p<.12)return {visible:true,island:flight.island,side:flight.side,x:person.x,z:person.z,y:groundHeight(person.x,person.z,flight.side,flight.island),scale:1};
 if(p>=.28&&p<.70)return {visible:false};
 const landing=p>=.70,t=landing?1-smooth((p-.70)/.16):smooth((p-.12)/.16),ground=groundHeight(flight.pickup.x,flight.pickup.z,flight.side,flight.island);
 const gather=landing?1:smooth((p-.12)/.045);
 return {visible:true,island:flight.island,side:flight.side,x:THREE.MathUtils.lerp(person.x,flight.pickup.x,gather),z:THREE.MathUtils.lerp(person.z,flight.pickup.z,gather),y:THREE.MathUtils.lerp(ground,flight.pickup.y-.7,t),scale:1-.95*t};
}
export function createUfoTransferBeam(){
 const root=new THREE.Group(),geometry=new THREE.CylinderGeometry(.28,1.7,1,40,1,true),material=new THREE.MeshBasicMaterial({color:0x99ffe5,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),cone=new THREE.Mesh(geometry,material);
 root.add(cone);root.name='ufo-transfer-beam';const particleGeometry=new THREE.BufferGeometry(),positions=new Float32Array(36*3);particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const particleMaterial=new THREE.PointsMaterial({color:0xbaffed,size:.065,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}),particles=new THREE.Points(particleGeometry,particleMaterial);root.add(particles);
 return {root,update(flight){root.visible=!!flight.beam;if(!flight.beam)return;const base=groundHeight(flight.pickup.x,flight.pickup.z,flight.side,flight.island),height=flight.y-.7-base;root.position.set(flight.x,base,flight.z);cone.position.y=height/2;cone.scale.y=height;
  for(let i=0;i<36;i++){const t=(i/36+flight.progress*12)%1,h=flight.progress<.5?t:1-t,a=i*2.399,r=(1-h)*1.3;positions.set([Math.cos(a)*r,h*height,Math.sin(a)*r],i*3);}particleGeometry.attributes.position.needsUpdate=true;
 },dispose(){root.removeFromParent();geometry.dispose();material.dispose();particleGeometry.dispose();particleMaterial.dispose();}};
}
export function createUfoVisual(tier){
 const root=new THREE.Group(),geometry=new Set(),materials=new Set(),segments=[],rotors=[];
 const mat=(color,emission=0)=>{const m=new StarToonMaterial({color,emissive:color,emissiveIntensity:emission});materials.add(m);return m;};
 const hull=mat([0xc5e6df,0xbacde9,0xc8b5e9][tier-1]),ceramic=mat(0xe0e6e7),trim=mat(0x35485f),neon=mat([0x72ffd4,0x89dbff,0xdb9eff][tier-1],1.2),cargo=mat(0xffbd63,.85),empty=mat(0x354452);
 function add(geo,material,x=0,y=0,z=0,parent=root){geometry.add(geo);const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 const torus=(radius,tube,material,y,parent=root,arc=Math.PI*2)=>{const m=add(new THREE.TorusGeometry(radius,tube,10,64,arc),material,0,y,0,parent);m.rotation.x=Math.PI/2;return m;};
 add(new THREE.SphereGeometry(.085,12,8),cargo,0,.34,-.92).name='supply-status-light';
 const profile=[[0,-.36],[.4,-.36],[.65,-.31],[1.1,-.21],[1.45,-.1],[1.58,0],[1.5,.1],[1.2,.2],[.85,.31],[.72,.36],[0,.36]].map(([x,y])=>new THREE.Vector2(x,y));
 add(new THREE.LatheGeometry(profile,72),hull).name='sculpted-hull';
 torus(1.52,.048,trim,0);torus(1.535,.027,neon,.06).name='hull-fluorescent-strip';torus(.84,.035,ceramic,.31);torus(.74,.035,trim,.36);
 const glass=new THREE.MeshPhysicalMaterial({color:0x538baa,metalness:.25,roughness:.12,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.78});materials.add(glass);
 const dome=add(new THREE.SphereGeometry(.7,40,24,0,Math.PI*2,0,Math.PI/2),glass,0,.35,0);dome.scale.y=.8;dome.name='iridescent-canopy';
 const core=add(new THREE.OctahedronGeometry(.19,1),neon,0,.58,0);rotors.push(core);
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,sector=new THREE.Group();sector.rotation.y=angle;root.add(sector);
  const plate=torus(1.16,.018,trim,.235,sector,.48);plate.rotation.z=.15;
  const stripe=add(new THREE.BoxGeometry(.035,.025,.3),neon,0,.255,1.1,sector);stripe.rotation.x=.15;
  const bar=add(new THREE.BoxGeometry(.19,.055,.12),empty,0,.2,1.37,sector);bar.name=`food-segment-${i}`;segments.push(bar);
 }
 const engine=add(new THREE.CylinderGeometry(.48,.33,.2,32),trim,0,-.38,0);torus(.33,.035,neon,-.5);
 const nozzle=add(new THREE.CircleGeometry(.29,32),neon,0,-.49,0);nozzle.rotation.x=Math.PI/2;
 for(let i=0;i<3;i++){
  const a=i*Math.PI*2/3+.5,x=Math.cos(a)*1.07,z=Math.sin(a)*1.07,thruster=new THREE.Group();thruster.position.set(x,-.22,z);root.add(thruster);
  add(new THREE.CylinderGeometry(.2,.13,.26,16),trim,0,-.05,0,thruster);torus(.14,.025,neon,-.19,thruster);
  const disc=add(new THREE.CircleGeometry(.11,16),neon,0,-.2,0,thruster);disc.rotation.x=Math.PI/2;
 }
 if(tier===3){for(let i=0;i<3;i++){const a=i*Math.PI*2/3,fin=add(new THREE.OctahedronGeometry(.25,0),ceramic,Math.cos(a)*1.58,.2,Math.sin(a)*1.58);fin.scale.set(.5,1.2,1.8);fin.rotation.y=-a;}}
 for(let i=0;i<tier;i++)add(new THREE.BoxGeometry(.1,.025,.2),ceramic,(i-(tier-1)/2)*.18,.31,.91);
 root.scale.setScalar(.85+tier*.18);root.name=`UFO tier ${tier}`;
 return {root,update(ratio,seconds){
  const full=ratio>=1;root.userData.foodStatus=full?'full':'partial';cargo.color.set(full?0x84ffd1:ratio>0?0xffbd63:0xfa7d89);cargo.emissive.copy(cargo.color);cargo.emissiveIntensity=full?1.3:.65;
  for(const [i,bar]of segments.entries())bar.material=i<Math.ceil(ratio*8)?cargo:empty;
  for(const [i,rotor]of rotors.entries())rotor.rotation.y=seconds*(i===0?.5:.12);
  root.rotation.z=Math.sin(seconds*.7)*.018;engine.scale.y=1+Math.sin(seconds*1.4)*.025;
 },dispose(){root.removeFromParent();for(const g of geometry)g.dispose();for(const m of materials)m.dispose();}};
}

export function createUfoFoodLabel(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=72;const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:texture,depthWrite:false,depthTest:false}),root=new THREE.Sprite(material);root.position.set(0,1.15,0);root.scale.set(4.3,.61,1);let previous='';
 return {root,update(food,capacity,stage='悬浮停靠'){const text=`${stage==='悬浮停靠'?'':stage+' · '}${food>=capacity?'补给满载':'补给未满'}  ${food}/${capacity}`;if(text===previous)return;previous=text;ctx.clearRect(0,0,512,72);ctx.fillStyle='#172938e8';ctx.beginPath();ctx.roundRect(4,6,504,58,16);ctx.fill();ctx.strokeStyle=food>=capacity?'#83ffd0':'#efb665';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 27px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=food>=capacity?'#a8ffdc':'#ffdb9e';ctx.fillText(text,256,37);texture.needsUpdate=true;},dispose(){root.removeFromParent();texture.dispose();material.dispose();}};
}
