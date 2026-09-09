import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const white=0xe6eeee,roomTypes=['卧室','客厅','厨房','卫浴','育生室','研究室'];
function box(parent,color,x,y,z,w,h,d){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.08,h/3)),new THREE.MeshStandardMaterial({color,roughness:.68}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function room(parent,spec,index,rooms,accent,baseLayout){
 const {x,z,w,d,type}=spec,g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 const tones=[0xd2dfcf,0xe0cbd2,0xcbd9de,0xbfd6cc,0xe1d9c5,0xcbd0df];
 box(g,tones[roomTypes.indexOf(type)],0,.28,0,w,.16,d);
 const walls=[{axis:'x',at:-w/2,length:d,sign:-1},{axis:'x',at:w/2,length:d,sign:1},{axis:'z',at:-d/2,length:w,sign:-1},{axis:'z',at:d/2,length:w,sign:1}];
 for(const wall of walls){
  const wx=x+(wall.axis==='x'?wall.at:0),wz=z+(wall.axis==='z'?wall.at:0);
  const neighbor=rooms.findIndex((r,i)=>i!==index&&(wall.axis==='x'?Math.abs(r.x-wall.sign*r.w/2-wx)<.02&&Math.abs(r.z-z)<(r.d+d)/2-.1:Math.abs(r.z-wall.sign*r.d/2-wz)<.02&&Math.abs(r.x-x)<(r.w+w)/2-.1));
  if(neighbor>=0&&neighbor<index)continue;
  const high=wall.axis==='z'&&wall.sign===-1&&neighbor<0, h=high?2.3:.85;
  const gap=high?0:1.4,segment=(wall.length-gap)/2;
  for(const side of [-1,1]){
   const offset=side*(gap/2+segment/2),cx=wall.axis==='x'?wall.at:offset,cz=wall.axis==='z'?wall.at:offset;
   const sw=wall.axis==='x'?.14:segment,sd=wall.axis==='z'?.14:segment;
   if(baseLayout.some(p=>Math.abs(p.x-(x+cx))<sw/2+1&&Math.abs(p.z-(z+cz))<sd/2+1))continue;
   box(g,white,cx,.36+h/2,cz,sw,h,sd);
   box(g,accent,cx,.36+h+.04,cz,sw+.03,.055,sd+.03);
  }
  if(high){box(g,0x839fa0,0,1.68,-d/2+.09,Math.min(w-1,2),.95,.04);box(g,0xb5d6d3,0,1.68,-d/2+.12,Math.min(w-1.12,1.88),.83,.03);}
 }
 g.userData.room=type;return g;
}

export function createHousingVisual(plan,baseLayout){
 const root=new THREE.Group();root.name='settlement-housing';
 for(const c of plan.corridors)box(root,0xcbd4cc,c.x,.26,c.z,c.w,.12,c.d);
 for(const [i,r]of plan.rooms.entries())room(root,r,i,plan.rooms,0xb7c9c2,baseLayout);
 const parts=[];root.traverse(n=>{if(n.isMesh)parts.push(n);});
 return {root,update(progress){parts.forEach((m,i)=>{m.visible=progress>=(i+1)/parts.length*.65;});},dispose(){root.removeFromParent();for(const m of parts){m.geometry.dispose();m.material.dispose();}}};
}
