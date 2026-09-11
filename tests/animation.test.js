import {defaultGenome} from '../src/genetics.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Box3} from 'three';
import {groundHeight} from '../src/characters.js';

const bytes=await readFile(new URL('../public/assets/alien.glb',import.meta.url));
const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('animated skin bounds contain every posed vertex without reskinning all vertices each frame',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');
 const {createGame}=await import('../src/simulation.js');
 const person=createGame().player,rig=createCharacter(asset.scene,person),skin=rig.limbs.LeftLeg.mesh;
 updateCharacter(rig,{person,time:0,delta:0});
 let reads=0;const getVertex=skin.getVertexPosition;
 skin.getVertexPosition=function(...args){reads++;return getVertex.apply(this,args);};
 updateCharacter(rig,{person,time:1,delta:1/60});
 assert.equal(reads,0,'animation bounds must scale with bones, not mesh vertices');
 const vertex=new Vector3();
 for(const age of [0,8,28,68])for(const type of ['sleep','relax','wash','dance','pray','garden']){
  person.age=age;person.genome={...person.genome,jaw:age===8?.8:1.2};
  updateCharacter(rig,{person,action:{id:1,type,phase:'acting',elapsed:3,seat:1},object:{x:3,z:4,rotation:Math.PI/2},time:3,delta:1});
  for(let i=0;i<skin.geometry.attributes.position.count;i++){
   getVertex.call(skin,i,vertex);
   assert.ok(vertex.distanceTo(skin.boundingSphere.center)<=skin.boundingSphere.radius+1e-5,`${age} ${type}: vertex ${i} outside bounds`);
  }
 }
});
test('prayer kneels on both knees, joins hands and keeps the pose through blessing on either face',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');const {createGame}=await import('../src/simulation.js');
 for(const side of ['front','back'])for(const age of [8,28,68]){
  const person={...createGame().player,age,x:0,z:5.6,side};const rig=createCharacter(asset.scene,person);
  const object={type:'spiritTree',x:0,z:4,side,rotation:Math.PI/2};
  updateCharacter(rig,{person,time:0,delta:0});const standing=rig.joints.Head.getWorldPosition(new Vector3()).y-groundHeight(person.x,person.z,side);
  const action={id:1,type:'pray',phase:'acting',elapsed:3};updateCharacter(rig,{person,object,action,time:3,delta:1});
  const floor=groundHeight(rig.root.position.x,rig.root.position.z,side);
  assert.ok(rig.joints.Head.getWorldPosition(new Vector3()).y-floor<standing-.25);
  for(const name of ['LeftLegBend','RightLegBend']){const y=rig.joints[name].getWorldPosition(new Vector3()).y;assert.ok(y>=floor-.06&&y<floor+.2,`${age} ${side} knee at ${y}`);}
  assert.ok(rig.joints.LeftTendrilTip.getWorldPosition(new Vector3()).distanceTo(rig.joints.RightTendrilTip.getWorldPosition(new Vector3()))<.16);
  const skin=skinnedVertices(rig.limbs.LeftLeg.mesh);assert.ok(skin.every(Number.isFinite));
  updateCharacter(rig,{person,object,action,time:3,delta:0});assert.deepEqual(skinnedVertices(rig.limbs.LeftLeg.mesh),skin);
  action.phase='celebrating';action.elapsed=1;action.blessing={side,skill:side==='front'?'science':null,nether:side==='back',mutation:null,transformed:false};
  updateCharacter(rig,{person,object,action,time:4,delta:1});
  assert.ok(rig.joints.Head.getWorldPosition(new Vector3()).y-floor<standing-.25);
 }
});

test('nether eye and multiple acquired mutations update a paused character without affecting another resident',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');const {createGame}=await import('../src/simulation.js');
 const person=createGame().player,rig=createCharacter(asset.scene,person),other=createCharacter(asset.scene,person);
 updateCharacter(rig,{person,time:0,delta:0});updateCharacter(other,{person,time:0,delta:0});
 person.prayer={nether:10,mutations:['crown','spines','freckles','eyes']};
 updateCharacter(rig,{person,time:0,delta:0});
 assert.equal(rig.prayerVisuals.netherEye.value,1);assert.equal(other.prayerVisuals.netherEye.value,0);
 assert.equal(rig.prayerVisuals.crown.visible,true);assert.equal(rig.prayerVisuals.spines.visible,true);
 const bumps=rig.prayerVisuals.spines.children;assert.equal(bumps.length,3);
 for(const [i,bump] of bumps.entries()){assert.equal(bump.geometry.type,'SphereGeometry');assert.ok(bump.scale.z<=.6);assert.equal(bump.position.x,0);assert.ok(bump.material.emissiveIntensity>=1.5&&bump.material.emissiveIntensity<=2.5);if(i)assert.ok(bumps[i-1].position.y-bump.position.y>bump.geometry.parameters.radius*3);}
 assert.equal(rig.prayerVisuals.skinUniforms.freckles.value,1);
 assert.notEqual(rig.body.getObjectByName('LeftEye').material.color.getHex(),other.body.getObjectByName('LeftEye').material.color.getHex());
});
test('nether skin stays opaque and its eye awakening is isolated and reversible',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');const {createGame}=await import('../src/simulation.js');
 const person=createGame().player,rig=createCharacter(asset.scene,person),other=createCharacter(asset.scene,person);
 person.prayer.nether=10;updateCharacter(rig,{person,time:0,delta:0});
 rig.body.traverse(n=>{if(n.isMesh&&n.material.name==='Alien skin'){assert.equal(n.material.transparent,false);assert.equal(n.material.opacity,1);assert.equal(n.material.depthWrite,true);}});
 assert.equal(rig.prayerVisuals.netherEye.value,1);assert.equal(other.prayerVisuals.netherEye.value,0);
 assert.equal(other.limbs.LeftLeg.mesh.material.opacity,1);
 person.prayer.radiance=10;updateCharacter(rig,{person,time:0,delta:0});assert.equal(rig.limbs.LeftLeg.mesh.material.opacity,1);
 person.prayer.nether=0;updateCharacter(rig,{person,time:0,delta:0});assert.equal(rig.limbs.LeftLeg.mesh.material.opacity,1);assert.equal(rig.limbs.LeftLeg.mesh.material.transparent,false);
 assert.equal(rig.prayerVisuals.netherEye.value,0);
});
test('dawn halo appears at awakening and coexists with nether without changing other residents',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');const {createGame}=await import('../src/simulation.js');
 const person=createGame().player,rig=createCharacter(asset.scene,person),other=createCharacter(asset.scene,person);
 person.prayer.radiance=9;updateCharacter(rig,{person,time:0,delta:0});assert.equal(rig.prayerVisuals.dawnHalo.visible,false);
 person.prayer.radiance=10;person.prayer.nether=10;updateCharacter(rig,{person,time:0,delta:0});
 assert.equal(rig.prayerVisuals.dawnHalo.visible,true);assert.equal(rig.prayerVisuals.netherEye.value,1);
 assert.equal(rig.prayerVisuals.dawnHalo.parent,rig.joints.Head);assert.equal(other.prayerVisuals.dawnHalo.visible,false);
 assert.ok(rig.prayerVisuals.dawnHalo.position.y>.65);
 const ring=rig.prayerVisuals.dawnHalo.getObjectByName('dawn-halo-ring');assert.ok(ring);assert.equal(ring.rotation.x,Math.PI/2);
 person.prayer.radiance=0;updateCharacter(rig,{person,time:0,delta:0});assert.equal(rig.prayerVisuals.dawnHalo.visible,false);
 rig.prayerVisuals.dispose();other.prayerVisuals.dispose();
});

test('the shipped alien has two skinned legs, colored skin and original antenna bulbs',()=>{
 for(const name of ['Core','Head','BodySkin','LeftTendrilTip','RightTendrilTip','LeftLegTip','RightLegTip'])assert.ok(asset.scene.getObjectByName(name),name);
 const skins=[];asset.scene.traverse(n=>{if(n.isSkinnedMesh)skins.push(n);assert.ok(!n.name.includes('Fin'));});assert.equal(skins.length,1);
 const mesh=skins[0];assert.equal(mesh.material.name,'Alien skin');assert.equal(mesh.skeleton.bones.length,39);assert.ok(mesh.geometry.attributes.skinWeight);
 const weights=mesh.geometry.attributes.skinWeight;
 for(let i=0;i<weights.count;i++){let sum=0;for(let j=0;j<4;j++){const w=weights.getComponent(i,j);assert.ok(w>=0);sum+=w;}assert.ok(Math.abs(sum-1)<1e-6,'bone bounds require normalized nonnegative skin weights');}
 assert.equal(mesh.skeleton.bones.filter(b=>b.name.endsWith('LegBone0')).length,2);
 for(const side of ['Left','Right']){const bulb=asset.scene.getObjectByName(side+'AntennaLight');assert.ok(Math.abs(new Box3().setFromObject(bulb).getSize(new Vector3()).x-.13)<.002);}
 for(const side of ['Left','Right'])for(const part of ['Elbow','Knee','Boot','Palm','UpperSleeve','LowerLeg'])assert.equal(asset.scene.getObjectByName(side+part),undefined);
});
test('the head, torso and appendages form one connected surface',()=>{
 const geometry=asset.scene.getObjectByName('BodySkin').geometry,parent=Array.from({length:geometry.attributes.position.count},(_,i)=>i);
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const indices=geometry.index.array;for(let i=0;i<indices.length;i+=3){parent[find(indices[i+1])]=find(indices[i]);parent[find(indices[i+2])]=find(indices[i]);}
 assert.equal(new Set(parent.map((_,i)=>find(i))).size,1);
});
function skinnedVertices(mesh){return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.applyBoneTransform(i,new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i)).toArray()).flat();}
test('head parameters change real head geometry and its attached eyes',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');const person={id:'player',color:'#91dab9',genome:defaultGenome(),x:0,z:5,age:28,gender:'male'};
 const rig=createCharacter(asset.scene,person);updateCharacter(rig,{person,time:0,delta:0});const eye=rig.body.getObjectByName('RightEye'),before=eye.getWorldPosition(new Vector3()),size=new Box3().setFromObject(rig.body).getSize(new Vector3());
 person.genome={...person.genome,headWidth:.8,headHeight:1.2,headDepth:1.1,jaw:1.2};updateCharacter(rig,{person,time:0,delta:0});
 assert.ok(new Box3().setFromObject(rig.body).getSize(new Vector3()).y>size.y);assert.ok(Math.abs(eye.getWorldPosition(new Vector3()).x)<Math.abs(before.x));assert.ok(rig.limbs.LeftLeg.mesh.morphTargetInfluences[0]>.99);
});
test('walking bends real weighted skin and freezes with the simulation',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');
 const actor=createCharacter(asset.scene,{id:'player',color:'#91dab9',gender:'male',age:28,x:0,z:0});
 const person={genome:defaultGenome(),x:0,z:0,gender:'male',age:28};
 updateCharacter(actor,{person,action:{phase:'walking',type:'walk',elapsed:0},time:0,delta:0});
 person.z=.2;updateCharacter(actor,{person,action:{phase:'walking',type:'walk',elapsed:0},time:.1,delta:.1});
 const before=skinnedVertices(actor.limbs.LeftLeg.mesh);
 person.z=.4;updateCharacter(actor,{person,action:{phase:'walking',type:'walk',elapsed:0},time:.3,delta:.2});
 const after=skinnedVertices(actor.limbs.LeftLeg.mesh);assert.notDeepEqual(after,before);assert.ok(after.every(Number.isFinite));
 updateCharacter(actor,{person,action:{phase:'walking',type:'walk',elapsed:0},time:.3,delta:0});assert.deepEqual(skinnedVertices(actor.limbs.LeftLeg.mesh),after);
});
test('walking plants one foot while the other swings, with independent character skeletons',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');
 const person={id:'player',color:'#91dab9',genome:defaultGenome(),x:0,z:5,gender:'male',age:28};
 const actor=createCharacter(asset.scene,person),other=createCharacter(asset.scene,person);updateCharacter(other,{person,time:0,delta:0});const unchanged=skinnedVertices(other.limbs.LeftLeg.mesh);
 const heights={Left:[],Right:[]};let lastFoot=null,lastPhase=0;
 for(let i=0;i<73;i++){
  person.z=5+i*.01;updateCharacter(actor,{person,action:{phase:'walking',type:'walk'},time:i/60,delta:1/60});
  const phase=(actor.stride/(Math.PI*2))%1;
  for(const side of ['Left','Right'])heights[side].push(actor.joints[side+'LegTip'].getWorldPosition(new Vector3()).y);
  const foot=actor.joints.LeftLegTip.getWorldPosition(new Vector3());if(phase>.15&&phase<.6&&lastPhase<phase)assert.ok(Math.abs(foot.z-lastFoot.z)<.005,'planted foot slides');lastFoot=foot;lastPhase=phase;
  assert.ok(Math.min(heights.Left.at(-1),heights.Right.at(-1))<.03,'both feet airborne');
 }
 for(const side of ['Left','Right'])assert.ok(Math.max(...heights[side])-Math.min(...heights[side])>.09,'missing swing lift');
 assert.deepEqual(skinnedVertices(other.limbs.LeftLeg.mesh),unchanged);assert.notEqual(actor.limbs.LeftLeg.mesh.skeleton,other.limbs.LeftLeg.mesh.skeleton);
});
test('sleeping reclines, relaxing settles the mantle, and washing enters the cabin',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');
 for(const type of ['sleep','relax','wash']){
  const actor=createCharacter(asset.scene,{id:'player',color:'#91dab9',gender:'male',age:28,x:0,z:0});
  const object={x:3,z:2,rotation:Math.PI/2,type:{sleep:'pod',relax:'sofa',wash:'shower'}[type]};
  updateCharacter(actor,{person:{genome:defaultGenome(),x:4,z:3,gender:'male',age:28},action:{type,phase:'acting',elapsed:3,seat:1},object,time:3,delta:1});
  actor.root.updateMatrixWorld(true);
  if(type==='sleep'){assert.ok(Math.abs(actor.root.rotation.x)>1);assert.ok(Math.abs(actor.root.position.z-object.z)<.4);for(const side of ['Left','Right']){assert.ok(actor.joints[side+'TendrilTip'].position.y<-.4);assert.ok(Math.abs(actor.joints[side+'TendrilBend'].position.x)<.35);}}
  if(type==='relax'){assert.ok(actor.joints.TorsoBone.scale.y<actor.rest.get(actor.joints.TorsoBone).scale.y);}
  if(type==='wash'){assert.ok(Math.hypot(actor.root.position.x-3,actor.root.position.z-2)<.1);assert.equal(actor.effects.wash.visible,true);assert.ok(Math.abs(actor.joints.LeftTendrilTip.position.y-actor.joints.RightTendrilTip.position.y)>.4);}
 }
});
test('age changes actual geometry proportions and elder details, gender updates the silhouette',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');
 const make=(age,gender)=>{const a=createCharacter(asset.scene,{id:'player',color:'#91dab9',gender,age,x:0,z:0});updateCharacter(a,{person:{genome:defaultGenome(),x:0,z:0,age,gender},time:0,delta:0});a.root.updateMatrixWorld(true);return a;};
 const child=make(8,'male'),adult=make(28,'male'),elder=make(68,'female');
 assert.ok(new Box3().setFromObject(child.body).getSize(new Vector3()).y<new Box3().setFromObject(adult.body).getSize(new Vector3()).y*.8);
 assert.ok(child.joints.Head.scale.x>adult.joints.Head.scale.x);assert.equal(elder.body.getObjectByName('LeftElderBrow').visible,true);
 assert.notEqual(adult.joints.TorsoBone.scale.x,elder.joints.TorsoBone.scale.x);
});
test('the soft feet rest at outdoor ground height',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');const person={genome:defaultGenome(),x:0,z:5,gender:'male',age:28};
 const a=createCharacter(asset.scene,{id:'player',color:'#91dab9',...person});updateCharacter(a,{person,time:0,delta:0});a.root.updateMatrixWorld(true);
 const floor=new Box3().setFromObject(a.body).min.y;assert.ok(floor>-.10&&floor<.02,`feet at ${floor}`);
});
test('inherited genes change real body and antenna geometry and infants use a cradle',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');const {createGame}=await import('../src/simulation.js');
 const normal=createGame().player,mutant={...normal,genome:{...normal.genome,stature:1.12,antenna:1.12}};
 const make=p=>{const rig=createCharacter(asset.scene,p);updateCharacter(rig,{person:p,time:0,delta:0});rig.root.updateMatrixWorld(true);return rig;};
 const a=make(normal),b=make(mutant);assert.ok(new Box3().setFromObject(b.body).getSize(new Vector3()).y>new Box3().setFromObject(a.body).getSize(new Vector3()).y*1.1);assert.ok(b.joints.LeftAntenna.scale.y>a.joints.LeftAntenna.scale.y);
 const baby=make({...normal,age:0});assert.equal(baby.effects.cradle.visible,true);assert.ok(Math.abs(baby.body.rotation.x)>1);
});
