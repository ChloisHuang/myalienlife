import {InstancedMesh,Matrix4,Mesh} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {StarToonMaterial} from './npr.js';

const owned=new WeakMap();

// Opt-in static subtrees only. Stage and wind roots keep their independent transforms.
export function batchStatic(root,{exclude=new Set()}={}){
 root.updateWorldMatrix(true,true);
 const inverse=new Matrix4().copy(root.matrixWorld).invert(),groups=new Map(),resources=[];
 function visit(node){
  if(exclude.has(node)||!node.visible)return;
  if(node!==root&&(node.userData.windPlant||node.userData.revealAt!==undefined)){
   batchStatic(node,{exclude});return;
  }
  const material=node.material,geometry=node.geometry;
  if(node.isMesh&&!node.isSkinnedMesh&&!node.isInstancedMesh&&!node.children.length&&
   !Object.keys(node.userData).length&&material?.constructor===StarToonMaterial&&
   material.onBeforeCompile===StarToonMaterial.prototype.onBeforeCompile&&!material.transparent&&
   !Object.keys(geometry.morphAttributes).length&&geometry.drawRange.start===0&&geometry.drawRange.count===Infinity){
   const matrix=new Matrix4().multiplyMatrices(inverse,node.matrixWorld);
   if(matrix.determinant()>0){
    const attributes=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>`${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).join('|');
    const key=`${material.id}:${node.castShadow}:${node.receiveShadow}:${node.renderOrder}:${node.layers.mask}:${attributes}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push({node,matrix});
   }
  }
  for(const child of node.children)visit(child);
 }
 visit(root);
 for(const entries of groups.values()){
  if(entries.length<2)continue;
  const source=entries[0].node;let mesh;
  if(entries.every(({node})=>node.geometry===source.geometry)){
   mesh=new InstancedMesh(source.geometry,source.material,entries.length);
   entries.forEach(({matrix},i)=>mesh.setMatrixAt(i,matrix));
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();resources.push(mesh);
  }else{
   const parts=entries.map(({node,matrix})=>(node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone()).applyMatrix4(matrix));
   const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();
   mesh=new Mesh(geometry,source.material);resources.push(geometry);
  }
  mesh.name='static-batch';mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
  mesh.renderOrder=source.renderOrder;mesh.layers.mask=source.layers.mask;
  for(const {node}of entries)node.removeFromParent();root.add(mesh);
 }
 owned.set(root,[...(owned.get(root)||[]),...resources]);
 return root;
}

export function disposeStaticBatches(root){
 root.traverse(node=>{for(const resource of owned.get(node)||[])resource.dispose();owned.delete(node);});
}
