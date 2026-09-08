import * as THREE from 'three';
export function createBlinkVisual(character){
 const dissolve={value:0},meshes=[];
 character.traverse(mesh=>{if(!mesh.isMesh)return;meshes.push([mesh,mesh.castShadow]);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
  if(material.userData.blinkShader)continue;material.userData.blinkShader=true;
  const compile=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=shader=>{compile(shader);shader.uniforms.blinkDissolve=dissolve;
   shader.vertexShader='varying vec3 blinkPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','blinkPoint=transformed;\n#include <project_vertex>');
   shader.fragmentShader='uniform float blinkDissolve; varying vec3 blinkPoint;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    float blinkNoise=fract(sin(dot(floor(blinkPoint*32.0),vec3(12.9898,78.233,37.719)))*43758.5453);
    if(blinkDissolve>0.0 && blinkNoise<blinkDissolve)discard;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight+=vec3(2.4,.7,4.5)*(1.0-smoothstep(0.0,.16,blinkNoise-blinkDissolve))*step(.001,blinkDissolve);
    #include <opaque_fragment>`);
  };material.customProgramCacheKey=()=>cache()+'-nether-dissolve-v1';material.needsUpdate=true;
 }});
 const root=new THREE.Group(),geometry=new THREE.BufferGeometry(),positions=new Float32Array(120*3);geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const pixels=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);pixels.set([255,255,255,Math.round(255*Math.max(0,1-r)**2)],i);}const texture=new THREE.DataTexture(pixels,32,32);texture.needsUpdate=true;
 const material=new THREE.PointsMaterial({color:new THREE.Color(2.5,.9,4),map:texture,size:.32,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});root.add(new THREE.Points(geometry,material));
 const glowMaterial=new THREE.SpriteMaterial({color:new THREE.Color(1.7,.4,3),map:texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),glow=new THREE.Sprite(glowMaterial);glow.position.y=1.1;glow.scale.set(2.5,3.5,1);root.add(glow);root.visible=false;
 return {root,reset(){root.visible=false;dissolve.value=0;for(const [mesh,shadow]of meshes)mesh.castShadow=shadow;},update(progress){root.visible=true;const pulse=Math.sin(Math.PI*progress);dissolve.value=progress<.5?THREE.MathUtils.smoothstep(progress,0,.43):1-THREE.MathUtils.smoothstep(progress,.57,1);
  for(const [mesh]of meshes)mesh.castShadow=false;
  for(let i=0;i<120;i++){const a=i*2.399+progress*6,r=(.15+i%7/9)*(.5+pulse);positions.set([Math.cos(a)*r,.1+(i%23)/10+Math.sin(a)*pulse*.25,Math.sin(a)*r],i*3);}geometry.attributes.position.needsUpdate=true;material.opacity=pulse;glowMaterial.opacity=pulse*.6;
 },dispose(){root.removeFromParent();geometry.dispose();material.dispose();glowMaterial.dispose();texture.dispose();}};
}
