import * as THREE from 'three';
import {isNether,isRadiant} from './prayer.js';

export function createPrayerVisuals(rig){
 const skinMaterials=new Map();
 rig.body.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name==='Alien skin'){const material=mesh.material;skinMaterials.set(material,{opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});}});
 const skinUniforms={nether:{value:0},freckles:{value:0}};
 const skin=rig.limbs.LeftLeg.mesh.material,originalCompile=skin.onBeforeCompile.bind(skin),originalKey=skin.customProgramCacheKey();
 skin.onBeforeCompile=shader=>{
  originalCompile(shader);shader.uniforms.nether=skinUniforms.nether;shader.uniforms.freckles=skinUniforms.freckles;
  shader.vertexShader='varying vec3 prayerSkinPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nprayerSkinPosition=position;');
  shader.fragmentShader=`uniform float nether,freckles;varying vec3 prayerSkinPosition;
   vec3 spiritEye(vec2 p){float outline=p.x*p.x+abs(p.y)*2.2;
    float fill=1.0-smoothstep(.94,1.04,outline);
    float rim=smoothstep(.65,.85,outline)*fill;
    float iris=(1.0-smoothstep(.2,.3,length(p*vec2(1.0,1.4))))*fill;
    float pupil=(1.0-smoothstep(.04,.09,abs(p.x)))*(1.0-smoothstep(.22,.35,abs(p.y)));
    return vec3(fill,rim,max(0.0,iris-pupil));}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 p=prayerSkinPosition;
   vec3 eyes=spiritEye((p.xy-vec2(0.0,1.26))/vec2(.145,.13));
   eyes=max(eyes,spiritEye((vec2(abs(p.x),p.y)-vec2(.355,.85))/vec2(.075,.09)));
   eyes*=nether*smoothstep(.055,.11,abs(p.z));
   float spots=pow(max(0.0,sin(p.x*87.0)*sin(p.y*93.0)*sin(p.z*79.0)),10.0)*freckles;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.075,.025,.19),eyes.x*.9);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.45,.22,.8),eyes.y);
   diffuseColor.rgb+=vec3(.3,.85,.75)*spots;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   // HDR radiance must exceed the shared bloom threshold before tone mapping.
   totalEmissiveRadiance+=vec3(3.0,1.2,8.0)*eyes.y+vec3(1.5,9.0,12.0)*eyes.z+vec3(3.0,12.0,9.0)*spots;
  `);
 };
 skin.customProgramCacheKey=()=>originalKey+'-prayer-skin-v2';
 const crystalMaterial=new THREE.MeshStandardMaterial({color:0x9783ce,emissive:0xbca2ff,emissiveIntensity:6,roughness:.3,metalness:.15});
 const crown=new THREE.Group();rig.joints.Head.add(crown);
 const dawnMaterial=new THREE.MeshStandardMaterial({color:0xffe9ae,emissive:0xffd98a,emissiveIntensity:2.4,roughness:.22,metalness:.1});
 const dawnHalo=new THREE.Group();dawnHalo.position.set(0,.14,-.24);rig.joints.Head.add(dawnHalo);
 dawnHalo.add(new THREE.Mesh(new THREE.TorusGeometry(.48,.012,6,64),dawnMaterial));
 for(let i=0;i<6;i++){
  const angle=i*Math.PI/3,ray=new THREE.Mesh(new THREE.OctahedronGeometry(.035),dawnMaterial);
  ray.scale.set(.65,2.2,.45);ray.position.set(Math.cos(angle)*.58,Math.sin(angle)*.58,0);ray.rotation.z=angle-Math.PI/2;dawnHalo.add(ray);
 }
 for(const sign of [-1,1]){const horn=new THREE.Mesh(new THREE.ConeGeometry(.085,.4,6),crystalMaterial);horn.position.set(sign*.24,.45,-.01);horn.rotation.z=-sign*.3;crown.add(horn);}
 const spines=new THREE.Group();rig.joints.Core.add(spines);
 for(let i=0;i<4;i++){const shard=new THREE.Mesh(new THREE.OctahedronGeometry(.075),crystalMaterial);shard.scale.set(.8,1.1,2.6);shard.position.set(0,.21-i*.14,-.19);spines.add(shard);}
 const eyes=['Left','Right'].map(side=>rig.body.getObjectByName(side+'Eye'));
 const originalEyes=eyes.map(eye=>({color:eye.material.color.clone(),emissive:eye.material.emissive.clone(),intensity:eye.material.emissiveIntensity}));
 crown.visible=spines.visible=dawnHalo.visible=false;
 return {skinUniforms,crown,spines,dawnHalo,
  update(person){
   const mutations=person.prayer?.mutations??[];
   const nether=isNether(person);
   for(const [material,original]of skinMaterials){
    const transparent=nether||original.transparent;
    if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
    material.opacity=nether?.42:original.opacity;material.depthWrite=nether?false:original.depthWrite;
   }
   skinUniforms.nether.value=isNether(person)?1:0;skinUniforms.freckles.value=mutations.includes('freckles')?1:0;
   crown.visible=mutations.includes('crown');spines.visible=mutations.includes('spines');
   dawnHalo.visible=isRadiant(person);
   for(const [i,eye]of eyes.entries()){
    const changed=mutations.includes('eyes');eye.material.color.copy(originalEyes[i].color);eye.material.emissive.copy(originalEyes[i].emissive);eye.material.emissiveIntensity=originalEyes[i].intensity;
    if(changed){eye.material.color.set(i?0xb66cff:0x5ef0df);eye.material.emissive.set(i?0xd8a6ff:0x7efff0);eye.material.emissiveIntensity=4.5;}
   }

  },
  dispose(){for(const geometry of new Set([...crown.children,...spines.children,...dawnHalo.children].map(o=>o.geometry)))geometry.dispose();crystalMaterial.dispose();dawnMaterial.dispose();}
 };
}
