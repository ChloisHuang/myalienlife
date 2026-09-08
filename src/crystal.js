import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

class CrystalMaterial extends THREE.MeshPhysicalMaterial{
 constructor(color=0xa6dce8){
  super({color,roughness:.055,metalness:0,transmission:.48,thickness:.45,ior:1.46,
   clearcoat:1,clearcoatRoughness:.045,flatShading:true,
   attenuationColor:new THREE.Color(color),attenuationDistance:2.8,
   emissive:color,emissiveIntensity:.035});
  this.bio={time:{value:0},strength:{value:.2}};
 }
 onBeforeCompile(shader){
  shader.uniforms.crystalTime=this.bio.time;shader.uniforms.crystalStrength=this.bio.strength;
  shader.fragmentShader='uniform float crystalTime,crystalStrength;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
   '#include <emissivemap_fragment>\ntotalEmissiveRadiance*=crystalStrength*(.65+.35*sin(crystalTime*.8));');
 }
 customProgramCacheKey(){return 'ice-crystal-v1';}
}

export function createCrystalFactory(renderer){
 const room=new RoomEnvironment(),generator=new THREE.PMREMGenerator(renderer);
 const environment=generator.fromScene(room,.04).texture,materials=new Set();room.dispose();generator.dispose();
 function createCrystalMesh(geometry,color){
 const crystal=new THREE.Mesh(geometry,new CrystalMaterial(color));
 crystal.material.envMap=environment;crystal.material.envMapIntensity=.35;materials.add(crystal.material);
 crystal.material.addEventListener('dispose',event=>materials.delete(event.target));
 crystal.receiveShadow=true;
 // A small off-center inclusion is refracted through the transparent outer facets.
 const core=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
  color:new THREE.Color(color).lerp(new THREE.Color(0xeefaff),.65),roughness:.16,metalness:.05,
  emissive:color,emissiveIntensity:.28,flatShading:true,
 }));
 core.scale.set(.28,.65,.28);core.position.set(.015,.06,0);crystal.add(core);
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,22),new THREE.LineBasicMaterial({
  color:0xe0f8ff,transparent:true,opacity:.12,depthWrite:false,
 }));
 crystal.add(edges);return crystal;
 }
 createCrystalMesh.updateLight=(daylight,dark)=>{
  const intensity=THREE.MathUtils.lerp(.3+daylight*.3,.12+daylight*.12,dark);
  for(const material of materials)material.envMapIntensity=intensity;
 };
 return createCrystalMesh;
}
