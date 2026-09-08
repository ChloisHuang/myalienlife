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
 const fleet=[...g.space.ships.filter(s=>s.id!==ship.id&&s.island===ship.island&&s.side===ship.side),ship].sort((a,b)=>a.id.localeCompare(b.id)),parked=[];
 for(const vessel of fleet){
  const angle=(.05+shipRandom(vessel.id,'angle')*.4)*Math.PI,jitter=shipRandom(vessel.id,vessel.island)*.3,radius=1.58*(.85+vessel.tier*.18);
  let spot;
  for(let layer=0;!spot;layer++)for(let slot=0;slot<4;slot++){
   const heading=slot===0?angle:(.07+(slot-1)*.18)*Math.PI;
   const candidate={x:Math.cos(heading)*(rx+.7+jitter),y:UFO_HOVER_HEIGHT+shipRandom(vessel.id,'height')*.8+layer*3.4,z:Math.sin(heading)*(rz+.7+jitter)};
   if(parked.every(p=>Math.abs(candidate.y-p.y)>=2.6||Math.hypot(candidate.x-p.x,candidate.z-p.z)>=radius+p.radius+.8)){spot=candidate;break;}
  }
  if(vessel.id===ship.id)return spot;
  parked.push({...spot,radius});
 }
}

const smooth=value=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*(3-2*t);};
// Three.js uses Y as the vertical axis; yaw turns the saucer flat around it.
export function ufoHoverMotion(id,seconds,flight){
 const phase=salt=>shipRandom(id,salt)*Math.PI*2;
 const wave=(rate,salt)=>Math.sin(seconds*rate+phase(salt));
 const strength=flight.flying?1-smooth(flight.progress/.12)+smooth((flight.progress-.86)/.14):1;
 return {x:strength*(wave(.31,'drift-x')*.11+wave(.17,'drift-x2')*.04),
  y:strength*(wave(.57,'lift')*.09+wave(.23,'lift2')*.04),z:strength*wave(.37,'drift-z')*.12,
  pitch:strength*wave(.43,'pitch')*.035,roll:strength*wave(.51,'roll')*.045,
  yaw:phase('heading')+wave(.047,'turn')*1.6+wave(.091,'turn2')*.45};
}
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
 const hull=mat([0xf1edd7,0x9bcadd,0xefcf88][tier-1]),accent=mat([0xc8bea0,0x7ba0b0,0xd3ad62][tier-1]),highlight=mat(0xf1edd7),trim=mat(0x667c70),neon=mat(0xc6ffe0),cargo=mat(0xffcf79),empty=mat(0x96aa97);
 function add(geo,material,x=0,y=0,z=0,parent=root){geometry.add(geo);const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 const torus=(radius,tube,material,y,parent=root)=>{const m=add(new THREE.TorusGeometry(radius,tube,8,48),material,0,y,0,parent);m.rotation.x=Math.PI/2;return m;};
 const profile=[[0,-.36],[.45,-.36],[.95,-.26],[1.34,-.1],[1.5,.04],[1.48,.15],[1.30,.30],[1.05,.42],[.79,.48],[0,.48]].map(([x,y])=>new THREE.Vector2(x,y));
 add(new THREE.LatheGeometry(profile,48),hull).name='sculpted-hull';
 const underside=add(new THREE.SphereGeometry(1,32,16),accent,0,-.09,0);underside.scale.set(1.37,.29,1.37);
 torus(1.44,.018,neon,.025).name='hull-fluorescent-strip';
 const glass=new StarToonMaterial({color:0x87cbb0,transparent:true,opacity:.48,depthWrite:false});materials.add(glass);
 const dome=add(new THREE.SphereGeometry(.76,24,16,0,Math.PI*2,0,Math.PI/2),glass,0,.46,0);dome.scale.y=1.12;dome.name='iridescent-canopy';dome.castShadow=false;dome.receiveShadow=false;
 torus(.77,.035,accent,.47);
 add(new THREE.CylinderGeometry(.62,.62,.025,32),trim,0,.49,0).name='reactor-well';
 const coreLight=mat(0xb4ffe0),core=add(new THREE.OctahedronGeometry(.22,0),coreLight,0,.79,0);core.name='fluorescent-core';rotors.push(core);
 // A single painted reflection keeps the canopy readable without physical glare.
 const shine=add(new THREE.SphereGeometry(1,16,10),highlight,-.32,1.02,.39);shine.scale.set(.085,.19,.018);shine.rotation.set(-.5,-.6,-.45);shine.castShadow=false;
 for(let i=0;i<3;i++){
  const angle=i*Math.PI*2/3,wing=new THREE.Group();wing.rotation.y=angle;root.add(wing);
  const petal=add(new THREE.SphereGeometry(1,20,12),accent,0,.43,1.06,wing);petal.scale.set(.26,.13,.39);petal.rotation.x=.3;
  const light=add(new THREE.SphereGeometry(1,12,8),neon,0,.55,1.16,wing);light.scale.set(.065,.022,.12);light.rotation.x=.3;
  for(const z of [.89,.97]){const vent=add(new THREE.BoxGeometry(.14,.012,.018),trim,0,.552,z,wing);vent.rotation.x=.3;}
  for(const x of [-.18,.18])add(new THREE.SphereGeometry(.025,8,6),highlight,x,.50,1.06,wing).scale.y=.35;
  const pod=add(new THREE.CylinderGeometry(.14,.11,.16,12),accent,0,-.26,1.07,wing);pod.name='maneuvering-thruster';
  const exhaust=add(new THREE.CircleGeometry(.085,12),neon,0,-.345,1.07,wing);exhaust.rotation.x=Math.PI/2;
  const windows=new THREE.Group();windows.rotation.y=angle+Math.PI/3;root.add(windows);
  for(const x of [-.14,.14]){
   const frame=add(new THREE.SphereGeometry(1,12,8),accent,x,.365,1.20,windows);frame.scale.set(.105,.026,.075);frame.rotation.x=.5;
   const pane=add(new THREE.SphereGeometry(1,12,8),neon,x,.384,1.21,windows);pane.scale.set(.073,.012,.047);pane.rotation.x=.5;pane.name='observation-port';
  }
 }
 // Supply lights stay on a small side panel, not scattered across the deck.
 for(let i=0;i<8;i++){
  const angle=(i-3.5)*.11,bar=add(new THREE.SphereGeometry(.035,8,6),empty,Math.sin(angle)*1.48,.12,Math.cos(angle)*1.48);bar.name=`food-segment-${i}`;segments.push(bar);
 }
 const engine=add(new THREE.CylinderGeometry(.44,.31,.17,24),trim,0,-.40,0);torus(.30,.027,neon,-.5);
 const nozzle=add(new THREE.CircleGeometry(.28,24),neon,0,-.49,0);nozzle.rotation.x=Math.PI/2;
 for(let i=0;i<tier;i++){const badge=add(new THREE.SphereGeometry(.045,8,6),accent,(i-(tier-1)/2)*.13,.43,-.95);badge.scale.y=.3;}
 root.scale.setScalar(.85+tier*.18);root.name=`UFO tier ${tier}`;
 return {root,update(ratio,seconds,operating=false){
  const full=ratio>=1;root.userData.foodStatus=full?'full':'partial';cargo.color.set(full?0x84ffd1:ratio>0?0xffbd63:0xeab965);cargo.emissive.copy(cargo.color);cargo.emissiveIntensity=operating?(full?2.4:1.7):0;
  for(const [i,bar]of segments.entries())bar.material=i<Math.ceil(ratio*8)?cargo:empty;
  for(const [i,rotor]of rotors.entries())rotor.rotation.y=seconds*(i===0?.5:.12);
  const pulse=Math.sin(seconds*1.7);
  coreLight.emissiveIntensity=operating?2.8+pulse*.45:0;neon.emissiveIntensity=operating?1.8+pulse*.2:0;empty.emissiveIntensity=operating?1.2:0;
  root.userData.operating=operating;
  engine.scale.y=1+Math.sin(seconds*1.4)*.025;
 },dispose(){root.removeFromParent();for(const g of geometry)g.dispose();for(const m of materials)m.dispose();}};
}

