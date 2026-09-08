// Fixed outdoor decks share their footprint with resident ground placement.
export const GLASS_PLATFORMS=[
 {id:'terrace',x:-2,z:3.1,width:9,depth:2.3,radius:.65,rotation:0,height:.15},
 {id:'research',x:7,z:-3.5,width:7.2,depth:7.2,radius:3.6,rotation:0,height:.19},
 {id:'pond-side',x:2.8,z:6.6,width:4.8,depth:2.8,radius:.8,rotation:-.14,height:.10},
];
export function glassPlatformHeight(x,z){
 for(const p of GLASS_PLATFORMS){
  const c=Math.cos(p.rotation),s=Math.sin(p.rotation),dx=x-p.x,dz=z-p.z;
  const qx=Math.abs(dx*c-dz*s)-(p.width/2-p.radius),qz=Math.abs(dx*s+dz*c)-(p.depth/2-p.radius);
  if(Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)<=p.radius)return p.height;
 }
 return null;
}
