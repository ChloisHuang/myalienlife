import {MathUtils} from 'three';

export function prepareSurroundings(root){
 const materials=new Map();
 root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
  materials.set(m,m.opacity);m.transparent=true;m.depthWrite=false;
 }});
 return materials;
}

export function updateSurroundings(entry,angle,visible){
 const progress=MathUtils.clamp(angle/Math.PI,0,1),back=entry.side==='back';
 const opacity=MathUtils.smoothstep(back?progress:1-progress,0,1);
 entry.root.visible=visible&&opacity>0;
 entry.root.position.y=18*(back?1-progress:-progress);
 for(const [material,base]of entry.materials)material.opacity=base*opacity;
}
