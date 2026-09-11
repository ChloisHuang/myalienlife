import {elementPoint,controlSurface} from './viewport.js';
import {batchStatic,disposeStaticBatches} from './static-batching.js';
import {BLINK_SECONDS} from './nether-blink.js';
import {isRadiant} from './prayer.js';
import {createBlinkVisual} from './nether-blink-visuals.js';
import {shipFoodStatus} from './space-logistics.js';
import {ufoHoverMotion,createUfoVisual,ufoDock,ufoFlightPresentation,ufoPassengerPresentation,createUfoTransferBeam} from './ufo-visuals.js';
import {islandDefinition,islandCatalog,discovered} from './civilization.js';
import {createIslandTerrain} from './island-terrain.js';
import {createFairytaleKit} from './fairytale.js';
import {createHousingVisual} from './settlement-visuals.js';
import {createFrontGroundMaterial,createGlassPlatform} from './front-ground.js';
import {GLASS_PLATFORMS} from './glass-platforms.js';
import {createCreamGround,createReverseGround,creamEdgeOffset,ISLAND_FACE_OFFSET} from './cream-ground.js';
import {createCrystalFactory} from './crystal.js';
import {sideOf,islandOf,sameSide} from './island.js';
import {CROPS,cropVisualScale,mushroomVariant} from './plants.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {ITEMS,neighbors,canPlace} from './simulation.js';
import {appearance,groundHeight} from './characters.js';
import {createCharacter,updateCharacter} from './character-rig.js';
import {createLivingVisual,createGardenBondVisual,createLivingTrailVisual,livingPose} from './living-visuals.js';
import {livingSite} from './living-state.js';
import {createStoryMoon} from './story-moon.js';
import {prepareSurroundings,updateSurroundings} from './storybook-surroundings.js';
import {BiolumeMaterial,stylizeAsset,createPostProcessing,createAtmosphere,createBioluminescence} from './npr.js';
import {getWeather} from './weather.js';
import {createWeatherEffects} from './weather-effects.js';
import {getLanguage,translateText} from './i18n.js';
import {getQualityProfile} from './performance-settings.js';
import {createIslandPreviews} from './island-previews.js';

import {colors,material,mesh,box,sphere,cylinder,ring,createPropFactory} from './props.js';
const CAMERA_ZOOM=.92,CAMERA_PAN_RIGHT=2.4;
function seedRandom(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

export async function createWorld(container,getGame,{onClick,onHover,onPlace,weatherProvider=getWeather,qualityProfile=getQualityProfile('pc','high')}){
 let sceneOnly=false;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x10152e);scene.fog=new THREE.FogExp2(0x171c39,.006);
 // The scene is already multisampled in the composer; the canvas receives only its fullscreen output.
 const initialQuality={...qualityProfile};
 const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,initialQuality.maxPixelRatio));renderer.shadowMap.enabled=initialQuality.shadows;renderer.shadowMap.type=initialQuality.shadows?THREE.PCFSoftShadowMap:THREE.BasicShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;container.appendChild(renderer.domElement);
 const createCrystalMesh=createCrystalFactory(renderer);
 const cameraStart=new THREE.Vector3(23,25,30),camera=new THREE.OrthographicCamera(-20,20,15,-15,.1,180);camera.position.copy(cameraStart);
 const controls=new OrbitControls(camera,controlSurface(renderer.domElement));controls.target.set(0,0,0);controls.enableDamping=true;controls.minZoom=.65;controls.maxZoom=2.5;controls.minPolarAngle=.25;controls.maxPolarAngle=1.25;controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
 camera.lookAt(controls.target);camera.updateMatrixWorld();const cameraOffset=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar(CAMERA_PAN_RIGHT);
 function resetView(){camera.position.copy(cameraStart).add(cameraOffset);controls.target.copy(cameraOffset);camera.zoom=CAMERA_ZOOM;camera.lookAt(controls.target);camera.updateProjectionMatrix();}
 resetView();
 const ambient=new THREE.HemisphereLight(0xe2eaff,0x70526e,1.3);scene.add(ambient);const sun=new THREE.DirectionalLight(0xffe5d0,2.6);sun.position.set(-10,24,14);sun.castShadow=initialQuality.shadows;sun.shadow.mapSize.set(initialQuality.shadowMapSize,initialQuality.shadowMapSize);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,far:70});sun.shadow.normalBias=.09;sun.shadow.bias=-.00015;scene.add(sun);
 const rim=new THREE.DirectionalLight(0xdacbff,1.2);rim.position.set(12,6,-16);scene.add(rim);
 const composer=createPostProcessing(renderer,scene,camera);
 const loader=new GLTFLoader();const [alienAsset,mushroomAsset]=await Promise.all(['alien','mushroom'].map(n=>loader.loadAsync(`/assets/${n}.glb`)));
 stylizeAsset(alienAsset.scene,{character:true});stylizeAsset(mushroomAsset.scene);
 const draco=new DRACOLoader();draco.setDecoderPath('/assets/draco/');draco.setDecoderConfig({type:'wasm'});loader.setDRACOLoader(draco);
 const fairytaleAsset=await loader.loadAsync('/assets/fairytale.glb');
 const environmentAsset=await loader.loadAsync('/assets/fairytale-environment.glb');
 const fairytaleKit=createFairytaleKit(fairytaleAsset.scene,environmentAsset.scene);draco.dispose();
 const mushroomVariants={normal:mushroomAsset};for(const name of ['giant','cluster','mutant','mutant-cluster']){const asset=await loader.loadAsync(`/assets/mushroom-${name}.glb`);stylizeAsset(asset.scene);mushroomVariants[name]=asset;}
 // Portrait updates share one context for the lifetime of the world.
 const portraitRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});portraitRenderer.setSize(160,160);portraitRenderer.toneMapping=renderer.toneMapping;portraitRenderer.toneMappingExposure=renderer.toneMappingExposure;
 const portraitScene=new THREE.Scene(),portraitCamera=new THREE.PerspectiveCamera(32,1,.1,10);
 portraitScene.background=new THREE.Color();portraitScene.add(new THREE.HemisphereLight(0xffffff,0x667788,1.3));
 const portraitLight=new THREE.DirectionalLight(0xffffff,2.6);portraitLight.position.set(2,3,4);portraitScene.add(portraitLight);
 // Keep portrait glow local so luminous markings do not obscure facial features.
 const portraitComposer=createPostProcessing(portraitRenderer,portraitScene,portraitCamera,{bloomStrength:.28,bloomRadius:0});portraitComposer.setSize(160,160);
 const textures=new Set(),textureDefaults=new Map();
 function trackTextures(root){root.traverse(node=>{for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'])if(material[key])textures.add(material[key]);}});}
 // High restores loader defaults so the original asset appearance is unchanged.
 function applyTextureQuality(profile){for(const texture of textures){if(profile.textureQuality==='high'){const original=textureDefaults.get(texture);if(original){texture.anisotropy=original.anisotropy;texture.magFilter=original.magFilter;texture.minFilter=original.minFilter;texture.needsUpdate=true;}continue;}if(!textureDefaults.has(texture))textureDefaults.set(texture,{anisotropy:texture.anisotropy,magFilter:texture.magFilter,minFilter:texture.minFilter});const mipmapped=profile.textureQuality!=='low';texture.anisotropy=profile.textureAnisotropy;texture.magFilter=THREE.LinearFilter;texture.minFilter=mipmapped?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;texture.needsUpdate=true;}}
 function model(source,parent,x,y,z,s=1){const o=source.scene.clone(true),living=new Map();o.position.set(x,y,z);o.scale.setScalar(s);o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;if(n.material instanceof BiolumeMaterial){if(!living.has(n.material))living.set(n.material,n.material.clone());n.material=living.get(n.material);}}});parent.add(o);trackTextures(o);return o;}
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
  const shard=createCrystalMesh(new THREE.OctahedronGeometry(.5),i%2?0xb5a5df:0x8bdedb);shard.position.set(x,.7+(i%4)*.2,z);shard.scale.set(.55+(i%3)*.13,1.3+(i%4)*.5,.7);darkTerrain.add(shard);shard.rotation.z=Math.sin(i)*.25;
  const glyph=ring(darkTerrain,0x619796,[x,.34,z],.7,.02);glyph.rotation.x=-Math.PI/2;
 }
 for(const [x,z]of [[-6,-4],[6,4],[-6,4],[6,-4]]){
  const rim=ring(darkTerrain,0x4d4768,[x,.30,z],1.5,.045);rim.rotation.x=-Math.PI/2;rim.scale.z=.35;
  for(let i=0;i<5;i++){const a=i*1.256,stone=mesh(darkTerrain,new THREE.DodecahedronGeometry(.24),0x6e658a,[x+Math.cos(a)*1.65,.27,z+Math.sin(a)*1.65],[1,.18,1.2]);stone.rotation.y=a;}
 }

 terrain.add(createCreamGround());
 for(const platform of GLASS_PLATFORMS)terrain.add(createGlassPlatform(platform));
 const random=seedRandom(28);
 const atmosphere=createAtmosphere(scene,camera,seedRandom(91)),swaying=[],floating=[],ripples=[],crystalLights=[],qualityLodTargets=[];
 const weatherEffects=createWeatherEffects(scene,seedRandom(137));
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const shard=createCrystalMesh(new THREE.OctahedronGeometry(.3),0x82e4db);shard.position.set(Math.cos(a)*14,-1.7,Math.sin(a)*10);shard.scale.set(1,2.6,1);terrain.add(shard);floating.push({object:shard,y:shard.position.y,phase:i});}
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
 [[-10,-5,1.55],[-11,-1,1.2],[-10,5,1.1],[4,-8,1.4],[11,1,1.0],[10,7,.85],[-5,-8,.9]].forEach(([x,z,s])=>{const plant=model(mushroomAsset,terrain,x,0,z,s);swaying.push(plant);qualityLodTargets.push(plant);});
 function crystal(parent,x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);const facets=[];
  for(let i=0;i<5;i++){const h=(.7+random()*.7)*s,color=[0x9ce9d5,0xd2b0e4,0x86c0e2][i%3];
   const profile=[[0,0],[.14,0],[.19,.18],[.19,.72],[0,1]].map(([r,y])=>new THREE.Vector2(r*s,y*h));
   const geometry=new THREE.LatheGeometry(profile,6).toNonIndexed();geometry.computeVertexNormals();
   const o=createCrystalMesh(geometry,color);o.position.set((random()-.5)*s,0,(random()-.5)*s);g.add(o);o.rotation.z=(random()-.5)*.5;facets.push(o.material);
  }
  g.userData.crystalLight={facets,phase:(x+z)*.7};if(parent===terrain)crystalLights.push(g.userData.crystalLight);return g;
 }
 for(let i=0;i<40;i++){const x=(random()-.5)*26,z=(random()-.5)*17;if((x>-9&&x<11&&z>-6&&z<6)||x*x/190+z*z/85>1)continue;crystal(terrain,x,z,.3+random()*.8);}
 for(let i=0;i<48;i++){const x=(random()-.5)*27,z=(random()-.5)*17;if((x>-9&&x<10&&z>-6&&z<6)||x*x/190+z*z/85>1)continue;const stalk=cylinder(terrain,0x789d8d,[x,.18,z],.035,.35);sphere(terrain,[0xe8accd,0xf1d7a0,0xb3e3bd][i%3],[stalk.position.x,.42,z],[.17,.23,.17],.2);}
 for(let i=0;i<20;i++){const a=i/20*Math.PI*2;const r=18+random()*10;const rock=mesh(scene,new THREE.IcosahedronGeometry(1+random()*1.4,0),0x615e7e,[Math.cos(a)*r,-4-random()*4,Math.sin(a)*r*.6],[1.5,1,1]);floating.push({object:rock,y:rock.position.y,phase:i*.73});}
 const planet=sphere(scene,0xb19faf,[-2,-5,-28],[2.5,2.5,2.5]);const orbit=ring(scene,0xd2b5ac,[-2,-5,-28],3.7,.12);orbit.rotation.x=1.1;orbit.rotation.y=.2;
 const storyMoon=createStoryMoon(fairytaleKit.environment('orbit-front'));scene.add(storyMoon.root,storyMoon.light,storyMoon.light.target);
 const themedSurroundings=['front','back'].map(side=>{
  const root=new THREE.Group();root.name=`storybook-surroundings-${side}`;scene.add(root);
  const fragments=floating.filter(f=>f.object.parent===scene).map(({object})=>{
   const mesh=fairytaleKit.environment(`fragment-${side}`);mesh.scale.copy(object.scale).multiplyScalar(object.geometry.parameters.radius*.65);root.add(mesh);return {mesh,source:object};
  });return {side,root,fragments,materials:prepareSurroundings(root)};
 });
 batchStatic(terrain,{exclude:new Set([...swaying,...floating.map(f=>f.object),...ripples])});batchStatic(darkTerrain);
 let remoteTerrain=null,remoteHousing=null,terrainIsland=null,quality={...initialQuality},vegetationFrame=0;
 const terrainCache=new Map();
 const lodCameraPosition=new THREE.Vector3(),lodTargetPosition=new THREE.Vector3();
 function updateModelLod(){
  camera.getWorldPosition(lodCameraPosition);
  let hidden=0;
   for(const target of qualityLodTargets){
    if(!target.parent)continue;
    const far=quality.modelLod!=='off'&&lodCameraPosition.distanceTo(target.getWorldPosition(lodTargetPosition))>quality.modelLodDistance;
    if(target.userData.qualityLodFar===far){if(!target.visible)hidden++;continue;}
    target.userData.qualityLodFar=far;
    // LOD only removes shadow work; the source model remains visible at every quality.
    target.traverse(node=>{if(!node.isMesh)return;if(far){node.userData.qualityShadowFlags??={castShadow:node.castShadow,receiveShadow:node.receiveShadow};node.castShadow=node.receiveShadow=false;}else if(node.userData.qualityShadowFlags){node.castShadow=node.userData.qualityShadowFlags.castShadow;node.receiveShadow=node.userData.qualityShadowFlags.receiveShadow;delete node.userData.qualityShadowFlags;}});
    if(!target.visible)hidden++;
   }
  container.dataset.qualityLodHidden=String(hidden);
  }
 function syncTerrain(g){
  const catalog=islandCatalog(g);
  for(const [id,entry] of terrainCache)if(!Object.hasOwn(catalog,id)){
   const stale=new Set(Object.values(entry.terrain).flatMap(t=>t.lodTargets));
   for(let i=qualityLodTargets.length-1;i>=0;i--)if(stale.has(qualityLodTargets[i]))qualityLodTargets.splice(i,1);
   for(const t of Object.values(entry.terrain))t.dispose();entry.housing?.dispose();terrainCache.delete(id);
   if(terrainIsland===id){remoteTerrain=null;remoteHousing=null;terrainIsland=null;}
  }
  for(const [id,entry] of terrainCache){for(const t of Object.values(entry.terrain))t.root.visible=id===g.viewIsland;if(entry.housing)entry.housing.root.visible=id===g.viewIsland;}
  terrain.visible=darkTerrain.visible=g.viewIsland==='home';
  if(g.viewIsland==='home'){if(remoteTerrain)for(const t of Object.values(remoteTerrain))t.root.visible=false;if(remoteHousing)remoteHousing.root.visible=false;return;}
  if(terrainIsland!==g.viewIsland){
   const cached=terrainCache.get(g.viewIsland);remoteTerrain=cached?.terrain??{};remoteHousing=cached?.housing??null;
   if(!cached){
    const definition=islandDefinition(g,g.viewIsland);
    for(const side of ['front','back']){const t=definition.theme==='fairytale'?fairytaleKit.terrain(side):createIslandTerrain(definition,mushroomAsset.scene,side);faces[side].add(t.root);remoteTerrain[side]=t;qualityLodTargets.push(...t.lodTargets);trackTextures(t.root);applyTextureQuality(quality);}
    const project=g.civilization.projects[g.viewIsland];if(project&&definition.theme!=='fairytale'){remoteHousing=createHousingVisual(project.plan,g.objects.filter(o=>islandOf(o)===g.viewIsland));faces.front.add(remoteHousing.root);}
    terrainCache.set(g.viewIsland,{terrain:remoteTerrain,housing:remoteHousing});
   }
   terrainIsland=g.viewIsland;
  }
  for(const t of Object.values(remoteTerrain))t.root.visible=true;
  if(g.viewIsland==='spore')for(const t of Object.values(remoteTerrain))t.setProgress(g.civilization.projects.spore.construction/600);
  if(remoteHousing){const project=g.civilization.projects[g.viewIsland];remoteHousing.root.visible=true;remoteHousing.update(project.construction/600);if(project.construction>0&&!remoteHousing.root.userData.cleared){remoteTerrain.front.clearConstruction(project.plan.rooms);remoteHousing.root.userData.cleared=true;}}
 }
 const interactive=new THREE.Group();faces.front.add(interactive);const backInteractive=new THREE.Group();faces.back.add(backInteractive);const surfaceItems={front:interactive,back:backInteractive};const objectMeshes=new Map();
 const livingTrails=['front','back'].map(side=>{const visual=createLivingTrailVisual(side);faces[side].add(visual.root);return visual;});
 const prop=createPropFactory({mushroomAsset,mushroomVariants,model,crystal,fairytaleKit});
 function syncObjects(g=getGame()){
  for(const[id,o]of objectMeshes)if(!g.objects.some(x=>x.id===id)){o.userData.spiritTree?.dispose();o.userData.gardenBond?.dispose();disposeStaticBatches(o);o.removeFromParent();objectMeshes.delete(id);}
  for(const o of g.objects){
   if(!objectMeshes.has(o.id)){
    const group=prop(o.type,islandOf(o));group.position.set(o.x,o.type==='spiritTree'||islandOf(o)==='spore'?groundHeight(o.x,o.z,sideOf(o),islandOf(o)):.29,o.z);group.rotation.y=o.rotation;group.userData.target={kind:'object',id:o.id};trackTextures(group);applyTextureQuality(quality);
    if(o.plant&&islandOf(o)==='spore')group.userData.gardenBond=createGardenBondVisual(group);
    objectMeshes.set(o.id,group);
   }
   const objectMesh=objectMeshes.get(o.id);objectMesh.visible=islandOf(o)===g.viewIsland;surfaceItems[sideOf(o)].add(objectMesh);
  }
 }
 const ufoMeshes=new Map(),onboard=new Map(),flightBoard=document.createElement('div');flightBoard.className='ufo-flight-board';flightBoard.setAttribute('aria-label','UFO 航行动态');container.append(flightBoard);let flightBoardText='';
 function syncUfos(g){
  const flights=[];onboard.clear();
  for(const [id,visual] of ufoMeshes)if(!g.space.ships.some(s=>s.id===id)){visual.beam.dispose();visual.dispose();ufoMeshes.delete(id);}
  for(const ship of g.space.ships){
   if(!ufoMeshes.has(ship.id)){const visual=createUfoVisual(ship.tier);visual.beam=createUfoTransferBeam();visual.root.userData.target={kind:'ufo',id:ship.id};ufoMeshes.set(ship.id,visual);}
   const visual=ufoMeshes.get(ship.id),root=visual.root,flight=ufoFlightPresentation(g,ship),food=shipFoodStatus(ship);
   for(const uid of flight.crew)onboard.set(uid,flight);
   surfaceItems[flight.side].add(visual.beam.root);visual.beam.update(flight);visual.beam.root.visible=!!flight.beam&&flight.island===g.viewIsland;
   root.visible=flight.island===g.viewIsland;surfaceItems[flight.side].add(root);
   const seconds=((g.day-1)*1440+g.minute)/g.config.time.gameMinutesPerRealSecond,motion=ufoHoverMotion(ship.id,seconds,flight);
   visual.update(food.ratio,seconds,flight.flying);
   root.position.set(flight.x+motion.x,flight.y+motion.y,flight.z+motion.z);root.scale.setScalar((.85+ship.tier*.18)*flight.scale);
   // Tilt in world travel axes before the saucer's independent local spin.
   root.rotation.set(motion.pitch+flight.pitch,motion.yaw,motion.roll+flight.roll,'ZXY');
   root.userData.flightStage=flight.stage;
   if(flight.route)flights.push(`${flight.stage} · ${Math.round(flight.progress*100)}% · ${flight.route}`);
  }
  const text=flights.map(line=>translateText(line,getLanguage())).join('\n');if(text!==flightBoardText){flightBoard.textContent=text;flightBoard.hidden=!text;flightBoardText=text;}
  container.dataset.ufoBeams=String([...ufoMeshes.values()].filter(v=>v.beam.root.visible).length);
  container.dataset.ufoFlights=String(flights.length);
  container.dataset.ufoCount=String(g.space.ships.filter(s=>s.island===g.viewIsland&&s.side===g.viewSide).length);
 }
 const actors=new Map();
 function syncActors(g=getGame()){
  const residents=[...(g.player.alive?[{id:'player',...g.player}]:[]),...neighbors(g)];
  for(const [id,rig]of actors)if(!residents.some(n=>n.id===id&&n.uid===rig.uid)){
   rig.root.removeFromParent();rig.prayerVisuals.dispose();rig.blinkVisual.dispose();rig.livingVisual.dispose();rig.root.traverse(n=>{if(n.isMesh)n.material.dispose();});for(const skeleton of new Set(Object.values(rig.limbs).map(l=>l.mesh.skeleton)))skeleton.dispose();actors.delete(id);
  }
  for(const data of residents)if(!actors.has(data.id)){
   const rig=createCharacter(alienAsset.scene,data);rig.uid=data.uid;rig.blinkVisual=createBlinkVisual(rig.root);rig.livingVisual=createLivingVisual(rig);rig.root.userData.target={kind:data.id==='player'?'player':'npc',id:data.id};surfaceItems[sideOf(data)].add(rig.root);actors.set(data.id,rig);
  }
 }
 syncActors();
 const selected=ring(faces.front,0xc1ffd0,[0,.3,2],.52,.035);selected.rotation.x=-Math.PI/2;
 const ghost=new THREE.Group();faces.front.add(ghost);let buildType=null,buildRotation=0,ghostProp=null;
 const buildGrid=new THREE.GridHelper(22,22,0xc6ffd5,0xaba3b0);buildGrid.position.y=.29;buildGrid.material.transparent=true;buildGrid.material.opacity=.28;buildGrid.visible=false;faces.front.add(buildGrid);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),-.29);let hoverTarget=null;let pointerDown=null;
 function hit(event){const cursor=elementPoint(renderer.domElement,event.clientX,event.clientY);pointer.set(cursor.x/renderer.domElement.clientWidth*2-1,-cursor.y/renderer.domElement.clientHeight*2+1);raycaster.setFromCamera(pointer,camera);
  const side=getGame().viewSide,face=faces[side];face.updateWorldMatrix(true,false);
  const plane=ground.clone().applyMatrix4(face.matrixWorld),point=new THREE.Vector3();
  if(getGame().viewIsland==='spore'){
   const surface=remoteTerrain&&raycaster.intersectObject(remoteTerrain[side].root,true)[0];
   if(!surface)return {target:null,point:new THREE.Vector3(1000,0,1000)};point.copy(surface.point);
  }else if(!raycaster.ray.intersectPlane(plane,point))return {target:null,point:new THREE.Vector3(1000,0,1000)};
  face.worldToLocal(point);const hits=raycaster.intersectObjects(surfaceItems[side].children.filter(o=>o.visible),true);let target=null;
  if(hits[0]){let o=hits[0].object;while(o&&!o.userData.target)o=o.parent;target=o?.userData.target;}return{target,point};
 }
 renderer.domElement.addEventListener('pointerleave',()=>{hoverTarget=null;onHover(null,0,0);});
 renderer.domElement.addEventListener('pointermove',e=>{if(container.dataset.flipping==='true')return;const h=hit(e);if(buildType){ghost.position.set(Math.round(h.point.x),getGame().viewIsland==='spore'?groundHeight(Math.round(h.point.x),Math.round(h.point.z),getGame().viewSide,'spore')+.01:.3,Math.round(h.point.z));ghost.visible=Math.abs(h.point.x)<12&&Math.abs(h.point.z)<8;const valid=canPlace(getGame(),ghost.position.x,ghost.position.z);ghost.traverse(n=>{if(n.isMesh)n.material.color.set(valid?0xafffca:0xff7e94);});}else{hoverTarget=h.target;renderer.domElement.style.cursor=h.target?'pointer':'default';onHover(h.target,e.clientX,e.clientY);}});
 renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};});
 renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>6)return;const h=hit(e);if(buildType){onPlace(buildType,Math.round(h.point.x),Math.round(h.point.z),buildRotation);return;}if(h.target)onClick(h.target,e.clientX,e.clientY);else if(Math.abs(h.point.x)<=11&&Math.abs(h.point.z)<=7)onClick({kind:'ground',point:{x:h.point.x,z:h.point.z}},e.clientX,e.clientY);});
 renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);composer.setSize(w,h);const v=14*(sceneOnly||getGame().viewIsland==='spore'?Math.max(1,1.3*h/w):1);camera.left=-v*w/h;camera.right=v*w/h;camera.top=v;camera.bottom=-v;camera.updateProjectionMatrix();}
 function applyQuality(profile){
  quality={...profile};vegetationFrame=0;renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,quality.maxPixelRatio));renderer.shadowMap.enabled=quality.shadows;renderer.shadowMap.type=quality.shadows?THREE.PCFSoftShadowMap:THREE.BasicShadowMap;sun.castShadow=quality.shadows;sun.shadow.mapSize.set(quality.shadowMapSize,quality.shadowMapSize);weatherEffects.setQuality(quality);atmosphere.setQuality(quality);applyTextureQuality(quality);container.dataset.quality=quality.level;container.dataset.modelLod=quality.modelLod;container.dataset.treeAnimation=quality.treeAnimation;resize();updateModelLod();
 }
 new ResizeObserver(resize).observe(container);resize();syncObjects();applyQuality(quality);
 const islandPreviews=createIslandPreviews(renderer,scene,[selected,ghost,buildGrid]);
 let previousSimTime=null,previousFrame=performance.now(),previewPreparation=null;island.rotation.x=getGame().viewSide==='back'?Math.PI:0;
 return {
   islandPreview(id){return islandPreviews.get(id);},
   prepareIslandPreviews(){
    if(previewPreparation)return previewPreparation;
    previewPreparation=(async()=>{
     for(const id of Object.keys(islandCatalog(getGame()))){
      if(!discovered(getGame(),id)||islandPreviews.fresh(id,performance.now()))continue;
      await new Promise(requestAnimationFrame);
      const g=getGame(),preview={...g,viewIsland:id,viewSide:'front'},rotation=island.rotation.x,simTime=previousSimTime,frameTime=previousFrame;
      let capture;
      try{this.render(preview,undefined,true);capture=islandPreviews.update(preview,performance.now());}
      finally{this.render(g,undefined,true);island.rotation.x=rotation;scene.updateMatrixWorld(true);container.dataset.flipping=String(Math.abs(rotation-(g.viewSide==='back'?Math.PI:0))>.01);previousSimTime=simTime;previousFrame=frameTime;}
      await capture;
     }
    })().finally(()=>{previewPreparation=null;});
    return previewPreparation;
   },
   setSceneOnly(value){sceneOnly=value;controls.enabled=!value;renderer.domElement.style.pointerEvents=value?'none':'';hoverTarget=null;pointerDown=null;resize();},
   render(visualState,visualSeconds,offscreen=false){const g=visualState??getGame(),weather=weatherProvider(g),now=performance.now(),frameDt=Math.min((now-previousFrame)/1000,.1);previousFrame=now;
   if(!offscreen&&container.dataset.island!==g.viewIsland)resize();syncTerrain(g);container.dataset.island=g.viewIsland;
   const fairy=g.viewIsland==='spore';
   planet.visible=orbit.visible=!fairy;
   for(const f of floating)if(f.object.parent===scene)f.object.visible=!fairy;
   const flipTarget=g.viewSide==='back'?Math.PI:0;island.rotation.x=offscreen?flipTarget:THREE.MathUtils.damp(island.rotation.x,flipTarget,5,frameDt);
   for(const entry of themedSurroundings){updateSurroundings(entry,island.rotation.x,fairy);for(const {mesh,source}of entry.fragments){mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);}}
   faces[g.viewSide].add(ghost,buildGrid);faces[sideOf(g.player)].add(selected);
   container.dataset.side=g.viewSide;container.dataset.flipping=String(Math.abs(island.rotation.x-flipTarget)>.01);syncObjects(g);syncActors(g);syncUfos(g);for(const o of g.objects){if(!CROPS[o.type])continue;const group=objectMeshes.get(o.id),p=o.plant;if(o.type==='mushroom')group.userData.setMushroomVariant(mushroomVariant(p));for(const crop of group.userData.cropVisual){crop.scale.setScalar(cropVisualScale(p.growth,p.giant));crop.rotation.z=p.health<=0?.45:p.water<25?.15:0;crop.traverse(n=>{if(n.isMesh){n.userData.plantColor&&n.material.color.copy(n.userData.plantColor).lerp(new THREE.Color(0x80664c),1-p.health/100);}});if(crop.userData.fruit)crop.userData.fruit.visible=p.growth>=.7&&p.health>0;}}const time=visualSeconds??((g.day-1)*1440+g.minute)/(g.config?.time?.gameMinutesPerRealSecond??2),delta=previousSimTime===null?0:Math.max(0,time-previousSimTime),animateVegetation=quality.treeAnimation==='full'||quality.treeAnimation==='reduced'&&vegetationFrame++%2===0;previousSimTime=time;

   for(const trail of livingTrails)trail.update(g,time,delta);
   for(const[id,rig]of actors){
    const person=id==='player'?g.player:g.npcs[id],action=(id==='player'?g.queue:person.queue)[0];
    let partner=g.queue[0]?.targetId===id?g.player:action&&g.npcs[action.targetId]?g.npcs[action.targetId]:Object.values(g.npcs).find(n=>n.queue[0]?.targetId===id);
    if(action?.phase==='acting'&&['relax','lounge'].includes(action.type)){const peers=[{id:'player',person:g.player,queue:g.queue},...Object.entries(g.npcs).map(([id,person])=>({id,person,queue:person.queue}))].filter(a=>a.id!==id&&a.queue[0]?.phase==='acting'&&['relax','lounge'].includes(a.queue[0].type)&&a.queue[0].targetId===action.targetId);if(peers.length)partner=peers[Math.floor(time/4)%peers.length].person;}
     rig.root.visible=islandOf(person)===g.viewIsland&&!onboard.has(person.uid);surfaceItems[sideOf(person)].add(rig.root);
     const visualAction=action?.transit?{type:'travel',phase:'acting',elapsed:action.transit.elapsed}:action?.type==='study'?{...action,type:({music:'dance',botany:'garden',science:'research',cooking:'cook',social:'chat'})[action.studySkill]}:action&&['spaceResearch','buildUfo1','buildUfo2','buildUfo3','prepareRations','voyage','starVoyage'].includes(action.type)?{...action,type:['voyage','starVoyage'].includes(action.type)?'travel':action.type==='prepareRations'?'cook':'research'}:action;
     rig.blinkVisual.reset();rig.root.scale.setScalar(1);
     updateCharacter(rig,{person,action:visualAction,object:action?g.objects.find(o=>o.id===(action.transit?.sourceId||action.targetId)):undefined,partner:partner&&sameSide(partner,person)?partner:null,time,delta,config:g.config,living:livingPose(g,person,partner&&sameSide(partner,person)?partner:null)});
     surfaceItems[sideOf(person)].add(rig.livingVisual.root);rig.livingVisual.root.visible=rig.root.visible&&!action?.blinkTransit;rig.livingVisual.update(g,person,action,time,delta);
     if(action?.blinkTransit){
      const progress=Math.min(1,action.blinkTransit.elapsed/BLINK_SECONDS),position=progress<.5?person:action.path[0],side=sideOf(position),y=groundHeight(position.x,position.z,side,islandOf(position));
      surfaceItems[side].add(rig.root,rig.blinkVisual.root);rig.root.visible=islandOf(position)===g.viewIsland;rig.root.position.set(position.x,y,position.z);rig.blinkVisual.update(progress);rig.blinkVisual.root.position.set(position.x,y,position.z);rig.blinkVisual.root.visible=rig.root.visible;
     }
     if(onboard.has(person.uid)){const transfer=ufoPassengerPresentation(onboard.get(person.uid),person);rig.root.visible=transfer.visible&&transfer.island===g.viewIsland;if(transfer.visible){surfaceItems[transfer.side].add(rig.root);rig.root.position.set(transfer.x,transfer.y,transfer.z);rig.root.scale.setScalar(transfer.scale);}}
   }
    container.dataset.blinking=String([...actors.values()].filter(r=>r.blinkVisual.root.visible).length);
    selected.visible=!g.queue[0]?.blinkTransit&&g.player.alive&&!onboard.has(g.player.uid)&&islandOf(g.player)===g.viewIsland&&sideOf(g.player)===g.viewSide;const main=actors.get('player')?.root.position||new THREE.Vector3(g.player.x,0,g.player.z);selected.position.set(main.x,groundHeight(main.x,main.z,sideOf(g.player),islandOf(g.player))+.025,main.z);
   for(const [id,o]of objectMeshes){if(o.userData.rift){o.userData.rift.material.uniforms.time.value=time;o.userData.riftFrame.position.y=1.5+Math.sin(time*1.4)*.06;}if(o.userData.orb)o.userData.orb.position.y=1.4+Math.sin(time*1.4)*.09;if(o.userData.egg){o.userData.egg.visible=g.incubations.some(b=>b.podId===id);o.userData.egg.position.y=.8+Math.sin(time*1.5)*.06;}if(o.userData.portal){o.userData.portal.material.uniforms.time.value=time;o.userData.glyphs.rotation.z=time*.09;}if(o.userData.cropVisual)for(const [i,crop]of o.userData.cropVisual.entries())crop.rotation.z+=Math.sin(time*.85+i+o.position.x)*.025;}
   for(const item of g.objects){const group=objectMeshes.get(item.id);
    if(group.userData.materialBars)group.userData.materialBars.forEach((m,i)=>{m.visible=(g.space.materials[islandOf(item)]??0)>i*10;});
    if(group.userData.extractionRotor&&[g.queue[0],...Object.values(g.npcs).map(p=>p.queue[0])].some(q=>q?.type==='extractMaterials'&&q.targetId===item.id&&q.phase==='acting'))group.userData.extractionRotor.rotation.y=time*2;
   }
   atmosphere.update(time,weather,(1+Math.cos(island.rotation.x))/2,g.viewIsland==='spore');weatherEffects.update(time,weather);
   const daylight=THREE.MathUtils.smoothstep(Math.sin((g.minute/1440-.25)*Math.PI*2),-.18,.4),bioStrength=.5+(1-daylight)*.95;
   if(g.viewIsland!=='home'&&remoteTerrain&&animateVegetation)for(const t of Object.values(remoteTerrain))t.update(time,weather.wind,1-daylight);
   const blessings=[g.queue[0],...Object.values(g.npcs).map(n=>n.queue[0])].filter(a=>a?.type==='pray'&&a.phase==='celebrating');
   for(const item of g.objects)if(item.type==='spiritTree'){
    const tree=objectMeshes.get(item.id).userData.spiritTree;tree.update((quality.treeAnimation==='off'?0:time)+item.x*.7+item.z,sideOf(item),daylight,animateVegetation?weather.wind:0,livingSite(g,item).vitality/100);
    tree.updateBlessing(blessings.find(a=>a.targetId===item.id),camera);
   }
   storyMoon.update(island.rotation.x,fairy,time,camera);
   for(const {facets,phase}of [...crystalLights,...[...objectMeshes.values()].filter(o=>o.userData.crystalLight).map(o=>o.userData.crystalLight)])for(const m of facets){m.bio.time.value=time+phase;m.bio.strength.value=bioStrength*.7;}
   for(const item of g.objects){const group=objectMeshes.get(item.id);if(group.userData.wonderVisual){const action=[g.queue[0],...Object.values(g.npcs).map(n=>n.queue[0])].find(a=>a?.targetId===item.id&&a.phase==='acting'&&!a.hostId);group.userData.wonderVisual.update(item.wonder,{seconds:time,minutes:(g.day-1)*1440+g.minute},action);}}
   for(const [i,plant]of swaying.entries())plant.traverse(n=>{if(n.isMesh&&n.material instanceof BiolumeMaterial){n.material.bio.time.value=time+i*.67+(n.material.name==='Pearl stem'?.7:0);n.material.bio.strength.value=bioStrength;}});
   for(const item of g.objects){if(!CROPS[item.type])continue;const group=objectMeshes.get(item.id),health=item.plant.health/100,growth=item.plant.growth;
    group.userData.gardenBond?.update(g,item,time);
    group.userData.cropLight.update(time+item.x,health*(.2+growth*.5)*(1-daylight*.65));
    for(const crop of group.userData.cropVisual)crop.traverse(n=>{if(n.isMesh&&n.material instanceof BiolumeMaterial){n.material.bio.time.value=time+item.x;n.material.bio.strength.value=bioStrength*health*(.3+growth*.7);}else if(n.isMesh&&n.material.name==='Bioluminescence')n.material.emissiveIntensity=.22*health;});
   }
   if(animateVegetation)swaying.forEach((o,i)=>{o.rotation.z=Math.sin(time*.42+i*1.7)*.018*(1+weather.wind);o.rotation.x=Math.cos(time*.31+i)*.012*(1+weather.wind);});
   floating.forEach(({object,y,phase})=>{object.position.y=y+Math.sin(time*.27+phase)*.18;object.rotation.y=Math.sin(time*.1+phase)*.08;});
   ripples.forEach((o,i)=>{const phase=(time*.12+i/3)%1,r=.3+phase*1.7;o.scale.set(r,r*.65,1);o.material.opacity=Math.sin(phase*Math.PI)*.5;});
   const dark=(1-Math.cos(island.rotation.x))/2;
   createCrystalMesh.updateLight(daylight,dark);
   sun.intensity=(.65+daylight*1.95)*(1-dark*.75)*(1-weather.weights.rain*.22-weather.weights.mist*.12);
   ambient.intensity=(.85+daylight*.45)*(1-dark*.32);
   rim.intensity=(1.2+(1-daylight)*.25)*(1+dark*.25);
   sun.color.set(0xffe5d0).lerp(new THREE.Color(0x8895df),dark);ambient.color.set(0xe2eaff).lerp(new THREE.Color(0x8194c8),dark);
   ambient.groundColor.set(0x70526e);rim.color.set(0xdacbff).lerp(new THREE.Color(0x60bfc6),dark);
   scene.fog.density=.006+(weather.weights.mist*.003+weather.weights.rain*.001)*quality.fogDensity;
   scene.background.set(0x10152e).lerp(new THREE.Color(0x080b1b),dark);scene.fog.color.set(0x171c39).lerp(new THREE.Color(0x15182e),dark);scene.fog.density+=dark*.007*quality.fogDensity;
   if(g.viewIsland==='spore'){
    sun.intensity=THREE.MathUtils.lerp(.55+daylight*2.3,.24,dark);ambient.intensity=THREE.MathUtils.lerp(.40+daylight*.40,.20,dark);rim.intensity=THREE.MathUtils.lerp(.85,.65,dark);
    sun.color.set(0xffeed0).lerp(new THREE.Color(0x8b9bb2),dark);ambient.color.set(0xf0f6e7).lerp(new THREE.Color(0x74818e),dark);ambient.groundColor.set(0x7a8973).lerp(new THREE.Color(0x171d19),dark);rim.color.set(0xd1e6df).lerp(new THREE.Color(0x92acb5),dark);
    scene.background.set(0xa7c8c6).lerp(new THREE.Color(0x394844),dark);scene.fog.color.copy(scene.background);scene.fog.density=.003+dark*.003*quality.fogDensity;
   }
   if(offscreen)scene.updateMatrixWorld(true);
   else {controls.update();updateModelLod();composer.render();}
  },
  setQuality(profile){applyQuality(profile);return {...quality};},
  getQuality(){return {...quality};},
  // Transparent build ghosts retain per-piece sorting rather than opaque batches.
  setBuild(type){buildType=type;buildGrid.visible=!!type;ghost.visible=false;if(ghostProp){ghost.remove(ghostProp);ghostProp.userData.spiritTree?.dispose();ghostProp.traverse(n=>{if(n.isMesh)n.material.dispose();});}if(type){ghostProp=prop(type,undefined,false);ghostProp.traverse(n=>{if(n.isLight||n.isPoints)n.visible=false;if(n.isMesh)n.material=new THREE.MeshBasicMaterial({color:0xafffca,transparent:true,opacity:.45,side:n.material.side});});ghost.add(ghostProp);const lighting=ITEMS.find(item=>item.id===type)?.lighting;if(lighting){const coverage=ring(ghostProp,lighting.color,[0,.025,0],lighting.radius,.025);coverage.rotation.x=-Math.PI/2;coverage.material=new THREE.MeshBasicMaterial({color:lighting.color,transparent:true,opacity:.45,depthWrite:false});}}return type;},
  rotateBuild(){buildRotation+=Math.PI/2;ghost.rotation.y=buildRotation;},
  focus(id){const game=getGame(),p=id==='home'?{x:-3,z:-1}:id==='garden'?{x:7,z:3}:id==='lab'?{x:6,z:-3}:id==='player'?game.player:game.npcs[id];if(!p)return;const dx=p.x-controls.target.x,dz=p.z-controls.target.z;controls.target.set(p.x,0,p.z);camera.position.x+=dx;camera.position.z+=dz;},
  focusUfo(id){const g=getGame(),ship=g.space.ships.find(s=>s.id===id);if(!ship)return;const p=ufoDock(g,ship),dx=p.x-controls.target.x,dz=p.z-controls.target.z;controls.target.set(p.x,0,p.z);camera.position.x+=dx;camera.position.z+=dz;},
  resetCamera(){resetView();},
  zoom(delta){camera.zoom=THREE.MathUtils.clamp(camera.zoom+delta,.65,2.5);camera.updateProjectionMatrix();},
  portrait(id){
    const person=id==='player'?getGame().player:getGame().npcs[id],color=person.color,config=getGame().config;
    const rig=createCharacter(alienAsset.scene,{id,color,...person});updateCharacter(rig,{person:{...person,x:0,z:0},time:0,delta:0,config});rig.root.rotation.set(0,0,0);rig.root.position.set(0,0,0);
   const environment=createLivingVisual(rig);environment.update(getGame(),person,null,0,0);
   portraitScene.background.set(id==='player'?0xc3e6c8:0xd4cde5);portraitScene.add(rig.root);
   const scale=appearance(person,config.lifeStages).scale,radiant=isRadiant(person);portraitCamera.position.set(0,(radiant?1.85:1.65)*scale,(radiant?3.8:3.3)*scale);portraitCamera.lookAt(0,(radiant?1.65:1.45)*scale,0);
   portraitComposer.render();const url=portraitRenderer.domElement.toDataURL();
   environment.dispose();rig.root.removeFromParent();portraitRenderer.renderLists.dispose();rig.prayerVisuals.dispose();rig.body.traverse(n=>{if(n.isMesh)n.material.dispose();});for(const skeleton of new Set(Object.values(rig.limbs).map(l=>l.mesh.skeleton)))skeleton.dispose();return url;
  }
 };
}
