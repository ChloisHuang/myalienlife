import {CROPS} from './plants.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {neighbors,canPlace} from './simulation.js';
import {appearance,groundHeight} from './characters.js';
import {createCharacter,updateCharacter} from './character-rig.js';

const colors={ivory:0xe9e5d5,mint:0x93cbbb,pink:0xe8a1bc,purple:0x82789f,dark:0x34495b,gold:0xf6cd83,glow:0xb4ffe0};
const materials=new Map();
function material(color,glow=0){const key=`${color}-${glow}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.65,emissive:color,emissiveIntensity:glow}));return materials.get(key);}
function mesh(parent,geo,color,pos,scale,glow=0){const o=new THREE.Mesh(geo,material(color,glow));o.position.set(...pos);if(scale)o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const box=(p,c,xyz,s)=>mesh(p,new RoundedBoxGeometry(...s,3,.09),c,xyz);
const sphere=(p,c,xyz,s,glow=0)=>mesh(p,new THREE.SphereGeometry(1,20,12),c,xyz,s,glow);
const cylinder=(p,c,xyz,r,h,rt=r)=>mesh(p,new THREE.CylinderGeometry(rt,r,h,32),c,xyz);
const ring=(p,c,xyz,r,t=.07)=>mesh(p,new THREE.TorusGeometry(r,t,10,60),c,xyz,null,.25);
function seedRandom(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

export async function createWorld(container,getGame,{onClick,onHover,onPlace}){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x222b40);scene.fog=new THREE.FogExp2(0x222b40,.014);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;container.appendChild(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-20,20,15,-15,.1,180);camera.position.set(23,25,30);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.minZoom=.65;controls.maxZoom=2.5;controls.minPolarAngle=.25;controls.maxPolarAngle=1.25;controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
 scene.add(new THREE.HemisphereLight(0xe2eaff,0x70526e,2.4));const sun=new THREE.DirectionalLight(0xffe5d0,3.4);sun.position.set(-10,24,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,far:70});sun.shadow.normalBias=.04;scene.add(sun);
 const rim=new THREE.DirectionalLight(0x82b6ff,2.5);rim.position.set(12,6,-16);scene.add(rim);
 const loader=new GLTFLoader();const [alienAsset,mushroomAsset]=await Promise.all(['alien','mushroom'].map(n=>loader.loadAsync(`/assets/${n}.glb`)));
 function model(source,parent,x,y,z,s=1){const o=source.scene.clone(true);o.position.set(x,y,z);o.scale.setScalar(s);o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});parent.add(o);return o;}
 const terrain=new THREE.Group();scene.add(terrain);
 const land=cylinder(terrain,0x987b91,[0,-1.05,0],15,1.6,14.9);land.scale.z=.72;
 const grass=cylinder(terrain,0xc7b9b0,[0,-.22,0],14.9,.28);grass.scale.z=.72;
 const random=seedRandom(28);
 for(let i=0;i<65;i++){const a=random()*Math.PI*2,r=14+random();mesh(terrain,new THREE.DodecahedronGeometry(.45+random()*.65),[0x9a809d,0xb298af,0x6e6d88][i%3],[Math.cos(a)*r,-.8-random(),Math.sin(a)*r*.71],[1,1,1]);}
 // Open-front habitat: three rooms share a clear, navigable central aisle.
 box(terrain,colors.ivory,[-2,.02,-2.5],[12.8,.28,7.5]);
 box(terrain,0xcfd4c7,[-2,1.4,-6.1],[12.9,2.8,.22]);
 box(terrain,0x839fa0,[-8.4,.85,-2.5],[.22,1.6,7.5]);
 box(terrain,0xedc5c2,[-2,.21,-2.5],[.14,.1,7.4]);
 box(terrain,0xbda6ba,[-5.2,.21,-2.5],[6.1,.08,7.3]);
 box(terrain,0xbce0d4,[1.1,.21,-2.5],[6,.08,7.3]);
 for(let x=-8;x<4;x+=.8)box(terrain,0xffffff,[x,.255,-2.5],[.013,.008,7.2]);
 for(let x=-6;x<=2;x+=4){box(terrain,0x789e9c,[x,1.65,-5.94],[2.2,1.45,.08]);box(terrain,0xa5dad9,[x,1.7,-5.87],[1.98,1.2,.05]);box(terrain,0xf3eee0,[x,1.7,-5.81],[.055,1.2,.06]);}
 for(let x=-7;x<5;x+=2)box(terrain,colors.ivory,[x,.09,2.0],[1.6,.12,.85]);
 const rug=cylinder(terrain,0xe4bdab,[-4,.3,.2],2,.025);rug.scale.z=.62;
 // Outdoor research deck, garden pond, and distant alien landscape.
 cylinder(terrain,0xb3a2b7,[7,.06,-3.5],3.6,.25);
 const pond=cylinder(terrain,0x768da5,[7,.03,4.7],2.3,.17);pond.scale.z=.65;
 const water=cylinder(terrain,0x79cdd0,[7,.15,4.7],2.07,.05);water.scale.z=.65;
 for(let i=0;i<3;i++){const r=ring(terrain,0xb8eece,[7,.2,4.7],.45+i*.5,.012);r.rotation.x=-Math.PI/2;r.scale.y=.65;}
 [[-10,-5,1.55],[-11,-1,1.2],[-10,5,1.1],[4,-8,1.4],[11,1,1.0],[10,7,.85],[-5,-8,.9]].forEach(([x,z,s])=>model(mushroomAsset,terrain,x,0,z,s));
 function crystal(parent,x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);for(let i=0;i<5;i++){const h=(.7+random()*.7)*s;const o=mesh(g,new THREE.CylinderGeometry(0,.22*s,h,5),[0x9ce9d5,0xd2b0e4,0x86c0e2][i%3],[(random()-.5)*s,h/2,(random()-.5)*s],null,.22);o.rotation.z=(random()-.5)*.5;}return g;}
 for(let i=0;i<40;i++){const x=(random()-.5)*26,z=(random()-.5)*17;if((x>-9&&x<11&&z>-6&&z<6)||x*x/190+z*z/85>1)continue;crystal(terrain,x,z,.3+random()*.8);}
 for(let i=0;i<48;i++){const x=(random()-.5)*27,z=(random()-.5)*17;if((x>-9&&x<10&&z>-6&&z<6)||x*x/190+z*z/85>1)continue;const stalk=cylinder(terrain,0x789d8d,[x,.18,z],.035,.35);sphere(terrain,[0xe8accd,0xf1d7a0,0xb3e3bd][i%3],[stalk.position.x,.42,z],[.17,.23,.17],.2);}
 for(let i=0;i<20;i++){const a=i/20*Math.PI*2;const r=18+random()*10;mesh(scene,new THREE.IcosahedronGeometry(1+random()*1.4,0),0x615e7e,[Math.cos(a)*r,-4-random()*4,Math.sin(a)*r*.6],[1.5,1,1]);}
 const starsGeo=new THREE.BufferGeometry();const stars=[];for(let i=0;i<450;i++)stars.push((random()-.5)*130,random()*55-6,(random()-.5)*110);starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xe3ddef,size:.085,transparent:true,opacity:.6})));
 const planet=sphere(scene,0xb19faf,[-26,7,-24],[4.8,4.8,4.8]);const orbit=ring(scene,0xd2b5ac,[-26,7,-24],7.1,.35);orbit.rotation.x=1.1;orbit.rotation.y=.2;
 const interactive=new THREE.Group();scene.add(interactive);const objectMeshes=new Map();
 function prop(type){const g=new THREE.Group();
  if(type==='nursery'){cylinder(g,colors.ivory,[0,.28,0],.7,.5);const rim=ring(g,colors.mint,[0,.58,0],.64,.07);rim.rotation.x=Math.PI/2;const dome=mesh(g,new THREE.SphereGeometry(.62,24,16,0,Math.PI*2,0,Math.PI/2),colors.mint,[0,.6,0]);dome.material=new THREE.MeshPhysicalMaterial({color:0xb6efd8,transparent:true,opacity:.18,roughness:.2,depthWrite:false,side:THREE.DoubleSide});const egg=sphere(g,colors.gold,[0,.8,0],[.23,.32,.23],.65);g.userData.egg=egg;box(g,colors.dark,[0,.44,.65],[.36,.13,.07]);}
  if(type==='pod'){box(g,colors.ivory,[0,.38,0],[1.35,.55,2.8]);box(g,colors.purple,[0,.7,.1],[1.13,.22,2.5]);box(g,colors.mint,[0,.87,-.9],[.9,.2,.45]);const arch=ring(g,colors.ivory,[0,1.05,-1.18],.71,.12);arch.scale.y=1.3;box(g,colors.mint,[0,.75,1.05],[1.15,.12,.25]);}
  if(type==='food'){box(g,colors.ivory,[0,.7,0],[1.1,1.4,.82]);box(g,colors.dark,[0,.88,.43],[.84,.54,.04]);box(g,colors.mint,[0,.9,.465],[.6,.28,.02]);box(g,colors.pink,[0,.32,.46],[.8,.08,.1]);cylinder(g,colors.gold,[0,.51,.5],.19,.06);sphere(g,colors.glow,[.35,1.27,.44],[.035,.035,.02],1);}
  if(type==='shower'){cylinder(g,colors.ivory,[0,.14,0],.66,.25);cylinder(g,colors.ivory,[0,2.75,0],.68,.18);const tube=mesh(g,new THREE.CylinderGeometry(.59,.59,2.45,24,1,true),colors.mint,[0,1.5,0]);tube.material=new THREE.MeshPhysicalMaterial({color:0x9eeedd,transparent:true,opacity:.24,roughness:.2,side:THREE.DoubleSide,depthWrite:false});box(g,colors.ivory,[0,1.48,-.57],[.24,2.5,.14]);}
  if(type==='sofa'){box(g,colors.pink,[0,.23,0],[1.2,.36,2.5]);box(g,colors.purple,[-.5,.65,0],[.28,.9,2.5]);for(const z of [-.7,0,.7])box(g,0xefc2cc,[0,.42,z],[.84,.14,.66]);for(const z of [-1.15,1.15])box(g,colors.purple,[0,.55,z],[1.2,.45,.2]);}
  if(type==='lab'){box(g,colors.ivory,[0,.55,0],[1.8,1,.85]);box(g,colors.dark,[0,1.1,0],[2,.13,1]);const screen=box(g,colors.mint,[0,1.63,-.3],[1.5,.88,.055]);screen.rotation.x=-.2;for(let i=0;i<3;i++)box(g,colors.ivory,[-.4,1.45+i*.17,-.25],[.5+i*.2,.025,.03]);for(let i=0;i<8;i++)box(g,colors.mint,[-.45+i*.12,1.18,.26],[.08,.015,.15]);const globe=sphere(g,colors.glow,[.7,1.4,.2],[.15,.15,.15],.6);g.userData.orb=globe;}
  if(type==='music'){cylinder(g,colors.purple,[0,.34,0],.52,.65);cylinder(g,colors.ivory,[0,.74,0],.64,.17);cylinder(g,colors.dark,[0,.85,0],.41,.035);cylinder(g,colors.pink,[0,.88,0],.12,.04);const a=ring(g,colors.mint,[0,1.15,0],.35,.045);a.rotation.x=-.6;}
  if(type==='portal'){cylinder(g,colors.ivory,[0,.17,0],1.05,.32);ring(g,colors.dark,[0,1.6,0],1.28,.2);ring(g,colors.mint,[0,1.6,.04],1.13,.06);const portal=mesh(g,new THREE.CircleGeometry(1.1,48),colors.purple,[0,1.6,0]);portal.material=new THREE.MeshBasicMaterial({color:0x96c6c8,transparent:true,opacity:.35,side:THREE.DoubleSide});for(let i=0;i<8;i++){const a=i*Math.PI/4;sphere(g,colors.glow,[Math.sin(a)*1.27,1.6+Math.cos(a)*1.27,.13],[.07,.07,.07],1);}}
  if(type==='telescope'){for(let i=0;i<3;i++){const leg=cylinder(g,colors.ivory,[Math.cos(i*2.09)*.22,.5,Math.sin(i*2.09)*.22],.055,1);leg.rotation.z=(i-1)*.35;}const body=cylinder(g,colors.purple,[0,1.3,0],.2,1.15);body.rotation.x=.9;sphere(g,colors.mint,[0,1.64,-.46],[.18,.1,.1],.5);}
  if(type==='garden'){box(g,colors.ivory,[0,.2,0],[1.6,.35,1.2]);box(g,0x695d72,[0,.39,0],[1.4,.05,1]);g.userData.cropVisual=[];for(let i=0;i<5;i++){const stalk=new THREE.Group();stalk.position.set((i%3-.8)*.42,.41,Math.floor(i/3)*.5-.22);g.add(stalk);cylinder(stalk,colors.mint,[0,.25,0],.035,.5);const fruit=sphere(stalk,[colors.pink,colors.mint,colors.gold][i%3],[0,.55,0],[.22,.18,.22],.25);stalk.userData.fruit=fruit;g.userData.cropVisual.push(stalk);}}
  if(type==='crystal')crystal(g,0,0,1);
  if(type==='mushroom'){const crop=new THREE.Group();g.add(crop);model(mushroomAsset,crop,0,0,0,.65);g.userData.cropVisual=[crop];}
  if(type==='lamp'){cylinder(g,colors.ivory,[0,.15,0],.35,.3);cylinder(g,colors.purple,[0,.7,0],.045,1);sphere(g,colors.gold,[0,1.4,0],[.35,.35,.35],.7);ring(g,colors.ivory,[0,1.4,0],.48,.035).rotation.x=1.1;}
  if(CROPS[type])for(const crop of g.userData.cropVisual)crop.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.userData.plantColor=n.material.color.clone();}});
  return g;
 }
 function syncObjects(){const g=getGame();for(const[id,o]of objectMeshes)if(!g.objects.some(x=>x.id===id)){interactive.remove(o);objectMeshes.delete(id);}for(const o of g.objects)if(!objectMeshes.has(o.id)){const group=prop(o.type);group.position.set(o.x,.29,o.z);group.rotation.y=o.rotation;group.userData.target={kind:'object',id:o.id};interactive.add(group);objectMeshes.set(o.id,group);}}
 const actors=new Map();
 function syncActors(){
  const g=getGame(),residents=[...(g.player.alive?[{id:'player',...g.player}]:[]),...neighbors(g)];
  for(const [id,rig]of actors)if(!residents.some(n=>n.id===id&&n.uid===rig.uid)){
   interactive.remove(rig.root);rig.root.traverse(n=>{if(n.isMesh)n.material.dispose();});actors.delete(id);
  }
  for(const data of residents)if(!actors.has(data.id)){
   const rig=createCharacter(alienAsset.scene,data);rig.uid=data.uid;rig.root.userData.target={kind:data.id==='player'?'player':'npc',id:data.id};interactive.add(rig.root);actors.set(data.id,rig);
  }
 }
 syncActors();
 const marker=mesh(scene,new THREE.OctahedronGeometry(.25),0xb9ffca,[0,2.65,2],null,.7);
 const selected=ring(scene,0xc1ffd0,[0,.3,2],.52,.035);selected.rotation.x=-Math.PI/2;
 const ghost=new THREE.Group();scene.add(ghost);let buildType=null,buildRotation=0,ghostProp=null;
 const buildGrid=new THREE.GridHelper(22,22,0xc6ffd5,0xaba3b0);buildGrid.position.y=.29;buildGrid.material.transparent=true;buildGrid.material.opacity=.28;buildGrid.visible=false;scene.add(buildGrid);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),-.29);let hoverTarget=null;let pointerDown=null;
 function hit(event){const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const point=new THREE.Vector3();raycaster.ray.intersectPlane(ground,point);const hits=raycaster.intersectObjects(interactive.children,true);let target=null;if(hits[0]){let o=hits[0].object;while(o&&!o.userData.target)o=o.parent;target=o?.userData.target;}return{target,point};}
 renderer.domElement.addEventListener('pointermove',e=>{const h=hit(e);if(buildType){ghost.position.set(Math.round(h.point.x),.3,Math.round(h.point.z));ghost.visible=Math.abs(h.point.x)<12&&Math.abs(h.point.z)<8;const valid=canPlace(getGame(),ghost.position.x,ghost.position.z);ghost.traverse(n=>{if(n.isMesh)n.material.color.set(valid?0xafffca:0xff7e94);});}else{hoverTarget=h.target;renderer.domElement.style.cursor=h.target?'pointer':'default';onHover(h.target,e.clientX,e.clientY);}});
 renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};});
 renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>6)return;const h=hit(e);if(buildType){onPlace(buildType,Math.round(h.point.x),Math.round(h.point.z),buildRotation);return;}if(h.target)onClick(h.target,e.clientX,e.clientY);else if(Math.abs(h.point.x)<=11&&Math.abs(h.point.z)<=7)onClick({kind:'ground',point:{x:h.point.x,z:h.point.z}},e.clientX,e.clientY);});
 renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
 function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);const v=14;camera.left=-v*w/h;camera.right=v*w/h;camera.top=v;camera.bottom=-v;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(container);resize();syncObjects();
 let previousSimTime=null;
 return {
  render(){const g=getGame();syncObjects();syncActors();for(const o of g.objects){if(!CROPS[o.type])continue;const group=objectMeshes.get(o.id),p=o.plant;for(const crop of group.userData.cropVisual){crop.scale.setScalar(.3+p.growth*.7);crop.rotation.z=p.health<=0?.45:p.water<25?.15:0;crop.traverse(n=>{if(n.isMesh){n.material.color.copy(n.userData.plantColor).lerp(new THREE.Color(0x80664c),1-p.health/100);}});if(crop.userData.fruit){crop.userData.fruit.visible=p.growth>=.7&&p.health>0;crop.userData.fruit.material.emissiveIntensity=p.growth>=1?.8:.2;}}}const time=((g.day-1)*1440+g.minute)/2,delta=previousSimTime===null?0:Math.max(0,time-previousSimTime);previousSimTime=time;
   for(const[id,rig]of actors){
    const person=id==='player'?g.player:g.npcs[id],action=(id==='player'?g.queue:person.queue)[0];
    const partner=g.queue[0]?.targetId===id?g.player:action&&g.npcs[action.targetId]?g.npcs[action.targetId]:Object.values(g.npcs).find(n=>n.queue[0]?.targetId===id);
    updateCharacter(rig,{person,action,object:action?g.objects.find(o=>o.id===action.targetId):undefined,partner,time,delta});
   }
   marker.visible=selected.visible=g.player.alive;const main=actors.get('player')?.root.position||new THREE.Vector3(g.player.x,0,g.player.z);marker.position.set(main.x,main.y+2.65*appearance(g.player).scale+Math.sin(time*3)*.06,main.z);marker.rotation.y=time;selected.position.set(main.x,groundHeight(main.x,main.z)+.025,main.z);
   for(const [id,o]of objectMeshes){if(o.userData.orb)o.userData.orb.position.y=1.4+Math.sin(time*2)*.06;if(o.userData.egg){o.userData.egg.visible=g.incubations.some(b=>b.podId===id);o.userData.egg.position.y=.8+Math.sin(time*1.5)*.06;}}
   const hour=g.minute/60;sun.intensity=hour>=7&&hour<19?3.4:1.3;rim.intensity=hour>=7&&hour<19?2:3;controls.update();renderer.render(scene,camera);
  },
  setBuild(type){buildType=type;buildGrid.visible=!!type;ghost.visible=false;if(ghostProp){ghost.remove(ghostProp);ghostProp.traverse(n=>{if(n.isMesh)n.material.dispose();});}if(type){ghostProp=prop(type);ghostProp.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.material.transparent=true;n.material.opacity=.45;}});ghost.add(ghostProp);}return type;},
  rotateBuild(){buildRotation+=Math.PI/2;ghost.rotation.y=buildRotation;},
  focus(id){const p=id==='home'?{x:-3,z:-1}:id==='garden'?{x:7,z:3}:id==='lab'?{x:6,z:-3}:getGame().player;const dx=p.x-controls.target.x,dz=p.z-controls.target.z;controls.target.set(p.x,0,p.z);camera.position.x+=dx;camera.position.z+=dz;},
  resetCamera(){camera.position.set(23,25,30);controls.target.set(0,0,0);camera.zoom=1;camera.updateProjectionMatrix();},
  zoom(delta){camera.zoom=THREE.MathUtils.clamp(camera.zoom+delta,.65,2.5);camera.updateProjectionMatrix();},
  portrait(id){
   const person=id==='player'?getGame().player:getGame().npcs[id],color=person.color;
   const rig=createCharacter(alienAsset.scene,{id,color,...person});updateCharacter(rig,{person:{...person,x:0,z:0},time:0,delta:0});rig.root.rotation.set(0,0,0);rig.root.position.set(0,0,0);
   const portraitScene=new THREE.Scene();portraitScene.background=new THREE.Color(id==='player'?0xc3e6c8:0xd4cde5);portraitScene.add(new THREE.HemisphereLight(0xffffff,0x667788,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,3,4);portraitScene.add(light);portraitScene.add(rig.root);
   const scale=appearance(person).scale,cam=new THREE.PerspectiveCamera(32,1,.1,10);cam.position.set(0,1.65*scale,3.3*scale);cam.lookAt(0,1.45*scale,0);const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(160,160);r.render(portraitScene,cam);const url=r.domElement.toDataURL();r.dispose();rig.body.traverse(n=>{if(n.isMesh)n.material.dispose();});return url;
  }
 };
}
