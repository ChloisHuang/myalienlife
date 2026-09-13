import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createGame} from '../src/simulation.js';
import {createCharacter,updateCharacter} from '../src/character-rig.js';
import {groundHeight,localToWorld} from '../src/characters.js';

const bytes=await readFile(new URL('../public/assets/alien.glb',import.meta.url));
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
function fixture(island='home',x=0,z=0){
 const person=createGame().player;Object.assign(person,{island,x,z,age:28});person.genome.stature=1;
 return {person,rig:createCharacter(scene,person)};
}
const position=node=>node.getWorldPosition(new THREE.Vector3());

test('furniture-local height follows the authored elevated meadow placement',()=>{
 const object={type:'sofa',island:'spore',side:'front',x:0,z:-8,rotation:0};
 assert.ok(Math.abs(localToWorld(object,[0,0,0]).y-1.64)<1e-8);
});

for(const [island,type,height,front] of [['home','sofa',.49,.6],['spore','sofa',.705,.365],['home','fairyBench',.705,.365],['ocean','sofa',.67,.725]]){
 test(`${island} ${type} supports the seated body and keeps shins outside the cushion`,()=>{
  for(const stature of [.65,1,1.2])for(const rotation of [0,Math.PI/2]){
   const {person,rig}=fixture(island);person.genome.stature=stature;
   const object={type,island,side:'front',x:0,z:0,rotation};
   updateCharacter(rig,{person,object,action:{id:'seat',type:'relax',phase:'acting',elapsed:2,seat:1},time:0,delta:0});
   const floor=groundHeight(0,0,'front',island),support=floor+height;
   // The shipped mantle ends at y=.59; its lowest torso vertices must clear the seat.
   assert.ok(rig.root.position.y+.59*stature>=support-.015,`torso below seat: ${stature}`);
   const knee=position(rig.joints.LeftLegBend),ankle=position(rig.joints.LeftLegAnkle);
   const forward=p=>p.x*Math.cos(rotation)-p.z*Math.sin(rotation);
   assert.ok(forward(knee)>front+.04,`knee inside cushion: ${stature}`);
   assert.ok(forward(ankle)>front+.04,`shin inside cushion: ${stature}`);
  }
 });
}

test('standing interaction samples the ground at its contact position, not the furniture origin',()=>{
 const {person,rig}=fixture('spore',0,-6);
 const object={type:'lab',island:'spore',side:'front',x:0,z:-7,rotation:Math.PI};
 updateCharacter(rig,{person,object,action:{id:'work',type:'research',phase:'acting',elapsed:2},time:0,delta:0});
 assert.ok(Math.abs(rig.root.position.y-groundHeight(rig.root.position.x,rig.root.position.z,'front','spore'))<1e-8);
});

test('walking height follows the rendered horizontal position without sinking on slopes',()=>{
 const {person,rig}=fixture('spore',0,-5.5);
 updateCharacter(rig,{person,time:0,delta:0});
 person.z=-7;
 updateCharacter(rig,{person,action:{id:'walk',type:'walk',phase:'walking'},time:.1,delta:.1});
 assert.ok(Math.abs(rig.root.position.y-groundHeight(rig.root.position.x,rig.root.position.z,'front','spore'))<1e-8);
});

test('neutral standing is upright and the infant cradle pose remains intentional',()=>{
 const {person,rig}=fixture();
 updateCharacter(rig,{person,time:0,delta:0});
 assert.ok(Math.abs(rig.joints.Core.rotation.x)<1e-8);
 assert.ok(Math.abs(rig.root.rotation.x)<1e-8);
 person.age=1;updateCharacter(rig,{person,time:0,delta:0});
 assert.equal(rig.body.rotation.x,-Math.PI/2);assert.equal(rig.effects.cradle.visible,true);
});

for(const type of ['treeRest','seekLight','pray'])test(`${type} bends the legs with the lowered body, keeping skin above the floor`,()=>{
 for(const stature of [.65,1,1.2]){
  const {person,rig}=fixture();person.genome.stature=stature;person.side='back';
  const object=type==='seekLight'?undefined:{type:'spiritTree',x:0,z:-1.6,rotation:0,side:'back',island:'home'};
  updateCharacter(rig,{person,object,action:{id:type,type,phase:'acting',elapsed:2},time:0,delta:0});
  const skin=rig.limbs.LeftLeg.mesh,vertex=new THREE.Vector3();let minimum=Infinity;
  for(let i=0;i<skin.geometry.attributes.position.count;i++){skin.getVertexPosition(i,vertex);skin.localToWorld(vertex);minimum=Math.min(minimum,vertex.y);}
  assert.ok(minimum>=.28,`${type}, scale ${stature}: skin below ground at ${minimum}`);
 }
});

test('elder walking keeps an upright travel axis rather than tilting the entire leg chain',()=>{
 const {person,rig}=fixture();person.age=75;
 updateCharacter(rig,{person,time:0,delta:0});person.z+=.1;
 updateCharacter(rig,{person,action:{id:'walk',type:'walk',phase:'walking'},time:.1,delta:.1});
 const head=rig.root.worldToLocal(position(rig.joints.Head)),core=rig.root.worldToLocal(position(rig.joints.Core));
 assert.ok(Math.abs(head.z-core.z)<.001,`walking head leans ${head.z-core.z}`);
});

test('walking after sleep does not retain the lying-down pitch',()=>{
 const {person,rig}=fixture();const object={type:'pod',x:0,z:0,rotation:0,island:'home'};
 updateCharacter(rig,{person,object,action:{id:'sleep',type:'sleep',phase:'acting',elapsed:2},time:0,delta:0});
 person.z+=.02;
 updateCharacter(rig,{person,action:{id:'walk',type:'walk',phase:'walking'},time:1/60,delta:1/60});
 const up=new THREE.Vector3(0,1,0).applyQuaternion(rig.root.quaternion);
 assert.ok(up.y>.999,`walking body is still pitched: ${up.y}`);
});

test('walking pose stays upright between position updates, including frightened elders',()=>{
 const {person,rig}=fixture();person.age=75;
 const action={id:'walk',type:'walk',phase:'walking'},living={fear:60,tension:0};
 updateCharacter(rig,{person,action,living,time:0,delta:0});
 updateCharacter(rig,{person,action,living,time:1/60,delta:1/60});
 assert.ok(Math.abs(rig.joints.Core.rotation.x)<.001,'stationary walking frame reintroduced a full-body lean');
});

test('elder idle posture does not tilt the entire body forward',()=>{
 const {person,rig}=fixture();person.age=85;
 updateCharacter(rig,{person,time:0,delta:0});
 const head=rig.root.worldToLocal(position(rig.joints.Head)),core=rig.root.worldToLocal(position(rig.joints.Core));
 assert.ok(Math.abs(head.z-core.z)<.001,'elder idle body still leans forward');
});

test('tending roots bends the upper body without rotating planted legs around the hips',()=>{
 const {person,rig}=fixture();
 updateCharacter(rig,{person,time:0,delta:0});
 const ankle=rig.root.worldToLocal(position(rig.joints.LeftLegAnkle));
 const object={type:'spiritTree',x:0,z:-1.25,rotation:0,island:'home',side:'front'};
 updateCharacter(rig,{person,object,action:{id:'tend',type:'tendTree',phase:'acting',elapsed:2},time:0,delta:0});
 const contact=rig.root.worldToLocal(position(rig.joints.LeftLegAnkle));
 assert.ok(contact.distanceTo(ankle)<.001,`planted ankle moved ${contact.distanceTo(ankle)}`);
 assert.ok(rig.joints.Core.rotation.x>.3,'root tending lost its upper-body bend');
});
