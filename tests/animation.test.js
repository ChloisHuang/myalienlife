import {defaultGenome} from '../src/genetics.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Box3} from 'three';

const bytes=await readFile(new URL('../public/assets/alien.glb',import.meta.url));
const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('the shipped alien has two skinned legs, colored skin and original antenna bulbs',()=>{
 for(const name of ['Core','Head','BodySkin','LeftTendrilTip','RightTendrilTip','LeftLegTip','RightLegTip'])assert.ok(asset.scene.getObjectByName(name),name);
 const skins=[];asset.scene.traverse(n=>{if(n.isSkinnedMesh)skins.push(n);assert.ok(!n.name.includes('Fin'));});assert.equal(skins.length,1);
 const mesh=skins[0];assert.equal(mesh.material.name,'Alien skin');assert.equal(mesh.skeleton.bones.length,39);assert.ok(mesh.geometry.attributes.skinWeight);
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
