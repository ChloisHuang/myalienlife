import * as THREE from 'three';

export function createStoryWater(dark){
 const uniforms={time:{value:0},dark:{value:dark?1:0}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,side:THREE.DoubleSide,depthWrite:false,
  vertexShader:`varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float time;uniform float dark;varying vec2 p;
  void main(){
   float bank=smoothstep(0.,.19,p.y)*smoothstep(0.,.19,1.-p.y);
   float waves=sin(p.x*145.-time*2.8+sin(p.y*25.))*sin(p.y*43.+p.x*28.-time);
   float glint=pow(max(0.,waves),12.);
   float ripples=pow(.5+.5*sin(length((p-vec2(.32,.55))*vec2(25.,1.))*48.-time*.5),24.);
   float scum=smoothstep(.15,.65,sin(p.x*67.+sin(p.y*13.))*cos(p.y*21.+p.x*12.))*(1.-bank*.8);
   vec3 clear=mix(vec3(.40,.78,.66),vec3(.04,.43,.48),bank)+glint*vec3(.55,.8,.8);
   vec3 stale=mix(vec3(.20,.25,.12),vec3(.055,.105,.10),bank)+scum*vec3(.19,.19,.035)+ripples*.025;
   gl_FragColor=vec4(mix(clear,stale,dark),mix(.72,.94,dark));
  }`});
 const root=new THREE.Group();
 const surface=new THREE.Mesh(new THREE.PlaneGeometry(dark?28:27.8,.76,1,1),material);surface.rotation.x=-Math.PI/2;surface.position.set(dark?0:-.1,.075,7.5);root.add(surface);
 if(!dark){
  // Carry the lip beyond the outermost page before turning downward, avoiding cliff occlusion.
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(13.8,.075,7.5),new THREE.Vector3(14.3,.075,7.5),new THREE.Vector3(14.62,-.18,7.5),new THREE.Vector3(14.7,-.65,7.5),new THREE.Vector3(14.7,-3.2,7.5)]);
  const positions=[],uvs=[],indices=[],segments=40;
  for(let i=0;i<=segments;i++){const p=path.getPoint(i/segments);for(const side of [-1,1]){positions.push(p.x,p.y,p.z+side*.38);uvs.push(i/segments,(side+1)/2);}if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  root.add(new THREE.Mesh(geometry,material));
  const foam=new THREE.Mesh(new THREE.TorusGeometry(.37,.055,5,18),new THREE.MeshBasicMaterial({color:0xe0fff1,transparent:true,opacity:.65}));foam.rotation.x=-Math.PI/2;foam.position.set(14.7,-3.2,7.5);root.add(foam);
 }
 return {root,update(t){uniforms.time.value=t;},dispose(){root.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material!==material)o.material.dispose();}});material.dispose();}};
}

export function meadowMaterial(material,dark){
 const baseCompile=material.onBeforeCompile.bind(material);
 material.onBeforeCompile=shader=>{
  baseCompile(shader);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 meadowPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nmeadowPosition=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 meadowPosition;
   float meadowNoise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float earthCracks(vec2 p){
    vec2 cell=floor(p),f=fract(p);float first=9.,second=9.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
     vec2 g=vec2(float(x),float(y));vec2 seed=vec2(meadowNoise(cell+g),meadowNoise(cell+g+39.7));
     float d=length(g+.18+.64*seed-f);
     if(d<first){second=first;first=d;}else second=min(second,d);
    }
    return second-first;
   }`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    vec2 q=meadowPosition.xz;
    float grain=meadowNoise(floor(q*95.));
    float meadowPatch=sin(q.x*1.9+sin(q.y*2.1))*cos(q.y*1.4+q.x*.35);
    float fleck=step(.93,grain);
    diffuseColor.rgb*=.83+.27*grain+.16*meadowPatch;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${dark?'.18,.15,.10':'.38,.30,.10'}),smoothstep(.55,.9,meadowPatch)*.42);
    diffuseColor.rgb+=fleck*${dark?'.014':'.035'};
    ${dark?`float fissure=earthCracks(q*1.6+vec2(sin(q.y*5.),cos(q.x*4.))*.09);
    float openCrack=1.-smoothstep(.012,.060,fissure);
    float lip=smoothstep(.045,.07,fissure)*(1.-smoothstep(.07,.105,fissure));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.006,.009,.006),openCrack*.94);
    diffuseColor.rgb+=lip*vec3(.035,.032,.021);`:''}`);
 };
 material.customProgramCacheKey=()=>`star-cel-storybook-ground-${dark}`;
}
