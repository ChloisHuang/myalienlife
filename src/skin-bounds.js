import {Box3,Matrix4,Mesh,Sphere,Vector3} from 'three';

const cache=new WeakMap();
const point=new Vector3(),local=new Vector3(),matrix=new Matrix4(),box=new Box3(),posed=new Box3();

export function updateSkinBounds(mesh){
 const influences=mesh.morphTargetInfluences||[];
 let entry=cache.get(mesh);
 if(!entry||influences.some((value,i)=>value!==entry.influences[i])){
  const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
  const bounds=mesh.skeleton.bones.map(()=>new Box3());
  // Positive normalized skin weights form a convex combination of these bone-local bounds.
  for(let i=0;i<position.count;i++){
   Mesh.prototype.getVertexPosition.call(mesh,i,point).applyMatrix4(mesh.bindMatrix);
   for(let j=0;j<4;j++)if(skinWeight.getComponent(i,j)>0){
    const index=skinIndex.getComponent(i,j);
    bounds[index].expandByPoint(local.copy(point).applyMatrix4(mesh.skeleton.boneInverses[index]));
   }
  }
  entry={bounds,influences:[...influences]};cache.set(mesh,entry);
 }
 posed.makeEmpty();
 for(let i=0;i<entry.bounds.length;i++)if(!entry.bounds[i].isEmpty()){
  matrix.multiplyMatrices(mesh.bindMatrixInverse,mesh.skeleton.bones[i].matrixWorld);
  posed.union(box.copy(entry.bounds[i]).applyMatrix4(matrix));
 }
 mesh.boundingSphere??=new Sphere();
 posed.expandByScalar(1e-5).getBoundingSphere(mesh.boundingSphere);
}
