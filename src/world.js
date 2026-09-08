import {createFrontGroundMaterial,createGlassPlatform} from './front-ground.js';
import {GLASS_PLATFORMS} from './glass-platforms.js';
import {createCreamGround,createReverseGround,creamEdgeOffset,ISLAND_FACE_OFFSET} from './cream-ground.js';
import {createSpiritTree} from './spirit-tree.js';
import {sideOf} from './island.js';
import {CROPS,cropVisualScale} from './plants.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {ITEMS,neighbors,canPlace} from './simulation.js';
import {appearance,groundHeight} from './characters.js';
import {createCharacter,updateCharacter} from './character-rig.js';
import {StarToonMaterial,BiolumeMaterial,stylizeAsset,createPostProcessing,createAtmosphere,createPortalMaterial,createBioluminescence} from './npr.js';
import {getWeather} from './weather.js';
import {createWeatherEffects} from './weather-effects.js';

const colors={ivory:0xe9e5d5,mint:0x93cbbb,pink:0xe8a1bc,purple:0x82789f,dark:0x34495b,gold:0xf6cd83,glow:0xb4ffe0};
const materials=new Map();
function material(color,glow=0){const key=`${color}-${glow}`;if(!materials.has(key))materials.set(key,new StarToonMaterial({color,emissive:color,emissiveIntensity:glow}));return materials.get(key);}
function mesh(parent,geo,color,pos,scale,glow=0){const o=new THREE.Mesh(geo,material(color,glow));o.position.set(...pos);if(scale)o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const box=(p,c,xyz,s)=>mesh(p,new RoundedBoxGeometry(...s,3,.09),c,xyz);
const sphere=(p,c,xyz,s,glow=0)=>mesh(p,new THREE.SphereGeometry(1,20,12),c,xyz,s,glow);
const cylinder=(p,c,xyz,r,h,rt=r)=>mesh(p,new THREE.CylinderGeometry(rt,r,h,32),c,xyz);
const ring=(p,c,xyz,r,t=.07)=>mesh(p,new THREE.TorusGeometry(r,t,10,60),c,xyz,null,.25);
function seedRandom(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

export async function createWorld(container,getGame,{onClick,onHover,onPlace}){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x10152e);scene.fog=new THREE.FogExp2(0x171c39,.006);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;container.appendChild(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-20,20,15,-15,.1,180);camera.position.set(23,25,30);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.minZoom=.65;controls.maxZoom=2.5;controls.minPolarAngle=.25;controls.maxPolarAngle=1.25;controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
 const ambient=new THREE.HemisphereLight(0xe2eaff,0x70526e,1.3);scene.add(ambient);const sun=new THREE.DirectionalLight(0xffe5d0,2.6);sun.position.set(-10,24,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,far:70});sun.shadow.normalBias=.09;sun.shadow.bias=-.00015;scene.add(sun);
 const rim=new THREE.DirectionalLight(0xdacbff,1.2);rim.position.set(12,6,-16);scene.add(rim);
 const composer=createPostProcessing(renderer,scene,camera);
 const loader=new GLTFLoader();const [alienAsset,mushroomAsset]=await Promise.all(['alien','mushroom'].map(n=>loader.loadAsync(`/assets/${n}.glb`)));
 stylizeAsset(alienAsset.scene,{character:true});stylizeAsset(mushroomAsset.scene);
 // Portrait updates share one context for the lifetime of the world.
 const portraitRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});portraitRenderer.setSize(160,160);portraitRenderer.toneMapping=renderer.toneMapping;portraitRenderer.toneMappingExposure=renderer.toneMappingExposure;
 const portraitScene=new THREE.Scene(),portraitCamera=new THREE.PerspectiveCamera(32,1,.1,10);
 portraitScene.background=new THREE.Color();portraitScene.add(new THREE.HemisphereLight(0xffffff,0x667788,1.3));
 const portraitLight=new THREE.DirectionalLight(0xffffff,2.6);portraitLight.position.set(2,3,4);portraitScene.add(portraitLight);
 // Keep portrait glow local so luminous markings do not obscure facial features.
 const portraitComposer=createPostProcessing(portraitRenderer,portraitScene,portraitCamera,{bloomStrength:.28,bloomRadius:0});portraitComposer.setSize(160,160);
 function model(source,parent,x,y,z,s=1){const o=source.scene.clone(true),living=new Map();o.position.set(x,y,z);o.scale.setScalar(s);o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;if(n.material instanceof BiolumeMaterial){if(!living.has(n.material))living.set(n.material,n.material.clone());n.material=living.get(n.material);}}});parent.add(o);return o;}
 const island=new THREE.Group();island.position.y=-ISLAND_FACE_OFFSET;scene.add(island);
 const faces={front:new THREE.Group(),back:new THREE.Group()};faces.front.position.y=ISLAND_FACE_OFFSET;faces.back.position.y=-ISLAND_FACE_OFFSET;faces.back.rotation.x=Math.PI;island.add(faces.front,faces.back);
 const terrain=new THREE.Group();faces.front.add(terrain);
 const darkTerrain=new THREE.Group();faces.back.add(darkTerrain);
 const moonGlow=new THREE.PointLight(0x9c9bea,18,28,2);moonGlow.position.set(0,5,0);darkTerrain.add(moonGlow);
 for(const [x,z,color]of [[-7,-4,0x62dfcd],[7,-4,0xa68ae6],[-7,4,0x9288e0],[7,4,0x67d4d8]]){
  const glow=new THREE.PointLight(color,9,12,2);glow.position.set(x,1.8,z);darkTerrain.add(glow);
 }

 darkTerrain.add(createReverseGround());
 for(let i=0;i<18;i++){const angle=i*Math.PI/9,x=Math.cos(angle)*13,z=Math.sin(angle)*9.2;
  const shard=mesh(darkTerrain,new THREE.OctahedronGeometry(.5),i%2?0x8872b9:0x56cabb,[x,.7+(i%4)*.2,z],[.55+(i%3)*.13,1.3+(i%4)*.5,.7],.35);shard.rotation.z=Math.sin(i)*.25;
  const glyph=ring(darkTerrain,0x619796,[x,.34,z],.7,.02);glyph.rotation.x=-Math.PI/2;
 }
 for(const [x,z]of [[-6,-4],[6,4],[-6,4],[6,-4]]){
  const rim=ring(darkTerrain,0x4d4768,[x,.30,z],1.5,.045);rim.rotation.x=-Math.PI/2;rim.scale.z=.35;
  for(let i=0;i<5;i++){const a=i*1.256,stone=mesh(darkTerrain,new THREE.DodecahedronGeometry(.24),0x6e658a,[x+Math.cos(a)*1.65,.27,z+Math.sin(a)*1.65],[1,.18,1.2]);stone.rotation.y=a;}
 }

 terrain.add(createCreamGround());
 for(const platform of GLASS_PLATFORMS)terrain.add(createGlassPlatform(platform));
 const random=seedRandom(28);
 const atmosphere=createAtmosphere(scene,camera,seedRandom(91)),swaying=[],floating=[],ripples=[],crystalLights=[];
 const weatherEffects=createWeatherEffects(scene,seedRandom(137));
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const shard=mesh(terrain,new THREE.OctahedronGeometry(.3),0x82e4db,[Math.cos(a)*14,-1.7,Math.sin(a)*10], [1,2.6,1],.65);floating.push({object:shard,y:shard.position.y,phase:i});}
 for(let i=0;i<65;i++){const a=random()*Math.PI*2,r=14+random()+creamEdgeOffset(a);mesh(terrain,new THREE.DodecahedronGeometry(.45+random()*.65),[0x9a809d,0xb298af,0x6e6d88][i%3],[Math.cos(a)*r,-1.15-random()*.25,Math.sin(a)*r*.71],[.65,.32,.65]);}
 // Open-front habitat: three rooms share a clear, navigable central aisle.
 box(terrain,colors.ivory,[-2,.02,-2.5],[12.8,.28,7.5]);
 box(terrain,0xcfd4c7,[-2,1.4,-6.1],[12.9,2.8,.22]);
 box(terrain,0x839fa0,[-8.4,.85,-2.5],[.22,1.6,7.5]);
 box(terrain,0xedc5c2,[-2,.21,-2.5],[.14,.1,7.4]);
 const bedroomFloor=box(terrain,0xbda6ba,[-5.2,.21,-2.5],[6.1,.08,7.3]);bedroomFloor.material=createFrontGroundMaterial(0xbda6ba);
 const livingFloor=box(terrain,0xbce0d4,[1.1,.21,-2.5],[6,.08,7.3]);livingFloor.material=createFrontGroundMaterial(0xbce0d4);
 for(let x=-6;x<=2;x+=4){box(terrain,0x789e9c,[x,1.65,-5.94],[2.2,1.45,.08]);box(terrain,0xa5dad9,[x,1.7,-5.87],[1.98,1.2,.05]);box(terrain,0xf3eee0,[x,1.7,-5.81],[.055,1.2,.06]);}
 for(let x=-7;x<5;x+=2)box(terrain,colors.ivory,[x,.09,2.0],[1.6,.12,.85]);
 const rug=cylinder(terrain,0xe4bdab,[-4,.3,.2],2,.025);rug.scale.z=.62;
 // Outdoor research deck, garden pond, and distant alien landscape.
 const pond=cylinder(terrain,0x768da5,[7,.03,4.7],2.3,.17);pond.scale.z=.65;
 const water=cylinder(terrain,0x79cdd0,[7,.15,4.7],2.07,.05);water.scale.z=.65;
 water.material=material(0x79cdd0,.15);
 for(let i=0;i<3;i++){const r=ring(terrain,0xb8eece,[7,.2,4.7],1,.014);r.rotation.x=-Math.PI/2;r.material=new THREE.MeshBasicMaterial({color:0x9affed,transparent:true,opacity:.5,depthWrite:false});ripples.push(r);}
 [[-10,-5,1.55],[-11,-1,1.2],[-10,5,1.1],[4,-8,1.4],[11,1,1.0],[10,7,.85],[-5,-8,.9]].forEach(([x,z,s])=>swaying.push(model(mushroomAsset,terrain,x,0,z,s)));
 function crystal(parent,x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);const facets=[];
  for(let i=0;i<5;i++){const h=(.7+random()*.7)*s,color=[0x9ce9d5,0xd2b0e4,0x86c0e2][i%3];
   const profile=[[0,0],[.12,0],[.2,.58],[0,1]].map(([r,y])=>new THREE.Vector2(r*s,y*h));
   const geometry=new THREE.LatheGeometry(profile,5).toNonIndexed();geometry.computeVertexNormals();
   const o=mesh(g,geometry,color,[(random()-.5)*s,0,(random()-.5)*s]);o.material=new BiolumeMaterial({color,emissive:color,emissiveIntensity:1});o.rotation.z=(random()-.5)*.5;facets.push(o.material);
  }
  g.userData.crystalLight={facets,phase:(x+z)*.7};if(parent===terrain)crystalLights.push(g.userData.crystalLight);return g;
 }
 for(let i=0;i<40;i++){const x=(random()-.5)*26,z=(random()-.5)*17;if((x>-9&&x<11&&z>-6&&z<6)||x*x/190+z*z/85>1)continue;crystal(terrain,x,z,.3+random()*.8);}
 for(let i=0;i<48;i++){const x=(random()-.5)*27,z=(random()-.5)*17;if((x>-9&&x<10&&z>-6&&z<6)||x*x/190+z*z/85>1)continue;const stalk=cylinder(terrain,0x789d8d,[x,.18,z],.035,.35);sphere(terrain,[0xe8accd,0xf1d7a0,0xb3e3bd][i%3],[stalk.position.x,.42,z],[.17,.23,.17],.2);}
 for(let i=0;i<20;i++){const a=i/20*Math.PI*2;const r=18+random()*10;const rock=mesh(scene,new THREE.IcosahedronGeometry(1+random()*1.4,0),0x615e7e,[Math.cos(a)*r,-4-random()*4,Math.sin(a)*r*.6],[1.5,1,1]);floating.push({object:rock,y:rock.position.y,phase:i*.73});}
 const planet=sphere(scene,0xb19faf,[-2,-5,-28],[2.5,2.5,2.5]);const orbit=ring(scene,0xd2b5ac,[-2,-5,-28],3.7,.12);orbit.rotation.x=1.1;orbit.rotation.y=.2;
 const interactive=new THREE.Group();faces.front.add(interactive);const backInteractive=new THREE.Group();faces.back.add(backInteractive);const surfaceItems={front:interactive,back:backInteractive};const objectMeshes=new Map();
 function prop(type){if(type==='spiritTree')return createSpiritTree();const g=new THREE.Group();
  if(type==='polelight'){
   cylinder(g,0x48485e,[0,.12,0],.42,.24);cylinder(g,0x7e88a4,[0,1.65,0],.065,3.1,.09);
   for(const y of [.4,2.8]){const collar=ring(g,0xa2bccc,[0,y,0],.13,.03);collar.rotation.x=Math.PI/2;}
   const head=cylinder(g,0x79859e,[0,3.4,0],.56,.18,.35);
   const lens=cylinder(g,0xc8e7ff,[0,3.29,0],.46,.045);lens.material=material(0xc8e7ff,1.4);
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
  if(type==='lamp'){cylinder(g,colors.ivory,[0,.15,0],.35,.3);cylinder(g,colors.purple,[0,.7,0],.045,1);sphere(g,colors.gold,[0,1.4,0],[.35,.35,.35],.7);ring(g,colors.ivory,[0,1.4,0],.48,.035).rotation.x=1.1;}
  const lighting=ITEMS.find(item=>item.id===type)?.lighting;if(lighting){const light=new THREE.PointLight(lighting.color,lighting.intensity,Math.hypot(lighting.radius,lighting.height),2);light.position.set(0,lighting.height,0);g.add(light);}
  if(CROPS[type]){g.userData.cropLight=createBioluminescence(g,{radius:type==='garden'?.8:.65,height:type==='garden'?1.3:1.8,color:0xc9e8e4});for(const crop of g.userData.cropVisual)crop.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.userData.plantColor=n.material.color.clone();}});for(const crop of g.userData.cropVisual)if(crop.userData.fruit){const fruit=crop.userData.fruit;fruit.material=new BiolumeMaterial({color:fruit.material.color,emissive:0xbce6d9,emissiveIntensity:1});}}
  return g;
 }
 function syncObjects(){const g=getGame();for(const[id,o]of objectMeshes)if(!g.objects.some(x=>x.id===id)){o.userData.spiritTree?.dispose();o.removeFromParent();objectMeshes.delete(id);}for(const o of g.objects){if(!objectMeshes.has(o.id)){const group=prop(o.type);group.position.set(o.x,o.type==='spiritTree'?groundHeight(o.x,o.z,sideOf(o)):.29,o.z);group.rotation.y=o.rotation;group.userData.target={kind:'object',id:o.id};objectMeshes.set(o.id,group);}surfaceItems[sideOf(o)].add(objectMeshes.get(o.id));}}
 const actors=new Map();
 function syncActors(){
  const g=getGame(),residents=[...(g.player.alive?[{id:'player',...g.player}]:[]),...neighbors(g)];
  for(const [id,rig]of actors)if(!residents.some(n=>n.id===id&&n.uid===rig.uid)){
   rig.root.removeFromParent();rig.prayerVisuals.dispose();rig.root.traverse(n=>{if(n.isMesh)n.material.dispose();});for(const skeleton of new Set(Object.values(rig.limbs).map(l=>l.mesh.skeleton)))skeleton.dispose();actors.delete(id);
  }
  for(const data of residents)if(!actors.has(data.id)){
   const rig=createCharacter(alienAsset.scene,data);rig.uid=data.uid;rig.root.userData.target={kind:data.id==='player'?'player':'npc',id:data.id};surfaceItems[sideOf(data)].add(rig.root);actors.set(data.id,rig);
  }
 }
 syncActors();
 const marker=mesh(faces.front,new THREE.OctahedronGeometry(.25),0xb9ffca,[0,2.65,2],null,.7);
 const selected=ring(faces.front,0xc1ffd0,[0,.3,2],.52,.035);selected.rotation.x=-Math.PI/2;
 const ghost=new THREE.Group();faces.front.add(ghost);let buildType=null,buildRotation=0,ghostProp=null;
 const buildGrid=new THREE.GridHelper(22,22,0xc6ffd5,0xaba3b0);buildGrid.position.y=.29;buildGrid.material.transparent=true;buildGrid.material.opacity=.28;buildGrid.visible=false;faces.front.add(buildGrid);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),-.29);let hoverTarget=null;let pointerDown=null;
 function hit(event){const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
  const side=getGame().viewSide,face=faces[side];face.updateWorldMatrix(true,false);
  const plane=ground.clone().applyMatrix4(face.matrixWorld),point=new THREE.Vector3();
  if(!raycaster.ray.intersectPlane(plane,point))return {target:null,point:new THREE.Vector3(1000,0,1000)};
  face.worldToLocal(point);const hits=raycaster.intersectObjects(surfaceItems[side].children,true);let target=null;
  if(hits[0]){let o=hits[0].object;while(o&&!o.userData.target)o=o.parent;target=o?.userData.target;}return{target,point};
 }
 renderer.domElement.addEventListener('pointermove',e=>{if(container.dataset.flipping==='true')return;const h=hit(e);if(buildType){ghost.position.set(Math.round(h.point.x),.3,Math.round(h.point.z));ghost.visible=Math.abs(h.point.x)<12&&Math.abs(h.point.z)<8;const valid=canPlace(getGame(),ghost.position.x,ghost.position.z);ghost.traverse(n=>{if(n.isMesh)n.material.color.set(valid?0xafffca:0xff7e94);});}else{hoverTarget=h.target;renderer.domElement.style.cursor=h.target?'pointer':'default';onHover(h.target,e.clientX,e.clientY);}});
 renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};});
 renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>6)return;const h=hit(e);if(buildType){onPlace(buildType,Math.round(h.point.x),Math.round(h.point.z),buildRotation);return;}if(h.target)onClick(h.target,e.clientX,e.clientY);else if(Math.abs(h.point.x)<=11&&Math.abs(h.point.z)<=7)onClick({kind:'ground',point:{x:h.point.x,z:h.point.z}},e.clientX,e.clientY);});
 renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
 function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);const v=14;camera.left=-v*w/h;camera.right=v*w/h;camera.top=v;camera.bottom=-v;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(container);resize();syncObjects();
 let previousSimTime=null,previousFrame=performance.now();island.rotation.x=getGame().viewSide==='back'?Math.PI:0;
 return {
   render(){const g=getGame(),weather=getWeather(g),now=performance.now(),frameDt=Math.min((now-previousFrame)/1000,.1);previousFrame=now;
   const flipTarget=g.viewSide==='back'?Math.PI:0;island.rotation.x=THREE.MathUtils.damp(island.rotation.x,flipTarget,5,frameDt);
   faces[g.viewSide].add(ghost,buildGrid);faces[sideOf(g.player)].add(marker,selected);
   container.dataset.side=g.viewSide;container.dataset.flipping=String(Math.abs(island.rotation.x-flipTarget)>.01);syncObjects();syncActors();for(const o of g.objects){if(!CROPS[o.type])continue;const group=objectMeshes.get(o.id),p=o.plant;for(const crop of group.userData.cropVisual){crop.scale.setScalar(cropVisualScale(p.growth,p.giant));crop.rotation.z=p.health<=0?.45:p.water<25?.15:0;crop.traverse(n=>{if(n.isMesh){n.userData.plantColor&&n.material.color.copy(n.userData.plantColor).lerp(new THREE.Color(0x80664c),1-p.health/100);}});if(crop.userData.fruit)crop.userData.fruit.visible=p.growth>=.7&&p.health>0;}}const time=((g.day-1)*1440+g.minute)/(g.config?.time?.gameMinutesPerRealSecond??2),delta=previousSimTime===null?0:Math.max(0,time-previousSimTime);previousSimTime=time;
   for(const[id,rig]of actors){
    const person=id==='player'?g.player:g.npcs[id],action=(id==='player'?g.queue:person.queue)[0];
    let partner=g.queue[0]?.targetId===id?g.player:action&&g.npcs[action.targetId]?g.npcs[action.targetId]:Object.values(g.npcs).find(n=>n.queue[0]?.targetId===id);
    if(action?.phase==='acting'&&['relax','lounge'].includes(action.type)){const peers=[{id:'player',person:g.player,queue:g.queue},...Object.entries(g.npcs).map(([id,person])=>({id,person,queue:person.queue}))].filter(a=>a.id!==id&&a.queue[0]?.phase==='acting'&&['relax','lounge'].includes(a.queue[0].type)&&a.queue[0].targetId===action.targetId);if(peers.length)partner=peers[Math.floor(time/4)%peers.length].person;}
     surfaceItems[sideOf(person)].add(rig.root);
     const visualAction=action?.transit?{type:'travel',phase:'acting',elapsed:action.transit.elapsed}:action;
     updateCharacter(rig,{person,action:visualAction,object:action?g.objects.find(o=>o.id===(action.transit?.sourceId||action.targetId)):undefined,partner:partner&&sideOf(partner)===sideOf(person)?partner:null,time,delta,config:g.config});
   }
    marker.visible=selected.visible=g.player.alive&&sideOf(g.player)===g.viewSide;const main=actors.get('player')?.root.position||new THREE.Vector3(g.player.x,0,g.player.z);marker.position.set(main.x,main.y+2.65*appearance(g.player,g.config.lifeStages).scale+Math.sin(time*3)*.06,main.z);marker.rotation.y=time;selected.position.set(main.x,groundHeight(main.x,main.z,sideOf(g.player))+.025,main.z);
   for(const [id,o]of objectMeshes){if(o.userData.rift){o.userData.rift.material.uniforms.time.value=time;o.userData.riftFrame.position.y=1.5+Math.sin(time*1.4)*.06;}if(o.userData.orb)o.userData.orb.position.y=1.4+Math.sin(time*1.4)*.09;if(o.userData.egg){o.userData.egg.visible=g.incubations.some(b=>b.podId===id);o.userData.egg.position.y=.8+Math.sin(time*1.5)*.06;}if(o.userData.portal){o.userData.portal.material.uniforms.time.value=time;o.userData.glyphs.rotation.z=time*.09;}if(o.userData.cropVisual)for(const [i,crop]of o.userData.cropVisual.entries())crop.rotation.z+=Math.sin(time*.85+i+o.position.x)*.025;}
   atmosphere.update(time,weather,(1+Math.cos(island.rotation.x))/2);weatherEffects.update(time,weather);
   const daylight=THREE.MathUtils.smoothstep(Math.sin((g.minute/1440-.25)*Math.PI*2),-.18,.4),bioStrength=.5+(1-daylight)*.95;
   const blessings=[g.queue[0],...Object.values(g.npcs).map(n=>n.queue[0])].filter(a=>a?.type==='pray'&&a.phase==='celebrating');
   for(const item of g.objects)if(item.type==='spiritTree'){
    const tree=objectMeshes.get(item.id).userData.spiritTree;tree.update(time+item.x*.7+item.z,sideOf(item),daylight,weather.wind);
    tree.updateBlessing(blessings.find(a=>a.targetId===item.id),camera);
   }
   for(const {facets,phase}of [...crystalLights,...[...objectMeshes.values()].filter(o=>o.userData.crystalLight).map(o=>o.userData.crystalLight)])for(const m of facets){m.bio.time.value=time+phase;m.bio.strength.value=bioStrength*.7;}
   for(const [i,plant]of swaying.entries())plant.traverse(n=>{if(n.isMesh&&n.material instanceof BiolumeMaterial){n.material.bio.time.value=time+i*.67+(n.material.name==='Pearl stem'?.7:0);n.material.bio.strength.value=bioStrength;}});
   for(const item of g.objects){if(!CROPS[item.type])continue;const group=objectMeshes.get(item.id),health=item.plant.health/100,growth=item.plant.growth;
    group.userData.cropLight.update(time+item.x,health*(.2+growth*.5)*(1-daylight*.65));
    for(const crop of group.userData.cropVisual)crop.traverse(n=>{if(n.isMesh&&n.material instanceof BiolumeMaterial){n.material.bio.time.value=time+item.x;n.material.bio.strength.value=bioStrength*health*(.3+growth*.7);}else if(n.isMesh&&n.material.name==='Bioluminescence')n.material.emissiveIntensity=.22*health;});
   }
   swaying.forEach((o,i)=>{o.rotation.z=Math.sin(time*.42+i*1.7)*.018*(1+weather.wind);o.rotation.x=Math.cos(time*.31+i)*.012*(1+weather.wind);});
   floating.forEach(({object,y,phase})=>{object.position.y=y+Math.sin(time*.27+phase)*.18;object.rotation.y=Math.sin(time*.1+phase)*.08;});
   ripples.forEach((o,i)=>{const phase=(time*.12+i/3)%1,r=.3+phase*1.7;o.scale.set(r,r*.65,1);o.material.opacity=Math.sin(phase*Math.PI)*.5;});
   const dark=(1-Math.cos(island.rotation.x))/2;
   sun.intensity=(.65+daylight*1.95)*(1-dark*.75)*(1-weather.weights.rain*.22-weather.weights.mist*.12);
   ambient.intensity=(.85+daylight*.45)*(1-dark*.32);
   rim.intensity=(1.2+(1-daylight)*.25)*(1+dark*.25);
   sun.color.set(0xffe5d0).lerp(new THREE.Color(0x8895df),dark);ambient.color.set(0xe2eaff).lerp(new THREE.Color(0x8194c8),dark);
   ambient.groundColor.set(0x70526e);rim.color.set(0xdacbff).lerp(new THREE.Color(0x60bfc6),dark);
   scene.fog.density=.006+weather.weights.mist*.003+weather.weights.rain*.001;
   scene.background.set(0x10152e).lerp(new THREE.Color(0x080b1b),dark);scene.fog.color.set(0x171c39).lerp(new THREE.Color(0x15182e),dark);scene.fog.density+=dark*.007;
   controls.update();composer.render();
  },
  setBuild(type){buildType=type;buildGrid.visible=!!type;ghost.visible=false;if(ghostProp){ghost.remove(ghostProp);ghostProp.userData.spiritTree?.dispose();ghostProp.traverse(n=>{if(n.isMesh)n.material.dispose();});}if(type){ghostProp=prop(type);ghostProp.traverse(n=>{if(n.isLight||n.isPoints)n.visible=false;if(n.isMesh)n.material=new THREE.MeshBasicMaterial({color:0xafffca,transparent:true,opacity:.45,side:n.material.side});});ghost.add(ghostProp);const lighting=ITEMS.find(item=>item.id===type)?.lighting;if(lighting){const coverage=ring(ghostProp,lighting.color,[0,.025,0],lighting.radius,.025);coverage.rotation.x=-Math.PI/2;coverage.material=new THREE.MeshBasicMaterial({color:lighting.color,transparent:true,opacity:.45,depthWrite:false});}}return type;},
  rotateBuild(){buildRotation+=Math.PI/2;ghost.rotation.y=buildRotation;},
  focus(id){const p=id==='home'?{x:-3,z:-1}:id==='garden'?{x:7,z:3}:id==='lab'?{x:6,z:-3}:getGame().player;const dx=p.x-controls.target.x,dz=p.z-controls.target.z;controls.target.set(p.x,0,p.z);camera.position.x+=dx;camera.position.z+=dz;},
  resetCamera(){camera.position.set(23,25,30);controls.target.set(0,0,0);camera.zoom=1;camera.updateProjectionMatrix();},
  zoom(delta){camera.zoom=THREE.MathUtils.clamp(camera.zoom+delta,.65,2.5);camera.updateProjectionMatrix();},
  portrait(id){
    const person=id==='player'?getGame().player:getGame().npcs[id],color=person.color,config=getGame().config;
    const rig=createCharacter(alienAsset.scene,{id,color,...person});updateCharacter(rig,{person:{...person,x:0,z:0},time:0,delta:0,config});rig.root.rotation.set(0,0,0);rig.root.position.set(0,0,0);
   portraitScene.background.set(id==='player'?0xc3e6c8:0xd4cde5);portraitScene.add(rig.root);
   const scale=appearance(person,config.lifeStages).scale;portraitCamera.position.set(0,1.65*scale,3.3*scale);portraitCamera.lookAt(0,1.45*scale,0);
   portraitComposer.render();const url=portraitRenderer.domElement.toDataURL();
   rig.root.removeFromParent();portraitRenderer.renderLists.dispose();rig.prayerVisuals.dispose();rig.body.traverse(n=>{if(n.isMesh)n.material.dispose();});for(const skeleton of new Set(Object.values(rig.limbs).map(l=>l.mesh.skeleton)))skeleton.dispose();return url;
  }
 };
}
