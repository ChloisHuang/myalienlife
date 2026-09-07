import * as THREE from 'three';

// Opaque rock with mineral seams. Lighting stays cool without erasing the surface.
export function createDarkGroundMaterial(){
 const material=new THREE.MeshStandardMaterial({color:0x9384ac,roughness:.94,metalness:.08});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 rockPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrockPosition=position;');
  shader.fragmentShader=`varying vec3 rockPosition;
   vec2 rockHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
   vec3 rockCell(vec2 p){
    vec2 base=floor(p),f=fract(p);float nearest=10.0,second=10.0,tint=0.0;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
     vec2 offset=vec2(float(x),float(y)),seed=rockHash(base+offset),delta=offset+seed-f;float d=dot(delta,delta);
     if(d<nearest){second=nearest;nearest=d;tint=seed.x;}else second=min(second,d);
    }
    return vec3(second-nearest,nearest,tint);
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 p=rockPosition.xz;vec3 cell=rockCell(p*.62);
   float seam=1.0-smoothstep(.025,.095,cell.x);
   float grain=rockHash(floor(p*75.0)).x;
   float strata=sin(p.x*2.1+sin(p.y*1.3)*1.8)*.5+.5;
   diffuseColor.rgb*=mix(.62,1.15,cell.z)*mix(.87,1.05,strata)*mix(.88,1.05,grain);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.038,.065,.085),seam*.8);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float mineral=seam*smoothstep(.62,.92,rockHash(floor(p*1.7)).x);
   totalEmissiveRadiance+=vec3(.025,.20,.18)*mineral;
  `);
 };
 material.customProgramCacheKey=()=> '幽星岩地-v1';
 return material;
}
