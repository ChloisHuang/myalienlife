// Disposable completed-housing study. Reuses the live island terrain and Blender
// assets; proposed rooms/furnishings are preview-only, with no save or simulation API.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createIcons,ChevronLeft,ChevronRight,Shuffle,RotateCcw,Scan} from 'lucide';
import {generateIsland,seededRandom,BIOMES} from '../src/island-generator.js';
import {createIslandTerrain} from '../src/island-terrain.js';
import {createCharacter,updateCharacter} from '../src/character-rig.js';
import {createGame} from '../src/simulation.js';
import {stylizeAsset} from '../src/npr.js';
import {SURFACES,decorateSurface} from '../src/planet-surfaces.js';
import {housingLayout,housingFurniture} from '../src/housing-layout.js';
import {createHousingVisual} from '../src/settlement-visuals.js';
import {createPropFactory} from '../src/props.js';
import {createCrystalFactory} from '../src/crystal.js';

createIcons({icons:{ChevronLeft,ChevronRight,Shuffle,RotateCcw,Scan}});
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.querySelector('#scene').append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-23,23,17, -17,.1,200);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.6;controls.maxZoom=3;controls.maxPolarAngle=Math.PI*.48;controls.target.set(0,0,0);
const ambient=new THREE.HemisphereLight(0xf0fcff,0x657666,2.4);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xfff3dd,3.5);sun.position.set(-15,30,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,far:85});sun.shadow.normalBias=.04;scene.add(sun);
const loader=new GLTFLoader(),[mushroom,alien]=await Promise.all(['mushroom','alien'].map(n=>loader.loadAsync(`/assets/${n}.glb`)));
stylizeAsset(mushroom.scene);stylizeAsset(alien.scene,{character:true});
const sharedMaterials=new Map(),geometries=new Set();
function material(color){if(!sharedMaterials.has(color))sharedMaterials.set(color,new THREE.MeshStandardMaterial({color,roughness:.68}));return sharedMaterials.get(color);}
function mesh(parent,geometry,color,x,y,z){geometries.add(geometry);const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
const box=(p,c,x,y,z,w,h,d)=>mesh(p,new RoundedBoxGeometry(w,h,d,2,Math.min(.08,h/3)),c,x,y,z);
const cyl=(p,c,x,y,z,r,h)=>mesh(p,new THREE.CylinderGeometry(r,r,h,24),c,x,y,z);
const orb=(p,c,x,y,z,r)=>mesh(p,new THREE.SphereGeometry(r,20,12),c,x,y,z);
const ring=(p,c,x,y,z,r)=>mesh(p,new THREE.TorusGeometry(r,.045,8,40),c,x,y,z);
const white=0xe6eeee,dark=0x35494e,mint=0x91d4bf,pink=0xdeb6c4,gold=0xe1ce8a;
const furnished=new Set();
const createCrystalMesh=createCrystalFactory(renderer);
const prop=createPropFactory({
 mushroomAsset:mushroom,
 model(source,parent,x,y,z,scale){const m=source.scene.clone(true);m.position.set(x,y,z);m.scale.setScalar(scale);parent.add(m);return m;},
 crystal(parent,x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);const facets=[];for(let i=0;i<5;i++){const h=(.7+i*.13)*scale,profile=[[0,0],[.14,0],[.19,.18],[.19,.72],[0,1]].map(([r,y])=>new THREE.Vector2(r*scale,y*h)),geo=new THREE.LatheGeometry(profile,6).toNonIndexed();geo.computeVertexNormals();const m=createCrystalMesh(geo,[0x9ce9d5,0xd2b0e4,0x86c0e2][i%3]);m.position.set(Math.sin(i*2.4)*scale*.3,0,Math.cos(i*2.4)*scale*.3);g.add(m);facets.push(m.material);}g.userData.crystalLight={facets,phase:0};return g;}
});
function furnishing(type,parent,x,z,rotation=0){
 if(furnished.has(type))return null;furnished.add(type);
 const g=prop(type);g.position.set(x,.35,z);g.rotation.y=rotation;g.userData.furnitureType=type;parent.add(g);return g;
}
const roomTypes=['卧室','客厅','厨房','卫浴','育生室','研究室'];
let terrain,content,housing,disposeSurface,actors=[],current=Number(new URLSearchParams(location.search).get('variant')||0)%SURFACES.length;
const samples=SURFACES.map((surface,index)=>{let seed=901+index*701;if(surface.original)while(generateIsland(seed,index).biome!==surface.id)seed++;return{seed,index};});
const suppliedSeed=new URLSearchParams(location.search).get('seed');if(suppliedSeed)samples[current].seed=Number(suppliedSeed);
function reset(){camera.position.set(25,32,34);controls.target.set(0,0,0);camera.zoom=innerWidth<600?.92:1.06;camera.updateProjectionMatrix();controls.update();}
function load(){
 window.previewReady=false;
 disposeSurface?.();housing?.dispose();furnished.clear();
 if(terrain)terrain.dispose();
 if(content){content.traverse(n=>{if(n.isMesh&&!Array.from(sharedMaterials.values()).includes(n.material)&&n.material.transparent)n.material.dispose();});content.removeFromParent();}
 for(const g of geometries)g.dispose();geometries.clear();actors=[];
 const {seed,index}=samples[current],definition=generateIsland(seed,index),random=seededRandom(seed^0x7451),surface=SURFACES[current];
 const plan=housingLayout(seed),{rooms,corridors}=plan;
 const terrainDefinition=surface.original?{...definition,biome:surface.id,color:surface.color,accent:surface.accent}:{...definition,biome:'ruins',color:surface.color,accent:surface.accent,decor:[]};
 terrain=createIslandTerrain(terrainDefinition,mushroom.scene);scene.add(terrain.root);content=new THREE.Group();scene.add(content);
 if(!surface.original){for(const child of terrain.root.children)if(child.name!=='rounded-island-shell')child.visible=false;const shell=terrain.root.getObjectByName('rounded-island-shell');shell.material.color.set(surface.color);disposeSurface=decorateSurface(terrain.root,definition,surface,rooms);}
 // Construction clears only decoration inside its footprint, not the island
 // outline or any of the original interactive infrastructure.
 const withinRoom=(x,z,margin=0)=>rooms.some(r=>Math.abs(x-r.x)<r.w/2+margin&&Math.abs(z-r.z)<r.d/2+margin);
 for(const child of [...terrain.root.children]){
  if(child.isGroup&&withinRoom(child.position.x,child.position.z,.6))child.visible=false;
  if(child.isInstancedMesh){const matrix=new THREE.Matrix4(),position=new THREE.Vector3();for(let i=0;i<child.count;i++){child.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);if(withinRoom(position.x,position.z,.1)){matrix.makeScale(0,0,0);child.setMatrixAt(i,matrix);}}child.instanceMatrix.needsUpdate=true;}
 }
 for(const p of definition.layout)furnishing(p.type,content,p.x,p.z,p.rotation);
 housing=createHousingVisual(plan,definition.layout);content.add(housing.root);housing.update(1);
 for(const o of housingFurniture(plan,definition.layout))furnishing(o.type,content,o.x,o.z,o.rotation);
 for(const r of rooms){const start=new THREE.Vector3(r.x,.31,r.z>0?r.z-r.d/2-.3:r.z+r.d/2+.3),end=new THREE.Vector3(r.x*.4,.31,0);for(let i=0;i<7;i++){const p=start.clone().lerp(end,i/7);cyl(content,0xc2d7cb,p.x,.31,p.z,.24,.05);}}
 const g=createGame();for(const [i,p]of [g.player,...Object.values(g.npcs)].entries()){const person={...p,x:(i-2)*2,z:2.6};const rig=createCharacter(alien.scene,person);content.add(rig.root);actors.push({rig,person,config:g.config});}
 document.querySelector('#name').textContent=surface.name;
 document.querySelector('#meta').textContent=`SEED ${seed} · ${plan.name} · 家具每种一件 · 星芽育生舱 × 1`;
 document.querySelector('#variant').textContent=`${current+1} / ${SURFACES.length} · ${surface.name}`;
 history.replaceState(null,'',`?variant=${current}&seed=${seed}`);
 window.previewState={seed,index,biome:surface.id,planKind:plan.kind,planName:plan.name,rooms,corridors,baseLayout:definition.layout,furniture:[...furnished],progress:100};
 document.querySelector('#loading').hidden=true;reset();window.previewReady=true;
}
function lighting(){const night=document.querySelector('#night').checked;scene.background=new THREE.Color(night?0x202c36:0xe8eff0);ambient.intensity=night?.8:1.3;sun.intensity=night?.8:2.6;}
function resize(){renderer.setSize(innerWidth,innerHeight);const half=innerWidth<600?22*innerHeight/innerWidth:18;camera.left=-half*innerWidth/innerHeight;camera.right=-camera.left;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
function cycle(delta){current=(current+delta+SURFACES.length)%SURFACES.length;load();}
document.querySelector('#previous').onclick=()=>cycle(-1);document.querySelector('#next').onclick=()=>cycle(1);
document.querySelector('#random').onclick=()=>{samples[current].seed=crypto.getRandomValues(new Uint32Array(1))[0];load();};
document.querySelector('#reset').onclick=reset;document.querySelector('#top').onclick=()=>{camera.position.set(0,48,.01);controls.target.set(0,0,0);controls.update();};
document.querySelector('#night').onchange=lighting;
addEventListener('keydown',e=>{if(e.target.matches('input,textarea,[contenteditable]'))return;if(e.key==='ArrowRight')cycle(1);if(e.key==='ArrowLeft')cycle(-1);});
addEventListener('resize',resize);resize();lighting();load();
renderer.setAnimationLoop(ms=>{const seconds=ms/1000;terrain.update(seconds,.1,.2);content.traverse(n=>{if(n.userData.portal)n.userData.portal.material.uniforms.time.value=seconds;if(n.userData.glyphs)n.userData.glyphs.rotation.z=seconds*.1;});for(const a of actors)updateCharacter(a.rig,{person:a.person,time:seconds,delta:.016,config:a.config});controls.update();renderer.render(scene,camera);});
