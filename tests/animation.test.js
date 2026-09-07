import {defaultGenome} from '../src/genetics.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Box3} from 'three';

const bytes=await readFile(new URL('../public/assets/alien.glb',import.meta.url));
const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('the shipped Blender asset has independently articulated elbows, knees, hands and feet',()=>{
 for(const name of ['Hips','Spine','Head','LeftUpperArm','RightForearm','LeftThigh','RightShin','LeftHand','RightFoot'])assert.ok(asset.scene.getObjectByName(name),name);
 assert.equal(asset.scene.getObjectByName('LeftShin').parent.name,'LeftThigh');
});
test('walking moves opposing joints, plants feet differently, and freezes with the simulation',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');
 const actor=createCharacter(asset.scene,{id:'player',color:'#91dab9',gender:'male',age:28,x:0,z:0});
 const person={genome:defaultGenome(),x:0,z:0,gender:'male',age:28};
 updateCharacter(actor,{person,action:{phase:'walking',type:'walk',elapsed:0},time:0,delta:0});
 person.z=.2;updateCharacter(actor,{person,action:{phase:'walking',type:'walk',elapsed:0},time:.1,delta:.1});
 assert.ok(actor.joints.LeftThigh.rotation.x*actor.joints.RightThigh.rotation.x<0);
 assert.ok(Math.abs(actor.joints.LeftUpperArm.rotation.x)>.1);
 actor.root.updateMatrixWorld(true);const foot=actor.joints.LeftFoot.getWorldPosition(new Vector3());
 assert.ok(Math.abs(foot.z-person.z)>.02);const before=actor.joints.LeftThigh.rotation.x;
 updateCharacter(actor,{person,action:{phase:'walking',type:'walk',elapsed:0},time:.1,delta:0});assert.equal(actor.joints.LeftThigh.rotation.x,before);
});
test('sleeping lies on the bed, relaxing bends hips and knees, washing stands inside the cabin',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');
 for(const type of ['sleep','relax','wash']){
  const actor=createCharacter(asset.scene,{id:'player',color:'#91dab9',gender:'male',age:28,x:0,z:0});
  const object={x:3,z:2,rotation:Math.PI/2,type:{sleep:'pod',relax:'sofa',wash:'shower'}[type]};
  updateCharacter(actor,{person:{genome:defaultGenome(),x:4,z:3,gender:'male',age:28},action:{type,phase:'acting',elapsed:3},object,time:3,delta:1});
  actor.root.updateMatrixWorld(true);
  if(type==='sleep'){const head=actor.joints.Head.getWorldPosition(new Vector3()),foot=actor.joints.LeftFoot.getWorldPosition(new Vector3());assert.ok(Math.abs(head.y-foot.y)<.5);assert.ok(Math.abs(actor.root.position.z-object.z)<.4);}
  if(type==='relax'){assert.ok(actor.joints.LeftThigh.rotation.x<-1);assert.ok(actor.joints.LeftShin.rotation.x>1);}
  if(type==='wash'){assert.ok(Math.hypot(actor.root.position.x-3,actor.root.position.z-2)<.1);assert.equal(actor.effects.wash.visible,true);}
 }
});
test('age changes actual geometry proportions and elder details, gender updates the silhouette',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');
 const make=(age,gender)=>{const a=createCharacter(asset.scene,{id:'player',color:'#91dab9',gender,age,x:0,z:0});updateCharacter(a,{person:{genome:defaultGenome(),x:0,z:0,age,gender},time:0,delta:0});a.root.updateMatrixWorld(true);return a;};
 const child=make(8,'male'),adult=make(28,'male'),elder=make(68,'female');
 assert.ok(new Box3().setFromObject(child.body).getSize(new Vector3()).y<new Box3().setFromObject(adult.body).getSize(new Vector3()).y*.8);
 assert.ok(child.joints.Head.scale.x>adult.joints.Head.scale.x);assert.equal(elder.body.getObjectByName('LeftElderBrow').visible,true);
 assert.notEqual(adult.body.getObjectByName('Torso').scale.x,elder.body.getObjectByName('Torso').scale.x);
});
test('standing feet contact the actual outdoor ground instead of floating at the indoor floor height',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');const person={genome:defaultGenome(),x:0,z:5,gender:'male',age:28};
 const a=createCharacter(asset.scene,{id:'player',color:'#91dab9',...person});updateCharacter(a,{person,time:0,delta:0});a.root.updateMatrixWorld(true);
 assert.ok(Math.abs(new Box3().setFromObject(a.body.getObjectByName('LeftBoot')).min.y-(-.08))<.025);
});
test('inherited genes change real body and antenna geometry and infants use a cradle',async()=>{
 const {createCharacter,updateCharacter}=await import('../src/character-rig.js');const {createGame}=await import('../src/simulation.js');
 const normal=createGame().player,mutant={...normal,genome:{...normal.genome,stature:1.12,antenna:1.12}};
 const make=p=>{const rig=createCharacter(asset.scene,p);updateCharacter(rig,{person:p,time:0,delta:0});rig.root.updateMatrixWorld(true);return rig;};
 const a=make(normal),b=make(mutant);assert.ok(new Box3().setFromObject(b.body).getSize(new Vector3()).y>new Box3().setFromObject(a.body).getSize(new Vector3()).y*1.1);assert.ok(b.joints.LeftAntenna.scale.y>a.joints.LeftAntenna.scale.y);
 const baby=make({...normal,age:0});assert.equal(baby.effects.cradle.visible,true);assert.ok(Math.abs(baby.body.rotation.x)>1);
});
