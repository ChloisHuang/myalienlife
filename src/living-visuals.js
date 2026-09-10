import * as THREE from 'three';
import {StarToonMaterial} from './npr.js';
import {groundHeight} from './characters.js';
import {islandOf,sideOf,sameSide} from './island.js';
import {livingResident,livingSite,livingPeople,bondTo} from './living-state.js';
import {inForest,lightActive} from './living-world.js';
import {livingAppearance} from './living-adaptation.js';

function dispose(root){
 const geometries=new Set(),materials=new Set();root.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)materials.add(n.material);});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.removeFromParent();
}
function shadowShape(){
 const s=new THREE.Shape();
 s.moveTo(-.16,0);s.lineTo(-.26,.45);s.bezierCurveTo(-.55,.65,-.72,.4,-.85,.7);
 s.bezierCurveTo(-.7,.55,-.42,.95,-.24,.85);s.bezierCurveTo(-.7,1.15,-.56,1.75,-.2,1.82);
 s.lineTo(-.36,2.14);s.lineTo(-.25,2.18);s.lineTo(-.08,1.87);s.lineTo(.1,1.87);s.lineTo(.29,2.2);s.lineTo(.39,2.14);s.lineTo(.23,1.8);
 s.bezierCurveTo(.64,1.6,.62,1.16,.26,.86);s.bezierCurveTo(.55,1,.8,.54,.95,.7);
 s.bezierCurveTo(.76,.34,.55,.59,.25,.44);s.lineTo(.2,0);s.lineTo(.05,.04);s.lineTo(0,.3);s.lineTo(-.04,.04);s.closePath();
 return s;
}

// All transforms and animation clocks are client-local. Nothing here enters a save or a patch.
export function createLivingVisual(rig){
 const root=new THREE.Group();root.name='环境共生';
 const buds=new THREE.Group();buds.name='共生叶芽';rig.joints.LeftAntenna.add(buds);
 const leafGeometry=new THREE.SphereGeometry(.16,10,6),leafMaterial=new StarToonMaterial({color:0x76cf82});
 for(let i=0;i<3;i++){const leaf=new THREE.Mesh(leafGeometry,leafMaterial);leaf.position.set((i-1)*.11,.08+i*.07,0);leaf.scale.set(.65,1.4,.28);leaf.rotation.z=(i-1)*.8;buds.add(leaf);}
 const flower=new THREE.Mesh(new THREE.SphereGeometry(.09,10,6),new StarToonMaterial({color:0xf1b4c6}));flower.position.set(0,.3,0);buds.add(flower);
 const imprint=new THREE.Group();imprint.name='永久环境印记';rig.joints.RightAntenna.add(imprint);
 const imprintGeometry=new THREE.OctahedronGeometry(.065),imprintMaterial=new StarToonMaterial({color:0xe9c981,emissive:0x573b16,emissiveIntensity:.25});
 for(let i=0;i<3;i++){const shard=new THREE.Mesh(imprintGeometry,imprintMaterial);shard.position.set((i-1)*.09,.12+(.08*(1-Math.abs(i-1))),0);shard.scale.y=1.5;imprint.add(shard);}
 const shadow=new THREE.Mesh(new THREE.ShapeGeometry(shadowShape()),new THREE.MeshBasicMaterial({color:0x080c18,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide}));
 shadow.name='自主影子';shadow.rotation.x=-Math.PI/2;root.add(shadow);
 const edge=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shadowShape().getPoints(32).map(p=>new THREE.Vector3(p.x,p.y,.002))),new THREE.LineBasicMaterial({color:0x97b9b0,transparent:true,opacity:.32,depthWrite:false}));shadow.add(edge);
 const aura=new THREE.Mesh(new THREE.RingGeometry(2.7,3,64),new THREE.MeshBasicMaterial({color:0xffe9a6,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));aura.name='曦轮安定范围';aura.rotation.x=-Math.PI/2;root.add(aura);
 const rays=new THREE.Group();aura.add(rays);const rayGeometry=new THREE.PlaneGeometry(.035,.42),rayMaterial=new THREE.MeshBasicMaterial({color:0xffe3a0,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide});
 for(let i=0;i<12;i++){const ray=new THREE.Mesh(rayGeometry,rayMaterial),angle=i*Math.PI/6;ray.position.set(Math.cos(angle)*2.8,Math.sin(angle)*2.8,.02);ray.rotation.z=angle-Math.PI/2;rays.add(ray);}
 let lastIsland=null,lastSide=null,initialized=false;
 return {root,buds,shadow,aura,imprint,
  update(g,p,action,time,delta){
   const s=livingResident(g,p),forest=inForest(p),height=groundHeight(p.x,p.z,sideOf(p),islandOf(p))+.035;
   const appearance=livingAppearance(s);
   buds.visible=appearance.buds>0;buds.scale.setScalar(.6+Math.min(1,s.garden/40)*.6);flower.visible=appearance.buds===2;
   imprint.visible=['roots','shade'].includes(s.imprint);imprintMaterial.color.set(s.imprint==='shade'?0x9697cd:0xe9c981);imprint.rotation.y=time*.2;
   leafMaterial.color.set(s.charge>0?0x76cf82:0x71957a);buds.rotation.z=Math.sin(time*1.2)*.09;
   shadow.visible=forest&&(s.shadow>0||s.fear>0)||appearance.shadow;shadow.material.opacity=forest?.6:s.imprint==='shade'?.24:.10;edge.material.opacity=forest?.38:s.imprint==='shade'?.22:.04;
   const reset=!initialized||lastIsland!==islandOf(p)||lastSide!==sideOf(p)||Math.hypot(shadow.position.x-p.x,shadow.position.z-p.z)>5;
   const lag=forest?Math.min(1,delta*(s.fear>=30?2:5)):1;
   if(reset)shadow.position.set(p.x,height,p.z);else if(delta>0)shadow.position.lerp(new THREE.Vector3(p.x,height,p.z),lag);
   const reach=forest&&s.shadow>=40?Math.sin(time*.7)*.3:0;
   shadow.rotation.z=-rig.root.rotation.y+(forest?Math.sin(time*.9)*.12:0);shadow.scale.set(.65,forest?1+reach:.55,1);
   aura.visible=lightActive(g,p)&&(action?.type==='shareLight'&&action.phase==='acting'||forest&&livingPeople(g).some(other=>other.uid!==p.uid&&sameSide(p,other)&&livingResident(g,other).fear>0&&Math.hypot(p.x-other.x,p.z-other.z)<=3));
   aura.position.set(p.x,height+.005,p.z);aura.material.opacity=.12+Math.sin(time*2)*.035;rays.rotation.z=time*.08;
   lastIsland=islandOf(p);lastSide=sideOf(p);initialized=true;
  },
  dispose(){dispose(root);dispose(buds);dispose(imprint);}
 };
}

export function createGardenBondVisual(parent){
 const geometry=new THREE.SphereGeometry(.13,8,5),material=new StarToonMaterial({color:0xe7a5bb});
 const flowers=new THREE.InstancedMesh(geometry,material,24);flowers.name='共生花圃';flowers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);flowers.frustumCulled=false;parent.add(flowers);
 const transform=new THREE.Object3D();
 return {flowers,
  update(g,o,time){
   const site=livingSite(g,o),keeper=livingPeople(g).find(p=>p.uid===site.keeper),near=keeper&&sameSide(o,keeper)&&Math.hypot(o.x-keeper.x,o.z-keeper.z)<4;
   flowers.visible=site.keeper!==null&&o.plant.health>0;
   if(!flowers.visible)return;
   for(let i=0;i<24;i++){
    const group=Math.floor(i/4),petal=i%4,angle=group*Math.PI/3,open=near?1:.38;
    transform.position.set(Math.cos(angle)*.9+Math.cos(petal*Math.PI/2)*.1*open,.18+Math.sin(time+group)*.015,Math.sin(angle)*.9+Math.sin(petal*Math.PI/2)*.1*open);
    transform.scale.set(.8*open,.4,.8*open);transform.rotation.set(0,near?Math.atan2(keeper.x-o.x,keeper.z-o.z):angle,0);transform.updateMatrix();flowers.setMatrixAt(i,transform.matrix);
   }
   flowers.instanceMatrix.needsUpdate=true;
  },dispose(){flowers.removeFromParent();geometry.dispose();material.dispose();}
 };
}

export function livingPose(g,p,partner){
 const s=livingResident(g,p),bond=partner?bondTo(g,p,partner):null;
 return {fear:s.fear,tension:bond?.resentment??0};
}
