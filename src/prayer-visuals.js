import * as THREE from 'three';
import {isNether,isRadiant} from './prayer.js';

export function createPrayerVisuals(rig){
 const skinUniforms={freckles:{value:0}};
 const skin=rig.limbs.LeftLeg.mesh.material,originalCompile=skin.onBeforeCompile.bind(skin),originalKey=skin.customProgramCacheKey();
 skin.onBeforeCompile=shader=>{
  originalCompile(shader);shader.uniforms.freckles=skinUniforms.freckles;
  shader.vertexShader='varying vec3 prayerSkinPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nprayerSkinPosition=position;');
  shader.fragmentShader='uniform float freckles;varying vec3 prayerSkinPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 p=prayerSkinPosition;
   float spots=pow(max(0.0,sin(p.x*87.0)*sin(p.y*93.0)*sin(p.z*79.0)),10.0)*freckles;
   diffuseColor.rgb+=vec3(.3,.85,.75)*spots;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   // HDR radiance must exceed the shared bloom threshold before tone mapping.
   totalEmissiveRadiance+=vec3(3.0,12.0,9.0)*spots;
  `);
 };
 skin.customProgramCacheKey=()=>originalKey+'-prayer-skin-v3';
 const netherEye={value:0},eyeMaterial=rig.body.getObjectByName('RightEye').material;
 const eyeCompile=eyeMaterial.onBeforeCompile.bind(eyeMaterial),eyeKey=eyeMaterial.customProgramCacheKey();
 eyeMaterial.onBeforeCompile=shader=>{
  eyeCompile(shader);shader.uniforms.netherEye=netherEye;
  shader.vertexShader='varying vec3 netherEyePosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nnetherEyePosition=position;');
  shader.fragmentShader='uniform float netherEye;varying vec3 netherEyePosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float eyeRadius=length(netherEyePosition.xy*vec2(1.0,1.38));
   float eyeFront=smoothstep(.3,.6,netherEyePosition.z)*netherEye;
   float irisRing=smoothstep(.24,.32,eyeRadius)*(1.0-smoothstep(.48,.58,eyeRadius))*eyeFront;
   float eyePupil=(1.0-smoothstep(.12,.2,eyeRadius))*eyeFront;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.035,.008,.075),netherEye);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.35,.035,.7),irisRing);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   totalEmissiveRadiance=mix(totalEmissiveRadiance,vec3(.035,.008,.075),netherEye);
   totalEmissiveRadiance+=vec3(1.1,.08,3.2)*irisRing+vec3(2.0,1.0,2.8)*eyePupil;
  `);
 };
 eyeMaterial.customProgramCacheKey=()=>eyeKey+'-nether-eye-v1';
 const crystalMaterial=new THREE.MeshStandardMaterial({color:0x9783ce,emissive:0xbca2ff,emissiveIntensity:6,roughness:.3,metalness:.15});
 const crown=new THREE.Group();rig.joints.Head.add(crown);
 const dawnMaterial=new THREE.MeshStandardMaterial({color:0xfff3ce,emissive:0xffe5a3,emissiveIntensity:4.2,roughness:.4,metalness:0});
 const dawnHalo=new THREE.Group();dawnHalo.position.set(0,.82,0);rig.joints.Head.add(dawnHalo);
 const haloRing=new THREE.Mesh(new THREE.TorusGeometry(.33,.018,8,64),dawnMaterial);haloRing.name='dawn-halo-ring';haloRing.rotation.x=Math.PI/2;dawnHalo.add(haloRing);
 const pixels=new Uint8Array(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5);pixels.set([255,255,255,Math.round(255*Math.exp(-(((r-.6)/.17)**2)))],(y*64+x)*4);}
 const haloTexture=new THREE.DataTexture(pixels,64,64);haloTexture.needsUpdate=true;
 const haloGlowMaterial=new THREE.MeshBasicMaterial({map:haloTexture,color:0xffe5a3,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
 const haloGlow=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.1),haloGlowMaterial);haloGlow.rotation.x=-Math.PI/2;dawnHalo.add(haloGlow);
 for(const sign of [-1,1]){const horn=new THREE.Mesh(new THREE.ConeGeometry(.085,.4,6),crystalMaterial);horn.position.set(sign*.24,.45,-.01);horn.rotation.z=-sign*.3;crown.add(horn);}
 const spines=new THREE.Group();rig.joints.Core.add(spines);
 const spineMaterial=new THREE.MeshStandardMaterial({color:0xbda5dc,emissive:0xbca2ff,emissiveIntensity:2,roughness:.55,metalness:0});
 for(let i=0;i<3;i++){const bump=new THREE.Mesh(new THREE.SphereGeometry(.06,16,12),spineMaterial);bump.scale.set(1,1,.6);bump.position.set(0,.19-i*.19,-.205);spines.add(bump);}
 const eyes=['Left','Right'].map(side=>rig.body.getObjectByName(side+'Eye'));
 const originalEyes=eyes.map(eye=>({color:eye.material.color.clone(),emissive:eye.material.emissive.clone(),intensity:eye.material.emissiveIntensity}));
 crown.visible=spines.visible=dawnHalo.visible=false;
 return {skinUniforms,netherEye,crown,spines,dawnHalo,
  update(person,time=0){
   const mutations=person.prayer?.mutations??[];
   netherEye.value=isNether(person)?1:0;skinUniforms.freckles.value=mutations.includes('freckles')?1:0;
   crown.visible=mutations.includes('crown');spines.visible=mutations.includes('spines');
   dawnHalo.visible=isRadiant(person);
   dawnHalo.position.y=.82+Math.sin(time*1.5)*.025;
   dawnMaterial.emissiveIntensity=4.2+Math.sin(time*1.5)*.4;haloGlowMaterial.opacity=.3+Math.sin(time*1.5)*.04;
   for(const [i,eye]of eyes.entries()){
    const changed=mutations.includes('eyes');eye.material.color.copy(originalEyes[i].color);eye.material.emissive.copy(originalEyes[i].emissive);eye.material.emissiveIntensity=originalEyes[i].intensity;
    if(changed){eye.material.color.set(i?0xb66cff:0x5ef0df);eye.material.emissive.set(i?0xd8a6ff:0x7efff0);eye.material.emissiveIntensity=4.5;}
   }

  },
  dispose(){for(const geometry of new Set([...crown.children,...spines.children,...dawnHalo.children].map(o=>o.geometry)))geometry.dispose();crystalMaterial.dispose();spineMaterial.dispose();dawnMaterial.dispose();haloGlowMaterial.dispose();haloTexture.dispose();}
 };
}
