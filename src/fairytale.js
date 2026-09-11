import * as THREE from 'three';
import {FAIRYTALE_ITEMS,fairytaleHeight} from './fairytale-definition.js';
import {createStoryWater,meadowMaterial} from './fairytale-water.js';
import {StarToonMaterial} from './npr.js';
import {batchStatic,disposeStaticBatches} from './static-batching.js';
const skins={pod:'fairy-pod',food:'fairy-food',shower:'fairy-shower',lab:'fairy-lab',portal:'fairy-portal',sofa:'fairyBench',music:'fairy-music',blueprintTable:'fairy-blueprintTable',constructionTerminal:'fairy-constructionTerminal'};
export function createFairytaleKit(asset,environment){
 function model(name,library=asset){
  const source=library.getObjectByName(name);if(!source)throw new Error(`童梦星屿模型缺失：${name}`);
  const root=new THREE.Group(),copy=source.clone(true);
  if(name==='fairyBench'){const seats=new THREE.Group();seats.rotation.y=Math.PI/2;seats.scale.x=1.4;seats.add(copy);root.add(seats);}else root.add(copy);
  const toon=m=>new StarToonMaterial({name:m.name,color:m.color,map:m.map,vertexColors:m.vertexColors,emissive:m.emissive,emissiveIntensity:m.emissiveIntensity,transparent:m.transparent,opacity:m.opacity,side:m.side});
  const shared=new Map(),convert=m=>{if(library!==asset)return toon(m);if(!shared.has(m))shared.set(m,toon(m));return shared.get(m);};
  copy.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);}});
  return root;
 }
 return {
  environment(name){
   const root=model(name,environment);
   if(name.endsWith('-back'))root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.emissive.copy(m.color);m.emissiveIntensity=.22;}});
   return root;
  },
  prop(type,island,batching=true){const name=FAIRYTALE_ITEMS.some(i=>i.id===type)?type:island==='spore'?skins[type]:null;if(!name)return null;const root=model(name);if(type==='fairyLantern'){const light=new THREE.PointLight(0xffd38b,7,4,2);light.position.y=1.6;root.add(light);}return batching?batchStatic(root):root;},
  terrain(side){
   const root=model(`fairytale-${side}`);root.name=`fairytale-${side}`;
   const stages=[],plants=[];root.traverse(o=>{if(typeof o.userData.revealAt==='number')stages.push(o);if(o.userData.windPlant)plants.push({node:o,rotation:o.rotation.clone(),phase:o.position.x*.71+o.position.z*.43});});
   const painted=new Set();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name.startsWith('painted '))painted.add(m);});
   for(const m of painted)meadowMaterial(m,side==='back');batchStatic(root);
   const water=createStoryWater(side==='back');root.add(water.root);
   const updateWind=(seconds,wind)=>{for(const {node,rotation,phase}of plants){const strength=(node.userData.windPlant==='tree'?.018:.07)*(1+wind);node.rotation.z=rotation.z+Math.sin(seconds*1.3+phase)*strength;node.rotation.x=rotation.x+Math.sin(seconds*.83+phase+1)*strength*.6;}};
   const edgeLights=[];
   if(side==='back'){
    for(const [i,angle]of [.22,.92,1.64,2.52,3.47,4.21,5.42].entries()){
     const points=[];
     for(let j=0;j<=12;j++){const a=angle+j*.012;points.push(new THREE.Vector3(Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.45*14.96,-.44+.065*Math.sin(a*9),Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**.45*10.68));}
     const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.023,4,false),new THREE.MeshBasicMaterial({color:0x80ada2,transparent:true,opacity:.40}));root.add(mesh);
     const light=new THREE.PointLight(0x81afa6,3.2,5,2);light.position.copy(points[6]).multiply(new THREE.Vector3(1.015,1,1.015));light.position.y=.05;root.add(light);edgeLights.push({mesh,light,phase:i*1.9});
    }
   }
   const lights=[[-11,1.8,3.5,.4],[side==='back'?6.5:0,2,-6.8,1],[-8,1.6,6,.8],[8,1.6,6,.8],[-7,1.6,-6,.8],[7,1.6,-6,.8]].map(([x,y,z,revealAt])=>{const light=new THREE.PointLight(side==='front'?0xffd394:0xffb75e,12,7,2);light.userData.revealAt=revealAt;light.position.set(x,fairytaleHeight(x,z)+y,z);root.add(light);return light;});
   return {root,lodTargets:plants.map(({node})=>node),setProgress(progress){for(const o of [...stages,...lights])o.visible=progress>=o.userData.revealAt;},update(seconds,wind,night=0){water.update(seconds);updateWind(seconds,wind);for(const {mesh,light,phase}of edgeLights){const pulse=.65+.35*Math.sin(seconds*.38+phase);mesh.material.opacity=.32+pulse*.18;light.intensity=2.3+pulse*1.3;}for(const [i,light]of lights.entries())light.intensity=(side==='back'?16:7+night*12)*(1+.035*Math.sin(seconds*2+i));},dispose(){disposeStaticBatches(root);water.root.removeFromParent();water.dispose();for(const {mesh}of edgeLights)mesh.geometry.dispose();root.removeFromParent();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}};
  }
 };
}
