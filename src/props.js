import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createSpiritTree} from './spirit-tree.js';
import {createWonderVisual} from './wonder-visuals.js';
import {ITEMS} from './simulation.js';
import {CROPS} from './plants.js';
import {StarToonMaterial,BiolumeMaterial,createPortalMaterial,createBioluminescence} from './npr.js';

export const colors={ivory:0xe9e5d5,mint:0x93cbbb,pink:0xe8a1bc,purple:0x82789f,dark:0x34495b,gold:0xf6cd83,glow:0xb4ffe0};
const materials=new Map();
function material(color,glow=0){const key=`${color}-${glow}`;if(!materials.has(key))materials.set(key,new StarToonMaterial({color,emissive:color,emissiveIntensity:glow}));return materials.get(key);}
function mesh(parent,geo,color,pos,scale,glow=0){const o=new THREE.Mesh(geo,material(color,glow));o.position.set(...pos);if(scale)o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const box=(p,c,xyz,s)=>mesh(p,new RoundedBoxGeometry(...s,3,.09),c,xyz);
const sphere=(p,c,xyz,s,glow=0)=>mesh(p,new THREE.SphereGeometry(1,20,12),c,xyz,s,glow);
const cylinder=(p,c,xyz,r,h,rt=r)=>mesh(p,new THREE.CylinderGeometry(rt,r,h,32),c,xyz);
const ring=(p,c,xyz,r,t=.07)=>mesh(p,new THREE.TorusGeometry(r,t,10,60),c,xyz,null,.25);

export {material,mesh,box,sphere,cylinder,ring};

export function createPropFactory({mushroomAsset,model,crystal}){
 function prop(type){if(type==='spiritTree')return createSpiritTree();const g=new THREE.Group();
  if(type==='polelight'){
   cylinder(g,0x48485e,[0,.12,0],.42,.24);cylinder(g,0x7e88a4,[0,1.65,0],.065,3.1,.09);
   for(const y of [.4,2.8]){const collar=ring(g,0xa2bccc,[0,y,0],.13,.03);collar.rotation.x=Math.PI/2;}
   const head=cylinder(g,0x79859e,[0,3.4,0],.56,.18,.35);
   const lens=cylinder(g,0xc8e7ff,[0,3.29,0],.46,.045);lens.material=material(0xc8e7ff,1.4);g.userData.lens=lens;
   sphere(g,0x93a3bf,[0,3.52,0],[.22,.08,.22]);
  }
  if(type==='glowlight'){
   cylinder(g,0x464259,[0,.12,0],.43,.24);cylinder(g,0x78708e,[0,.3,0],.27,.18);
   sphere(g,0x86e5d5,[0,.65,0],[.28,.39,.28],1.25);
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3,fin=box(g,0x817590,[Math.cos(a)*.24,.62,Math.sin(a)*.24],[.055,.64,.1]);fin.rotation.y=-a;}
   const crown=ring(g,0xb3efe5,[0,1.02,0],.24,.026);crown.rotation.x=Math.PI/2;
  }
  if(type==='stove'){
   box(g,colors.purple,[0,.5,0],[1.7,1,.85]);box(g,colors.dark,[0,1.04,0],[1.9,.12,1]);
   for(const x of [-.45,.45]){const flame=ring(g,colors.mint,[x,1.13,0],.27,.045);flame.rotation.x=-Math.PI/2;cylinder(g,colors.gold,[x,1.28,0],.24,.26,.3);sphere(g,colors.glow,[x,1.44,0],[.19,.025,.19],.7);}
   box(g,colors.mint,[0,.55,.44],[1.25,.5,.035]);for(const x of [-.5,0,.5])sphere(g,colors.gold,[x,.91,.46],[.055,.055,.025]);
  }
  if(type==='tea'){cylinder(g,colors.purple,[0,.5,0],.6,1);cylinder(g,colors.ivory,[0,1.03,0],.68,.12);for(const x of [-.27,.27]){cylinder(g,colors.mint,[x,1.35,0],.14,.55);sphere(g,colors.gold,[x,1.66,0],[.14,.08,.14],.4);}cylinder(g,colors.pink,[0,1.16,.4],.12,.15);}
  if(type==='banquet'){cylinder(g,colors.dark,[0,.43,0],.28,.8);const top=cylinder(g,colors.purple,[0,.9,0],.82,.15);top.scale.x=1.2;for(const x of [-.5,0,.5]){cylinder(g,colors.ivory,[x,1.02,0],.2,.035);sphere(g,[colors.mint,colors.pink,colors.gold][Math.round((x+.5)*2)],[x,1.12,0],[.14,.12,.14],.15);}}
  if(type==='relic'){cylinder(g,0x39314e,[0,.15,0],.6,.3);for(const x of [-.4,.4])box(g,0x675281,[x,.75,0],[.28,1.3,.35]);const relic=mesh(g,new THREE.OctahedronGeometry(.32),0x5edbc8,[0,1.35,0],[1,1.5,1],.7);g.userData.orb=relic;ring(g,0xb198cf,[0,1.35,0],.65,.035);}
  if(type==='beacon'){cylinder(g,0x3a344e,[0,.2,0],.45,.4);cylinder(g,0x675281,[0,1,0],.13,1.6);sphere(g,0x83d5df,[0,1.9,0],[.2,.35,.2],.9);for(const y of [1.6,2.1])ring(g,0x98a1d5,[0,y,0],.4,.04).rotation.x=Math.PI/2;}
  if(type==='nursery'){cylinder(g,colors.ivory,[0,.28,0],.7,.5);const rim=ring(g,colors.mint,[0,.58,0],.64,.07);rim.rotation.x=Math.PI/2;const dome=mesh(g,new THREE.SphereGeometry(.62,24,16,0,Math.PI*2,0,Math.PI/2),colors.mint,[0,.6,0]);dome.material=new THREE.MeshPhysicalMaterial({color:0xb6efd8,transparent:true,opacity:.18,roughness:.2,depthWrite:false,side:THREE.DoubleSide});const egg=sphere(g,colors.gold,[0,.8,0],[.23,.32,.23],.65);g.userData.egg=egg;box(g,colors.dark,[0,.44,.65],[.36,.13,.07]);}
  if(type==='pod'){box(g,colors.ivory,[0,.38,0],[1.35,.55,2.8]);box(g,colors.purple,[0,.7,.1],[1.13,.22,2.5]);box(g,colors.mint,[0,.87,-.9],[.9,.2,.45]);const arch=ring(g,colors.ivory,[0,1.05,-1.18],.71,.12);arch.scale.y=1.3;box(g,colors.mint,[0,.75,1.05],[1.15,.12,.25]);}
  if(type==='food'){box(g,colors.ivory,[0,.7,0],[1.1,1.4,.82]);box(g,colors.dark,[0,.88,.43],[.84,.54,.04]);box(g,colors.mint,[0,.9,.465],[.6,.28,.02]);box(g,colors.pink,[0,.32,.46],[.8,.08,.1]);cylinder(g,colors.gold,[0,.51,.5],.19,.06);sphere(g,colors.glow,[.35,1.27,.44],[.035,.035,.02],1);}
  if(type==='shower'){cylinder(g,colors.ivory,[0,.14,0],.66,.25);cylinder(g,colors.ivory,[0,2.75,0],.68,.18);const tube=mesh(g,new THREE.CylinderGeometry(.59,.59,2.45,24,1,true),colors.mint,[0,1.5,0]);tube.material=new THREE.MeshPhysicalMaterial({color:0x9eeedd,transparent:true,opacity:.24,roughness:.2,side:THREE.DoubleSide,depthWrite:false});box(g,colors.ivory,[0,1.48,-.57],[.24,2.5,.14]);}
  if(type==='sofa'){box(g,colors.pink,[0,.23,0],[1.2,.36,2.5]);box(g,colors.purple,[-.5,.65,0],[.28,.9,2.5]);for(const z of [-.7,0,.7])box(g,0xefc2cc,[0,.42,z],[.84,.14,.66]);for(const z of [-1.15,1.15])box(g,colors.purple,[0,.55,z],[1.2,.45,.2]);}
  if(type==='lab'){box(g,colors.ivory,[0,.55,0],[1.8,1,.85]);box(g,colors.dark,[0,1.1,0],[2,.13,1]);const screen=box(g,colors.mint,[0,1.63,-.3],[1.5,.88,.055]);screen.rotation.x=-.2;for(let i=0;i<3;i++)box(g,colors.ivory,[-.4,1.45+i*.17,-.25],[.5+i*.2,.025,.03]);for(let i=0;i<8;i++)box(g,colors.mint,[-.45+i*.12,1.18,.26],[.08,.015,.15]);const globe=sphere(g,colors.glow,[.7,1.4,.2],[.15,.15,.15],.6);g.userData.orb=globe;}
  if(type==='music'){cylinder(g,colors.purple,[0,.34,0],.52,.65);cylinder(g,colors.ivory,[0,.74,0],.64,.17);cylinder(g,colors.dark,[0,.85,0],.41,.035);cylinder(g,colors.pink,[0,.88,0],.12,.04);const a=ring(g,colors.mint,[0,1.15,0],.35,.045);a.rotation.x=-.6;}
  if(type==='portal'){cylinder(g,colors.ivory,[0,.17,0],1.05,.32);ring(g,colors.dark,[0,1.6,0],1.28,.2);const lip=ring(g,colors.mint,[0,1.6,.04],1.13,.035);lip.material=material(0x6bffe1,1.8);const portal=mesh(g,new THREE.CircleGeometry(1.1,64),colors.purple,[0,1.6,0]);portal.material=createPortalMaterial();g.userData.portal=portal;const glyphs=new THREE.Group();glyphs.position.set(0,1.6,.15);g.add(glyphs);g.userData.glyphs=glyphs;for(let i=0;i<12;i++){const a=i*Math.PI/6;const rune=mesh(glyphs,new THREE.OctahedronGeometry(.045),colors.glow,[Math.sin(a)*1.28,Math.cos(a)*1.28,0],[1,2,1],1.4);rune.rotation.z=-a;}}
  if(type==='gate'){
   const base=box(g,0x36354e,[0,.16,0],[1.65,.3,.8]);base.rotation.y=Math.PI/4;
   for(const sign of [-1,1]){
    const pillar=mesh(g,new THREE.OctahedronGeometry(.4),0x6d618a,[sign*.84,1.12,0],[.62,2.5,.65]);pillar.rotation.z=-sign*.2;
    const cap=mesh(g,new THREE.OctahedronGeometry(.16),0x8ee9e3,[sign*.7,2.18,0],[.6,1.8,.6],1.2);cap.rotation.z=sign*.4;
   }
   const frame=new THREE.Group();frame.position.y=1.5;g.add(frame);g.userData.riftFrame=frame;
   for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;const edge=box(frame,0x97ddd9,[Math.cos(a)*.48,Math.sin(a)*.72,.04],[.055,.92,.06]);edge.rotation.z=-a;}
   const rift=mesh(frame,new THREE.PlaneGeometry(1.05,1.8),0x8177c8,[0,0,0]);
   rift.material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},side:THREE.DoubleSide,transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform float time;varying vec2 vUv;void main(){vec2 p=vUv*2.0-1.0;float d=abs(p.x)+abs(p.y);if(d>1.0)discard;float thread=pow(.5+.5*sin(p.y*42.0+sin(p.x*12.0+time)*3.0-time*2.0),8.0);vec3 c=mix(vec3(.06,.035,.18),vec3(.32,.22,.65),d)+vec3(.18,.75,.7)*thread*.45+vec3(.3,1.0,.9)*pow(d,18.0);gl_FragColor=vec4(c,.9);}'
   });g.userData.rift=rift;const glow=new THREE.PointLight(0x72dfe0,3.5,5,2);glow.position.set(0,1.4,.5);g.add(glow);
   for(const y of [.2,2.8])mesh(g,new THREE.OctahedronGeometry(.15),0xa69bea,[0,y,0],[1,1.4,1],.7);
  }
  if(type==='telescope'){for(let i=0;i<3;i++){const leg=cylinder(g,colors.ivory,[Math.cos(i*2.09)*.22,.5,Math.sin(i*2.09)*.22],.055,1);leg.rotation.z=(i-1)*.35;}const body=cylinder(g,colors.purple,[0,1.3,0],.2,1.15);body.rotation.x=.9;sphere(g,colors.mint,[0,1.64,-.46],[.18,.1,.1],.5);}
  if(type==='garden'){box(g,colors.ivory,[0,.2,0],[1.6,.35,1.2]);box(g,0x695d72,[0,.39,0],[1.4,.05,1]);g.userData.cropVisual=[];for(let i=0;i<5;i++){const stalk=new THREE.Group();stalk.position.set((i%3-.8)*.42,.41,Math.floor(i/3)*.5-.22);g.add(stalk);const stem=cylinder(stalk,colors.mint,[0,.25,0],.035,.5);stem.material=new BiolumeMaterial({color:colors.mint,emissive:0xb5e5d6,emissiveIntensity:1});
   for(const side of [-1,1]){const leaf=sphere(stalk,colors.mint,[side*.11,.26,0],[.17,.035,.075]);leaf.rotation.z=side*.45;leaf.material=new BiolumeMaterial({color:colors.mint,emissive:0xb5e5d6,emissiveIntensity:1});}
   const fruit=sphere(stalk,[colors.pink,colors.mint,colors.gold][i%3],[0,.55,0],[.22,.18,.22],.25);stalk.userData.fruit=fruit;g.userData.cropVisual.push(stalk);}}
  if(type==='crystal')g.userData.crystalLight=crystal(g,0,0,1).userData.crystalLight;
  if(type==='mushroom'){const crop=new THREE.Group();g.add(crop);model(mushroomAsset,crop,0,0,0,.65);g.userData.cropVisual=[crop];}
  if(type==='lamp'){cylinder(g,colors.ivory,[0,.15,0],.35,.3);cylinder(g,colors.purple,[0,.7,0],.045,1);g.userData.playOrb=sphere(g,colors.gold,[0,1.4,0],[.35,.35,.35],.7);ring(g,colors.ivory,[0,1.4,0],.48,.035).rotation.x=1.1;}
  const lighting=ITEMS.find(item=>item.id===type)?.lighting;if(lighting){const light=new THREE.PointLight(lighting.color,lighting.intensity,Math.hypot(lighting.radius,lighting.height),2);light.position.set(0,lighting.height,0);g.add(light);g.userData.areaLight=light;}
  if(CROPS[type]){g.userData.cropLight=createBioluminescence(g,{radius:type==='garden'?.8:.65,height:type==='garden'?1.3:1.8,color:0xc9e8e4});for(const crop of g.userData.cropVisual)crop.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.userData.plantColor=n.material.color.clone();}});for(const crop of g.userData.cropVisual)if(crop.userData.fruit){const fruit=crop.userData.fruit;fruit.material=new BiolumeMaterial({color:fruit.material.color,emissive:0xbce6d9,emissiveIntensity:1});}}
  g.userData.wonderVisual=createWonderVisual(g,type);return g;
 }

 return prop;
}
