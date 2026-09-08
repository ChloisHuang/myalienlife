import * as THREE from 'three';
import {StarToonMaterial,noiseGLSL} from './npr.js';

export function createFrontGroundMaterial(color){
 const material=new StarToonMaterial({color});
 material.onBeforeCompile=shader=>{
  StarToonMaterial.prototype.onBeforeCompile.call(material,shader);
  shader.vertexShader='varying vec2 floorPosition;varying float floorTop;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nfloorPosition=position.xz;floorTop=smoothstep(.65,.95,normal.y);');
  shader.fragmentShader=`varying vec2 floorPosition;varying float floorTop;${noiseGLSL}\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   {
    vec2 grid=floorPosition/1.2,cell=floor(grid),edge=min(fract(grid),1.0-fract(grid));
    float distance=min(edge.x,edge.y),aa=max(fwidth(distance),.002);
    float grout=1.0-smoothstep(.009,.009+aa,distance);
    float inlay=smoothstep(.035-aa,.035,distance)*(1.0-smoothstep(.048,.048+aa,distance));
    vec3 surface=diffuseColor.rgb*(.98+.02*hash(cell));
    surface=mix(surface,surface*.68,grout*.6);
    surface=mix(surface,vec3(.78,.78,.66),inlay*.28);
    float diamond=abs(fract(grid.x)-.5)+abs(fract(grid.y)-.5);
    float motif=1.0-smoothstep(.026,.026+aa,diamond);
    surface=mix(surface,vec3(.55,.67,.64),motif*.5);
    diffuseColor.rgb=mix(diffuseColor.rgb,surface,floorTop);
   }`);
 };
 material.customProgramCacheKey=()=> 'habitat-cel-tile-v1';
 return material;
}

const platformGlass=new THREE.MeshPhysicalMaterial({color:0xf4f7ff,roughness:.04,metalness:0,transmission:.86,thickness:.18,ior:1.4,clearcoat:1,clearcoatRoughness:.05,attenuationColor:0xffffff,attenuationDistance:8});
export function createGlassPlatform(spec){
 const {width,depth,radius,height}=spec,shape=new THREE.Shape();
 const x=width/2-radius,z=depth/2-radius;
 shape.absarc(x,z,radius,0,Math.PI/2,false);
 shape.absarc(-x,z,radius,Math.PI/2,Math.PI,false);
 shape.absarc(-x,-z,radius,Math.PI,Math.PI*1.5,false);
 shape.absarc(x,-z,radius,Math.PI*1.5,Math.PI*2,false);shape.closePath();
 const group=new THREE.Group();group.position.set(spec.x,0,spec.z);group.rotation.y=spec.rotation;
 const slab=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,curveSegments:16,steps:1}),platformGlass);
 slab.rotation.x=-Math.PI/2;slab.position.y=height-.185;slab.receiveShadow=true;group.add(slab);
 // Thin perimeter highlights reveal thickness without subdividing the glass.
 const outline=new THREE.BufferGeometry().setFromPoints(shape.getPoints(64).map(p=>new THREE.Vector3(p.x,height,-p.y)));
 group.add(new THREE.LineLoop(outline,new THREE.LineBasicMaterial({color:0xf4f8ff,transparent:true,opacity:.45})));
 const lower=outline.clone();lower.translate(0,-.16,0);
 group.add(new THREE.LineLoop(lower,new THREE.LineBasicMaterial({color:0x899dab,transparent:true,opacity:.45})));
 const shadow=new THREE.Mesh(new THREE.ShapeGeometry(shape,16),new THREE.MeshBasicMaterial({color:0x566579,transparent:true,opacity:.09,depthWrite:false}));
 shadow.rotation.x=-Math.PI/2;shadow.position.set(.05,-.075,.10);shadow.scale.setScalar(.98);group.add(shadow);
 return group;
}
