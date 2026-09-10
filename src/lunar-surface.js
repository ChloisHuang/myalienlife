import * as THREE from 'three';

export const MOON_LIGHT_DIRECTION=new THREE.Vector3(-.03,.07,1).normalize();
const craters=[[-.5,.45,.8,.25],[.12,.2,1,.11],[-.5,-.12,.8,.13],[.1,-.48,.85,.28],[.6,.55,.4,.16],[-.8,.1,-.5,.3],[.4,-.2,-.9,.24],[.1,.85,-.5,.18]].map(([x,y,z,r])=>({center:new THREE.Vector3(x,y,z).normalize(),radius:r*.72}));

export function createLunarGeometry(radius){
 const geometry=new THREE.SphereGeometry(radius,160,96),relief=geometry.clone(),position=relief.attributes.position,n=new THREE.Vector3();
 for(let i=0;i<position.count;i++){
  n.fromBufferAttribute(position,i).normalize();
  const basin=Math.sin(n.x*5+n.y*2)*Math.cos(n.z*4-n.y*3)+.3*Math.sin(n.y*9+n.z*6);
  let height=-.025*THREE.MathUtils.smoothstep(basin,.15,.65);
  for(const {center,radius:r}of craters){
   const distance=n.distanceTo(center),edge=r*(1+.035*Math.sin(n.x*41+n.y*29+n.z*23));
   const bowl=1-THREE.MathUtils.smoothstep(distance,edge*.55,edge);
   const rim=Math.exp(-(((distance-edge)/(r*.12))**2));
   height+=-.035*bowl+.012*rim;
  }
  position.setXYZ(i,n.x*(radius+height),n.y*(radius+height),n.z*(radius+height));
 }
 relief.computeVertexNormals();geometry.morphAttributes.position=[position.clone()];geometry.morphAttributes.normal=[relief.attributes.normal.clone()];
 relief.dispose();return geometry;
}
