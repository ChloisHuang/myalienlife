import * as THREE from 'three';
import {createMoonBats} from './blood-moon.js';
import {createLunarGeometry,MOON_LIGHT_DIRECTION} from './lunar-surface.js';

export function createStoryMoon(surface){
 const root=new THREE.Group(),phase={value:0},keyDirection={value:new THREE.Vector3()},ornaments=[],bodies=[];
 root.name='storybook-moon';root.add(surface);
 surface.traverse(o=>{if(!o.isMesh)return;
  const materials=Array.isArray(o.material)?o.material:[o.material];
  if(materials.some(m=>m.name==='ivory')){
   o.geometry.computeBoundingSphere();o.geometry=createLunarGeometry(o.geometry.boundingSphere.radius);o.updateMorphTargets();bodies.push(o);
  }
  for(const material of materials){
   if(material.name!=='ivory'){ornaments.push({material,opacity:material.opacity});material.transparent=true;continue;}
   const original=material.onBeforeCompile.bind(material);
   material.customProgramCacheKey=()=> 'story-moon-relief-lighting-v1';
   material.onBeforeCompile=shader=>{
    original(shader);shader.uniforms.storyPhase=phase;shader.uniforms.lunarKeyDirection=keyDirection;
    shader.fragmentShader='uniform float storyPhase; uniform vec3 lunarKeyDirection;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
     float lunarLight=dot(normal,lunarKeyDirection);
     float lunarAA=max(fwidth(lunarLight),.018);
     vec3 lunarShade=mix(vec3(.008,.001,.003),vec3(.046,.002,.008),smoothstep(-.10-lunarAA,.06+lunarAA,lunarLight));
     lunarShade=mix(lunarShade,vec3(.19,.004,.016),smoothstep(.23-lunarAA,.33+lunarAA,lunarLight));
     lunarShade=mix(lunarShade,vec3(.36,.009,.025),smoothstep(.65-lunarAA,.72+lunarAA,lunarLight));
     lunarShade=mix(lunarShade,vec3(.68,.016,.034),smoothstep(.92-lunarAA,.96+lunarAA,lunarLight));
     float lunarFacing=max(dot(normal,normalize(vViewPosition)),0.0);
     float lunarRim=(1.0-smoothstep(.04,.15,lunarFacing))*smoothstep(.15,.60,lunarLight);
     vec3 lunarEmission=vec3(.010,.0005,.0015)+lunarRim*vec3(6.5,.016,.036);
     outgoingLight=mix(outgoingLight,lunarShade+lunarEmission,storyPhase);
     #include <opaque_fragment>`);
   };
  }
 });
 const bats=createMoonBats();root.add(bats.root);const batMaterial=bats.root.children[0].material;batMaterial.transparent=true;batMaterial.depthWrite=false;
 const front=new THREE.Vector3(-2,-5,-28),back=new THREE.Vector3(-8,-5.5,-26);
 const light=new THREE.SpotLight(0xff6357,95,55,.72,.85,2);light.position.set(-8,10,-16);light.target.position.set(-2,0,0);
 return {root,surface,light,keyDirection,update(angle,visible,time,camera){
  const t=THREE.MathUtils.clamp(angle/Math.PI,0,1),blend=THREE.MathUtils.smoothstep(t,0,1);
  root.visible=visible;root.position.lerpVectors(front,back,blend);root.position.y+=Math.sin(t*Math.PI)*2;
  surface.rotation.y=angle*.35;phase.value=blend;
  camera.updateMatrixWorld();keyDirection.value.copy(MOON_LIGHT_DIRECTION).transformDirection(camera.matrixWorldInverse);
  for(const body of bodies)body.morphTargetInfluences[0]=blend;
  for(const {material,opacity}of ornaments)material.opacity=opacity*(1-blend);
  batMaterial.opacity=blend;bats.root.visible=t>0;bats.update(time,camera);
  light.visible=visible;light.intensity=95*blend;
 }};
}
