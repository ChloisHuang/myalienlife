import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreamGround,createReverseGround,ISLAND_FACE_OFFSET} from '../src/cream-ground.js';

test('front and reverse ground form one closed island in world coordinates',()=>{
 const edges=new Map(),vertices=[];
 for(const [ground,side]of [[createCreamGround(),1],[createReverseGround(),-1]]){
  const geometry=ground.geometry,positions=geometry.attributes.position,index=geometry.index;
  // Match within Float32 precision after applying the two face transforms.
  const vertexIds=Array.from({length:positions.count},(_,i)=>{
   const point=[positions.getX(i),side*(positions.getY(i)+ISLAND_FACE_OFFSET),side*positions.getZ(i)];
   const existing=vertices.findIndex(v=>v.every((value,axis)=>Math.abs(value-point[axis])<1e-5));
   if(existing>=0)return existing;
   vertices.push(point);return vertices.length-1;
  });
  for(let i=0;i<index.count;i+=3){
   const triangle=[0,1,2].map(j=>vertexIds[index.getX(i+j)]);
   for(let j=0;j<3;j++){
    const edge=[triangle[j],triangle[(j+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);
   }
  }
  geometry.dispose();for(const material of [ground.material].flat())material.dispose();
 }
 for(const [edge,count]of edges)assert.equal(count,2,`Open or overlapping island edge: ${edge}`);
});
