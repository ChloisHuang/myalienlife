import {DynamicDrawUsage,Group,InstancedMesh,Matrix4} from 'three';

// Trail stems move independently; their opaque parts share geometry and material.
export function instanceTrailGrowth(growth){
 const root=new Group(),groups=new Map(),matrix=new Matrix4();
 growth.updateMatrixWorld(true);
 for(const stem of growth.children){
  const inverse=new Matrix4().copy(stem.matrixWorld).invert(),parts=[];
  stem.traverse(part=>{if(part.isMesh)parts.push(part);});
  for(const part of parts){
   const key=`${part.geometry.id}:${part.material.id}`;
   if(!groups.has(key))groups.set(key,{geometry:part.geometry,material:part.material,parts:[]});
   groups.get(key).parts.push({stem,local:new Matrix4().multiplyMatrices(inverse,part.matrixWorld)});
   part.removeFromParent();
  }
 }
 const batches=[...groups.values()].map(({geometry,material,parts})=>{
  const mesh=new InstancedMesh(geometry,material,parts.length);
  mesh.name='trail-instances';mesh.instanceMatrix.setUsage(DynamicDrawUsage);root.add(mesh);
  return {mesh,parts};
 });
 function update(){
  for(const stem of growth.children)stem.updateMatrix();
  for(const {mesh,parts}of batches){
   parts.forEach(({stem,local},i)=>mesh.setMatrixAt(i,matrix.multiplyMatrices(stem.matrix,local)));
   mesh.instanceMatrix.needsUpdate=true;
   mesh.computeBoundingSphere();
  }
 }
 update();
 return {root,update,dispose(){for(const {mesh}of batches)mesh.dispose();}};
}
