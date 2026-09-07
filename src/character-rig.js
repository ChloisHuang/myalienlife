import * as THREE from 'three';
import {appearance,localToWorld,groundHeight} from './characters.js';

const JOINTS=['Hips','Spine','Head',...['Left','Right'].flatMap(s=>['UpperArm','Forearm','Hand','Thigh','Shin','Foot','Antenna'].map(n=>s+n))];
function effectMesh(parent,geometry,color,position){const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.5}));mesh.position.set(...position);parent.add(mesh);return mesh;}

export function createCharacter(source,spec){
 const root=new THREE.Group(),body=source.clone(true);root.add(body);root.position.set(spec.x,.29,spec.z);root.rotation.y=.35;
 const joints=Object.fromEntries(JOINTS.map(name=>{const node=body.getObjectByName(name);if(!node)throw new Error(`角色资产缺少关节：${name}`);return[name,node];}));
 const rest=new Map();body.traverse(n=>{rest.set(n,{position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone()});if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.material=n.material.clone();if(n.material.name==='Alien skin')n.material.color.set(spec.color);}});
 const meal=new THREE.Group();joints.LeftHand.add(meal);effectMesh(meal,new THREE.SphereGeometry(.16,16,8),0xe5dbbc,[0,.04,.09]).scale.set(1,.3,1);effectMesh(meal,new THREE.SphereGeometry(.12,12,8),0x9dd2a6,[0,.09,.09]).scale.y=.25;
 const spoon=new THREE.Group();joints.RightHand.add(spoon);effectMesh(spoon,new THREE.CapsuleGeometry(.015,.2,3,6),0xb9d9d5,[0,.07,.03]);effectMesh(spoon,new THREE.SphereGeometry(.045,10,6),0xe3eee3,[0,.19,.03]).scale.z=.5;
 const wateringCan=new THREE.Group();joints.RightHand.add(wateringCan);effectMesh(wateringCan,new THREE.CylinderGeometry(.11,.13,.2,12),0x94cbb1,[0,-.05,.08]);const spout=effectMesh(wateringCan,new THREE.CylinderGeometry(.035,.04,.24,8),0x94cbb1,[0,0,.24]);spout.rotation.x=1;
 const wash=new THREE.Group();root.add(wash);const particles=new Float32Array(60*3);const drops=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0xb8fff0,size:.047,transparent:true,opacity:.8}));drops.geometry.setAttribute('position',new THREE.BufferAttribute(particles,3));wash.add(drops);
 const halo=effectMesh(wash,new THREE.TorusGeometry(.42,.012,8,36),0x9ef9e2,[0,1,0]);halo.rotation.x=Math.PI/2;
 const cradle=new THREE.Group();root.add(cradle);effectMesh(cradle,new THREE.CylinderGeometry(.46,.35,.35,24),0xe1e6d6,[0,.18,0]).scale.z=1.25;effectMesh(cradle,new THREE.SphereGeometry(.4,20,12),0xa1d4bd,[0,.35,0]).scale.set(1,.2,1.3);
 const effects={meal,spoon,wateringCan,wash,cradle};Object.values(effects).forEach(e=>e.visible=false);
 return {root,body,joints,rest,effects,particles,drops,halo,skinColor:new THREE.Color(spec.color),last:{x:spec.x,z:spec.z},stride:0,profile:null,state:null,initialized:false};
}

export function updateCharacter(rig,{person,action,object,partner,time,delta}){
 const look=appearance(person),profile=`${person.gender}-${look.stage}-${JSON.stringify(person.genome)}`,state=action?`${action.id}-${action.type}-${action.phase}`:'idle';
 if(rig.initialized&&delta===0&&rig.profile===profile&&rig.state===state)return;
 const moving=Math.hypot(person.x-rig.last.x,person.z-rig.last.z),dx=person.x-rig.last.x,dz=person.z-rig.last.z;
 const targetPosition=new THREE.Vector3(person.x,groundHeight(person.x,person.z),person.z);let yaw=rig.root.rotation.y,tilt=0,roll=0;
 const pose=Object.fromEntries(JOINTS.map(n=>[n,[0,0,0]]));let bob=0;pose.Spine[0]=look.stoop;
 if(moving>.00001&&action?.phase==='walking'){
  yaw=Math.atan2(dx,dz);rig.stride+=moving*7.5/ look.scale;const step=Math.sin(rig.stride),opposite=-step;
  pose.LeftThigh[0]=step*.65;pose.RightThigh[0]=opposite*.65;
  pose.LeftShin[0]=Math.max(0,-step)*.8;pose.RightShin[0]=Math.max(0,step)*.8;
  pose.LeftFoot[0]=-pose.LeftShin[0]*.3;pose.RightFoot[0]=-pose.RightShin[0]*.3;
  pose.LeftUpperArm[0]=opposite*.55;pose.RightUpperArm[0]=step*.55;
  pose.LeftForearm[0]=-.18-Math.max(0,step)*.18;pose.RightForearm[0]=-.18-Math.max(0,-step)*.18;
  bob=Math.abs(Math.sin(rig.stride))* .055;pose.Hips[2]=step*.045;
 }else{bob=Math.sin(time*1.8)*.015;pose.Head[1]=Math.sin(time*.55)*.035;if(partner)yaw=Math.atan2(partner.x-person.x,partner.z-person.z);}
 Object.values(rig.effects).forEach(e=>e.visible=false);
 const acting=action?.phase==='acting',type=acting?action.type:null;
 if(acting){
  const wave=Math.sin(action.elapsed*5),settle=THREE.MathUtils.smoothstep(action.elapsed,0,.65);
  if(object){
   let local=[0,0,1.05],facing=Math.PI;
   if(type==='sleep'){local=[0,.99,-.9+1.78*look.scale];facing=0;tilt=-Math.PI/2*settle;pose.Spine[0]=0;pose.LeftUpperArm[2]=-.1;pose.RightUpperArm[2]=.1;bob=0;}
   if(type==='relax'){local=[.05,.56-.98*look.scale,0];facing=Math.PI/2;pose.LeftThigh[0]=pose.RightThigh[0]=-Math.PI/2*settle;pose.LeftShin[0]=pose.RightShin[0]=Math.PI/2*settle;pose.LeftForearm[0]=pose.RightForearm[0]=-.6;pose.Spine[0]=-.07;bob=0;}
   if(type==='wash'){local=[0,.26,0];facing=0;rig.effects.wash.visible=true;pose.LeftUpperArm[2]=-.65;pose.RightUpperArm[2]=.65;pose.LeftForearm[0]=-.8+wave*.2;pose.RightForearm[0]=-.8-wave*.2;}
   if(type==='eat'){local=[0,0,1.1];facing=action.elapsed<1?Math.PI:0;pose.LeftUpperArm[0]=-.5;pose.LeftForearm[0]=-1.4;pose.RightUpperArm[0]=-1.0-wave*.25;pose.RightForearm[0]=-1.35-wave*.2;pose.Head[0]=.06;rig.effects.meal.visible=true;rig.effects.spoon.visible=true;}
   if(type==='research'||type==='work'||type==='incubate'){local=[0,0,.95];pose.Spine[0]=.14;pose.LeftUpperArm[0]=-.85;pose.RightUpperArm[0]=-.85;pose.LeftForearm[0]=-.9+wave*.15;pose.RightForearm[0]=-.9-wave*.15;pose.Head[0]=.12;}
   if(['garden','harvest','replant'].includes(type)){local=[0,-.16,1.0];pose.Spine[0]=.48;pose.LeftThigh[0]=pose.RightThigh[0]=-.4;pose.LeftShin[0]=pose.RightShin[0]=.7;pose.RightUpperArm[0]=-.6+wave*.09;pose.RightForearm[0]=-.8;pose.LeftForearm[0]=-.3;rig.effects.wateringCan.visible=type==='garden';if(type==='harvest'){rig.effects.meal.visible=true;pose.LeftForearm[0]=-1.3;pose.RightUpperArm[0]=-.9+wave*.25;pose.RightForearm[0]=-.8-wave*.25;}}
   if(type==='dance'){local=[0,0,1.45];facing=0;pose.Hips[2]=wave*.15;pose.LeftUpperArm[2]=-.9-wave*.3;pose.RightUpperArm[2]=.9-wave*.3;pose.LeftForearm[0]=-1;pose.RightForearm[0]=-1;pose.LeftThigh[0]=wave*.25;pose.RightThigh[0]=-wave*.25;pose.LeftShin[0]=Math.max(0,-wave)*.5;pose.RightShin[0]=Math.max(0,wave)*.5;bob=Math.abs(wave)*.1;}
   if(type==='observe'){local=[0,-.08,1.02];pose.Spine[0]=.4;pose.Head[0]=.28;pose.LeftUpperArm[0]=pose.RightUpperArm[0]=-1;pose.LeftForearm[0]=pose.RightForearm[0]=-.8;}
   if(type==='explore'){local=[0,.35,Math.sin(action.elapsed*.7)*.3];pose.LeftUpperArm[2]=-.45;pose.RightUpperArm[2]=.45;bob=Math.sin(action.elapsed*2)*.08;}
   if(type==='admire'){local=[0,0,1.25];pose.Head[0]=-.12;pose.RightUpperArm[0]=-.9;pose.RightForearm[0]=-.5;}
   const p=localToWorld(object,local);targetPosition.lerp(new THREE.Vector3(p.x,p.y,p.z),settle);yaw=object.rotation+facing;
  }else if(type==='care'){pose.Spine[0]=.5;pose.LeftUpperArm[0]=pose.RightUpperArm[0]=-1;pose.LeftForearm[0]=-.9;pose.RightForearm[0]=-1.1+wave*.15;pose.LeftThigh[0]=pose.RightThigh[0]=-.5;pose.LeftShin[0]=pose.RightShin[0]=.9;targetPosition.y-=.16;rig.effects.meal.visible=true;
  }else if(['chat','joke','gift','flirt'].includes(type)){
   pose.RightUpperArm[0]=-.5+wave*.2;pose.RightForearm[0]=-.7-wave*.25;pose.LeftForearm[0]=-.3;pose.Head[0]=Math.sin(action.elapsed*3)*.06;
  }
 }
 // Profiles alter visible proportions, not just labels. Rest transforms prevent cumulative deformation.
 for(const [node,rest]of rig.rest){node.scale.copy(rest.scale);node.position.copy(rest.position);}
 rig.body.rotation.x=look.stage==='infant'?-Math.PI/2:0;
 if(look.stage==='infant'){rig.effects.cradle.visible=true;rig.body.position.y=.43;rig.body.position.z=.32;pose.LeftThigh[0]=pose.RightThigh[0]=-.4;pose.LeftShin[0]=pose.RightShin[0]=.7;pose.LeftForearm[0]=pose.RightForearm[0]=-.6;}
 rig.body.scale.setScalar(look.scale);rig.joints.Head.scale.multiplyScalar(look.head);
 rig.body.getObjectByName('Torso').scale.x*=look.shoulders;rig.body.getObjectByName('Pelvis').scale.x*=look.hips;
 for(const side of ['Left','Right']){
  rig.joints[side+'UpperArm'].position.x*=look.shoulders;rig.joints[side+'Antenna'].scale.y*=look.antenna;
  const brow=rig.body.getObjectByName(side+'ElderBrow');brow.visible=look.stage==='elder';
  pose[side+'Antenna'][0]=look.stage==='elder'?.45:look.stage==='child'?-.15:0;
  const eye=rig.body.getObjectByName(side+'Eye');if(type==='sleep')eye.scale.y*=.12;
  rig.body.getObjectByName(side+'Glint').visible=type!=='sleep';
 }
 if(rig.profile!==profile)rig.body.traverse(n=>{if(n.isMesh&&n.material.name==='Alien skin'){n.material.color.copy(rig.skinColor);if(look.stage==='elder')n.material.color.lerp(new THREE.Color(0xc2c9c0),.4);}});
 const blend=rig.initialized&&delta>0?1-Math.exp(-delta*16):1;
 for(const name of JOINTS){const node=rig.joints[name],rest=rig.rest.get(node);const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose[name],'XYZ'));q.premultiply(rest.quaternion);node.quaternion.slerp(q,blend);}
 rig.joints.Hips.position.y+=bob;rig.root.position.lerp(targetPosition,blend);
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,yaw,roll,'YXZ'));rig.root.quaternion.slerp(rotation,blend);rig.root.rotation.order='YXZ';
 if(rig.effects.wash.visible){for(let i=0;i<60;i++){const angle=i*2.399;rig.particles[i*3]=Math.cos(angle)*(.3+(i%3)*.05);rig.particles[i*3+1]=(2.2-(time*1.2+i*.13)%2.2)*look.scale;rig.particles[i*3+2]=Math.sin(angle)*(.3+(i%3)*.05);}rig.drops.geometry.attributes.position.needsUpdate=true;rig.halo.position.y=(.4+(Math.sin(time*2)+1)*.65)*look.scale;}
 rig.last={x:person.x,z:person.z};rig.profile=profile;rig.state=state;rig.initialized=true;
}
