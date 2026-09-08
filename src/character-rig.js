import {createPrayerVisuals} from './prayer-visuals.js';
import * as THREE from 'three';
import {appearance,localToWorld,groundHeight,SOFA_SEATS} from './characters.js';
import {StarToonMaterial} from './npr.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

const SIDES=['Left','Right'];
const NODES=['Core','Head','TorsoBone','HeadBone',...SIDES.flatMap(s=>['Antenna','TendrilBase','TendrilGuide','TendrilBend','TendrilWrist','TendrilTip','LegBase','LegGuide','LegBend','LegAnkle','LegTip'].map(n=>s+n))];
function effectMesh(parent,geometry,color,position){const mesh=new THREE.Mesh(geometry,new StarToonMaterial({color}));mesh.position.set(...position);parent.add(mesh);return mesh;}

function poseSkin(rig,limb){
 for(let i=0;i<limb.anchors.length;i++)rig.body.worldToLocal(limb.anchors[i].getWorldPosition(limb.curve.points[i]));
 limb.curve.updateArcLengths();const bodyRotation=rig.body.getWorldQuaternion(new THREE.Quaternion());
 for(let i=0;i<limb.bones.length;i++){
  const t=i/(limb.bones.length-1),bone=limb.bones[i],worldPoint=rig.body.localToWorld(limb.curve.getPointAt(t));
  const orientation=new THREE.Quaternion().setFromUnitVectors(limb.restTangents[i],limb.curve.getTangentAt(t)).multiply(limb.restRotations[i]).premultiply(bodyRotation);
  bone.position.copy(bone.parent.worldToLocal(worldPoint));bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));bone.updateMatrixWorld(true);
 }
}

export function createCharacter(source,spec){
 const root=new THREE.Group(),body=cloneSkeleton(source);root.add(body);root.position.set(spec.x,groundHeight(spec.x,spec.z,spec.side,spec.island),spec.z);root.rotation.y=.35;
 const joints=Object.fromEntries(NODES.map(name=>{const node=body.getObjectByName(name);if(!node)throw new Error(`角色资产缺少控制节点：${name}`);return[name,node];}));
 const limbs={};root.updateMatrixWorld(true);const inverseBodyRotation=body.getWorldQuaternion(new THREE.Quaternion()).invert();
 for(const side of SIDES)for(const kind of ['Tendril','Leg']){
  const name=side+kind,mesh=body.getObjectByName('BodySkin'),anchors=(kind==='Leg'?['Base','Guide','Bend','Ankle','Tip']:['Base','Guide','Bend','Wrist','Tip']).map(n=>joints[name+n]);
  const curve=new THREE.CatmullRomCurve3(anchors.map(a=>body.worldToLocal(a.getWorldPosition(new THREE.Vector3()))));
  const bones=Array.from({length:9},(_,i)=>body.getObjectByName(name+'Bone'+i));
  limbs[name]={mesh,curve,anchors,bones,restTangents:bones.map((_,i)=>curve.getTangentAt(i/8)),restRotations:bones.map(b=>b.getWorldQuaternion(new THREE.Quaternion()).premultiply(inverseBodyRotation))};
 }
 const rest=new Map();body.traverse(n=>{rest.set(n,{position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone()});if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.material=n.material.clone();if(n.material.name==='Alien skin')n.material.color.set(spec.color);}});
 const meal=new THREE.Group();joints.LeftTendrilTip.add(meal);effectMesh(meal,new THREE.SphereGeometry(.16,16,8),0xe5dbbc,[0,.04,.09]).scale.set(1,.3,1);effectMesh(meal,new THREE.SphereGeometry(.12,12,8),0x9dd2a6,[0,.09,.09]).scale.y=.25;
 const spoon=new THREE.Group();joints.RightTendrilTip.add(spoon);effectMesh(spoon,new THREE.CapsuleGeometry(.015,.2,3,6),0xb9d9d5,[0,.07,.03]);effectMesh(spoon,new THREE.SphereGeometry(.045,10,6),0xe3eee3,[0,.19,.03]).scale.z=.5;
 const wateringCan=new THREE.Group();joints.RightTendrilTip.add(wateringCan);effectMesh(wateringCan,new THREE.CylinderGeometry(.11,.13,.2,12),0x94cbb1,[0,-.05,.08]);const spout=effectMesh(wateringCan,new THREE.CylinderGeometry(.035,.04,.24,8),0x94cbb1,[0,0,.24]);spout.rotation.x=1;
 const wash=new THREE.Group();root.add(wash);const particles=new Float32Array(60*3),drops=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0xb8fff0,size:.047,transparent:true,opacity:.8}));drops.geometry.setAttribute('position',new THREE.BufferAttribute(particles,3));wash.add(drops);
 const halo=effectMesh(wash,new THREE.TorusGeometry(.46,.012,8,36),0x9ef9e2,[0,1,0]);halo.rotation.x=Math.PI/2;
 const cradle=new THREE.Group();root.add(cradle);effectMesh(cradle,new THREE.CylinderGeometry(.46,.35,.35,24),0xe1e6d6,[0,.18,0]).scale.z=1.25;effectMesh(cradle,new THREE.SphereGeometry(.4,20,12),0xa1d4bd,[0,.35,0]).scale.set(1,.2,1.3);
 const effects={meal,spoon,wateringCan,wash,cradle};Object.values(effects).forEach(e=>e.visible=false);
 const rig={root,body,joints,limbs,rest,effects,particles,drops,halo,skinColor:new THREE.Color(spec.color),last:{x:spec.x,z:spec.z},stride:0,profile:null,state:null,initialized:false};
 rig.prayerVisuals=createPrayerVisuals(rig);return rig;
}

export function updateCharacter(rig,{person,action,object,partner,time,delta,config}){
 const look=appearance(person,config?.lifeStages),profile=`${person.gender}-${look.stage}-${JSON.stringify(person.genome)}-${JSON.stringify(person.prayer)}`,state=action?`${action.id}-${action.type}-${action.phase}`:'idle';
 if(rig.initialized&&delta===0&&rig.profile===profile&&rig.state===state)return;
 const previousTips=Object.fromEntries(SIDES.map(side=>[side,rig.joints[side+'TendrilTip'].position.clone()])),poseBlend=rig.initialized&&delta>0?1-Math.exp(-delta*12):1;
 for(const [node,rest]of rig.rest){node.scale.copy(rest.scale);node.position.copy(rest.position);node.quaternion.copy(rest.quaternion);}
 const dx=person.x-rig.last.x,dz=person.z-rig.last.z,moving=Math.hypot(dx,dz)>.00001&&action?.phase==='walking';
 const target=new THREE.Vector3(person.x,groundHeight(person.x,person.z,person.side,person.island),person.z);
 let kneel=0,yaw=rig.root.rotation.y,tilt=0,roll=0,bob=Math.sin(time*1.8)*.01,compression=1;
 if(moving){yaw=Math.atan2(dx,dz);rig.stride+=Math.hypot(dx,dz)*Math.PI*2/(.72*look.scale);bob=Math.cos(rig.stride*2)*.012;compression=1-Math.sin(rig.stride*2)*.018;}
 else if(partner)yaw=Math.atan2(partner.x-person.x,partner.z-person.z);
 rig.joints.Core.rotation.x=look.stoop;rig.joints.Head.rotation.y=Math.sin(time*.55)*.045;
 const tips={Left:[-.37,-.69,.015],Right:[.37,-.69,.015]};
 for(const [i,side]of SIDES.entries()){tips[side][1]+=Math.sin(time*1.3+i*1.5)*.008;tips[side][2]+=moving?Math.cos(rig.stride+i*Math.PI-.3)*.17:Math.sin(time*.8+i)*.008;}
 Object.values(rig.effects).forEach(e=>e.visible=false);
 const type=['acting','celebrating'].includes(action?.phase)?(action.type==='lounge'?'relax':action.type):null;
 if(type){
  const wave=Math.sin(action.elapsed*3),settle=action.phase==='celebrating'?1:THREE.MathUtils.smoothstep(action.elapsed,0,.65);
  if(object){
   let local=[0,0,1.05],facing=Math.PI;
   if(type==='sleep'){local=[0,.99,-.9+1.78*look.scale];facing=0;tilt=-Math.PI/2*settle;bob=0;compression=.98;tips.Left=[-.28,-.54,.075];tips.Right=[.28,-.54,.075];}
   if(type==='relax'){local=[.05,.66-.9*look.scale,SOFA_SEATS[action.seat]];facing=Math.PI/2;compression=.96;bob=0;tips.Left=[-.25,-.34,.48];tips.Right=[.25,-.34,.48];
    if(partner){const relative=THREE.MathUtils.euclideanModulo(Math.atan2(partner.x-person.x,partner.z-person.z)-object.rotation-facing+Math.PI,Math.PI*2)-Math.PI;rig.joints.Core.rotation.y=THREE.MathUtils.clamp(relative,-.22,.22);rig.joints.Head.rotation.y=THREE.MathUtils.clamp(relative,-.55,.55);rig.joints.Head.rotation.x=Math.sin(time*2)*.025;tips.Right=[.24,-.20+Math.sin(time*2.1)*.05,.40];}
   }
   if(type==='wash'){
    local=[0,.10,0];facing=0;rig.effects.wash.visible=true;
    const alternate=THREE.MathUtils.smoothstep(Math.sin(action.elapsed*.75),-.3,.3);
    for(const [i,side]of SIDES.entries()){const sign=i===0?-1:1,active=i===0?alternate:1-alternate;
     tips[side]=new THREE.Vector3(sign*.36,-.66,.04).lerp(new THREE.Vector3(-sign*.08,.025+wave*.04,.24),active).toArray();}
   }
   if(['eat','taste','brew'].includes(type)){local=[0,0,1.1];facing=0;tips.Left=[-.15,.18,.40];tips.Right=[.09,.32+wave*.08,.34];rig.joints.Head.rotation.x=.08;rig.effects.meal.visible=rig.effects.spoon.visible=true;}
   if(['research','work','incubate','cook'].includes(type)){local=[0,0,.95];rig.joints.Core.rotation.x=.10;tips.Left=[-.24,.06+wave*.025,.51];tips.Right=[.24,.06-wave*.025,.51];}
   if(['garden','harvest','replant'].includes(type)){local=[0,-.05,1.0];rig.joints.Core.rotation.x=.22;tips.Left=[-.28,-.35,.55];tips.Right=[.24,-.48+wave*.06,.65];rig.effects.wateringCan.visible=type==='garden';rig.effects.meal.visible=type==='harvest';}
   if(type==='dance'){local=[0,0,1.45];facing=0;roll=wave*.13;bob+=Math.sin(action.elapsed*4)*.08;tips.Left=[-.57,.16+wave*.2,.25];tips.Right=[.57,.16-wave*.2,.25];}
   if(type==='observe'){local=[0,-.10,1.02];rig.joints.Core.rotation.x=.25;rig.joints.Head.rotation.x=.12;tips.Left=[-.2,.15,.48];tips.Right=[.2,.15,.48];}
   if(['explore','travel'].includes(type)){local=[0,.15,Math.sin(action.elapsed*.7)*.3];tips.Left=[-.54,.06,.28];tips.Right=[.54,.06,.28];}
   if(type==='pray'){local=[0,0,1.6];kneel=settle;bob=0;rig.joints.Core.rotation.x=0;rig.joints.Head.rotation.x=.22;rig.joints.Head.rotation.y=0;tips.Left=[-.055,-.10,.4];tips.Right=[.055,-.10,.4];}
   if(['lightDaily','lightGrow','lightParty'].includes(type)){tips.Right=[.3,.12+wave*.04,.5];rig.joints.Head.rotation.x=-.15;}
   if(['traceRelic','decodeRelic','decodeTogether','restoreMemory','tuneSleep','tuneInsight'].includes(type)){local=[0,0,action.hostId?-1.15:1.15];facing=action.hostId?0:Math.PI;rig.joints.Core.rotation.x=.16;tips.Left=[-.2,.05+wave*.07,.48];tips.Right=[.2,.05-wave*.07,.48];}
   if(['catchBugs','releaseBugs'].includes(type)){local=[0,0,1.1];tips.Left=[-.25,.2+wave*.12,.4];tips.Right=[.3,.3-wave*.1,.45];rig.joints.Head.rotation.x=-.18;}
   if(type==='chaseOrb'){local=[Math.sin(action.elapsed*2)*.65,0,1.25+Math.cos(action.elapsed*2)*.25];bob+=Math.abs(wave)*.05;tips.Left=[-.4,-.1+wave*.15,.35];tips.Right=[.4,-.1-wave*.15,.35];}
   if(type==='passOrb'){local=[0,0,action.hostId?-1.15:1.15];facing=action.hostId?0:Math.PI;tips.Left=[-.2,.1+wave*.12,.5];tips.Right=[.2,.1+wave*.12,.5];}
   if(type==='sootheOrb'){local=[0,0,1.15];rig.joints.Core.rotation.x=.18;tips.Right=[.25,-.05+wave*.06,.5];}
   if(type==='memoryExpedition'){local=[0,.15,Math.sin(action.elapsed*.7)*.3];tips.Left=[-.54,.06,.28];tips.Right=[.54,.06,.28];}
   const p=localToWorld(object,local);if(type==='pray')p.y=groundHeight(p.x,p.z,object.side,object.island);target.lerp(new THREE.Vector3(p.x,p.y,p.z),settle);yaw=object.rotation+facing;
  }else if(type==='care'){rig.joints.Core.rotation.x=.22;target.y-=.1;tips.Left=[-.15,-.30,.46];tips.Right=[.12,-.20+wave*.07,.48];rig.effects.meal.visible=true;
  }else if(['chat','joke','gift','flirt'].includes(type)){tips.Right=[.45,.12+wave*.12,.33];rig.joints.Head.rotation.x=wave*.045;}
 }
 rig.body.rotation.x=look.stage==='infant'?-Math.PI/2:0;rig.body.position.set(0,-.55*look.scale*kneel,0);
 if(look.stage==='infant'){rig.effects.cradle.visible=true;rig.body.position.set(0,.43,.35);tips.Left=[-.25,-.1,.2];tips.Right=[.25,-.1,.2];}
 rig.body.scale.setScalar(look.scale);rig.joints.Head.scale.multiply(new THREE.Vector3(person.genome.headWidth,person.genome.headHeight,person.genome.headDepth).multiplyScalar(look.head));
 rig.limbs.LeftLeg.mesh.morphTargetInfluences[rig.limbs.LeftLeg.mesh.morphTargetDictionary.JawTaper]=(person.genome.jaw-1)*5;
 const mantle=rig.joints.TorsoBone,breath=Math.sin(time*1.8)*.008;
 mantle.scale.x*=Math.sqrt(look.shoulders*look.hips/compression)*(1+breath);mantle.scale.y*=compression;mantle.scale.z*=(1+breath)/Math.sqrt(compression);
 for(const [i,side]of SIDES.entries()){
  const sign=i===0?-1:1,tip=rig.joints[side+'TendrilTip'];tip.position.lerpVectors(previousTips[side],new THREE.Vector3(...tips[side]),poseBlend);
  const base=rig.joints[side+'TendrilBase'];base.position.x*=look.shoulders;
  // Keep the long upper and lower sections as one smooth skin, bending around a broad elbow region.
  const direction=tip.position.clone().sub(base.position),distance=direction.length();direction.normalize();
  const bendDirection=new THREE.Vector3(sign*.6,-1,-.1);bendDirection.addScaledVector(direction,-bendDirection.dot(direction)).normalize();
  const elbow=type?base.position.clone().lerp(tip.position,.5).addScaledVector(bendDirection,Math.sqrt(Math.max(0,.54**2-(distance*.5)**2))):new THREE.Vector3(sign*.35,-.19,moving?Math.cos(rig.stride+i*Math.PI)*.065:0);
  if(type==='relax')elbow.set(sign*.39,-.13,.09);
  if(type==='sleep')elbow.set(sign*.30,-.20,.03);
  if(type==='pray')elbow.set(sign*.32,-.28,.22);
  if(type==='wash')elbow.set(sign*.35,-.18,.06);
  rig.joints[side+'TendrilBend'].position.copy(elbow);
  rig.joints[side+'TendrilGuide'].position.copy(base.position).lerp(elbow,.52);
  rig.joints[side+'TendrilGuide'].position.x+=sign*.06;
  rig.joints[side+'TendrilWrist'].position.copy(elbow).lerp(tip.position,.52);
  // The planted foot travels backwards at walking speed; only the return step lifts.
  const phase=(rig.stride/(Math.PI*2)+i*.5)%1,stance=.62,swing=(phase-stance)/(1-stance),reach=.72*stance/2;
  const stride=moving?(phase<stance?reach-phase/stance*reach*2:-reach+reach*2*(swing-Math.sin(swing*Math.PI*2)/(Math.PI*2))):0;
  const lift=moving&&phase>=stance?Math.sin(swing*Math.PI)**2*.13:0;
  const legBase=rig.joints[side+'LegBase'],guide=rig.joints[side+'LegGuide'],bend=rig.joints[side+'LegBend'],ankle=rig.joints[side+'LegAnkle'],toe=rig.joints[side+'LegTip'];
  const legX=sign*.155*look.hips;legBase.position.x=sign*.075*look.hips;
  guide.position.set(sign*.14*look.hips,-.48,stride*.25+lift*.25);bend.position.set(legX,-.76,stride*.6+.025+lift*.5);
  ankle.position.set(legX,-.98+lift-bob,stride+.025);toe.position.set(legX,-1.02+lift-bob,stride+.14);
  if(type==='relax'){guide.position.set(legX,-.38,.18);bend.position.set(legX,-.45,.35);ankle.position.set(legX,-.86,.35);toe.position.set(legX,-.90,.465);}
  if(type==='pray'){guide.position.lerp(new THREE.Vector3(legX,-.22,.18),kneel);bend.position.lerp(new THREE.Vector3(legX,-.48,.4),kneel);ankle.position.lerp(new THREE.Vector3(legX,-.48,.03),kneel);toe.position.lerp(new THREE.Vector3(legX,-.50,-.22),kneel);}
  if(type==='dance'){bend.position.z+=Math.sin(time*3+i)*.10;toe.position.y+=Math.max(0,Math.sin(time*3+i*Math.PI))*.10;}
  rig.joints[side+'Antenna'].scale.y*=look.antenna;rig.joints[side+'Antenna'].rotation.x=(look.stage==='elder'?.35:0)+Math.sin(time*1.3+i)*.06;
  rig.body.getObjectByName(side+'AntennaLight').scale.y/=look.antenna;
  rig.body.getObjectByName(side+'ElderBrow').visible=look.stage==='elder';
  const jawWidth=1-(person.genome.jaw-1)*1.5*(1-THREE.MathUtils.smoothstep(1.8,1.72,1.86));
  for(const part of ['Eye','Glint']){const feature=rig.body.getObjectByName(side+part);feature.position.x*=jawWidth;feature.scale.x*=jawWidth;}
  const blinkPhase=(time+rig.skinColor.g*7)%5.3,blink=1-.9*Math.max(0,1-Math.abs(blinkPhase-.12)/.12);
  rig.body.getObjectByName(side+'Eye').scale.y*=type==='sleep'?.12:type==='pray'?.25:blink;rig.body.getObjectByName(side+'Glint').visible=type!=='sleep'&&blink>.5;
 }
 if(rig.profile!==profile)rig.body.traverse(n=>{if(n.isMesh&&n.material.name==='Alien skin'){n.material.color.copy(rig.skinColor);if(look.stage==='elder')n.material.color.lerp(new THREE.Color(0xc2c9c0),.4);}});
 const blend=rig.initialized&&delta>0?1-Math.exp(-delta*16):1;rig.joints.Core.position.y+=bob;rig.root.position.lerp(target,blend);
 rig.root.rotation.order='YXZ';rig.root.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,yaw,roll,'YXZ')),blend);
 rig.root.updateMatrixWorld(true);
 const headBone=rig.joints.HeadBone,head=rig.joints.Head;headBone.position.copy(headBone.parent.worldToLocal(head.getWorldPosition(new THREE.Vector3())));headBone.quaternion.copy(headBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(head.getWorldQuaternion(new THREE.Quaternion())));headBone.scale.copy(head.scale);headBone.updateMatrixWorld(true);
 for(const limb of Object.values(rig.limbs))poseSkin(rig,limb);
 const skin=rig.limbs.LeftLeg.mesh;skin.skeleton.update();skin.computeBoundingSphere();
 if(rig.effects.wash.visible){for(let i=0;i<60;i++){const angle=i*2.399;rig.particles[i*3]=Math.cos(angle)*(.4+(i%3)*.035);rig.particles[i*3+1]=(2.2-(time*1.2+i*.13)%2.2)*look.scale;rig.particles[i*3+2]=Math.sin(angle)*(.4+(i%3)*.035);}rig.drops.geometry.attributes.position.needsUpdate=true;rig.halo.position.y=(.4+(Math.sin(time*2)+1)*.65)*look.scale;}
 rig.prayerVisuals.update(person);
 rig.last={x:person.x,z:person.z};rig.profile=profile;rig.state=state;rig.initialized=true;
}
