import * as THREE from 'three';
import {StarToonMaterial} from './npr.js';
import {createDarkGroundMaterial} from './dark-ground.js';

export function creamEdgeOffset(angle){return .95*Math.sin(angle*3+.4)+.48*Math.sin(angle*5-1.1)+.12*Math.cos(angle*8);}
export const ISLAND_FACE_OFFSET=1.05;
const creamProfile=[[13.2,0,0],[14.1,-.025,0],[14.85,-.18,.03],[15.18,-.48,.12],[15.32,-.90,.35],[15.30,-1.28,.75],[15.18,-1.53,1],[14.72,-1.65,.95]];
const drips=Array.from({length:11},(_,i)=>({angle:i*Math.PI*2/11+Math.sin(i*2.4)*.11,width:.055+(i%3)*.015,depth:.30+(i%4)*.16}));
function creamHeight(angle,y,amount,outer){
 let drop=0;for(const d of drips){const distance=Math.atan2(Math.sin(angle-d.angle),Math.cos(angle-d.angle));drop+=d.depth*Math.exp(-Math.pow(distance/d.width,4));}
 return -.08+y+(Math.sin(angle*3+.8)*.10+Math.cos(angle*5)*.055)*outer-drop*amount;
}

// Keep the usable center level; the outer shoulder rolls into a thick, uneven skirt.
export function createCreamGround(){
 const segments=256,positions=[0,-.08,0],indices=[];
 const profile=creamProfile;
 for(const [ring,[radius,y,amount]]of profile.entries())for(let j=0;j<segments;j++){
  const angle=j*Math.PI*2/segments;
  const outer=Math.min(1,ring/3),r=radius+creamEdgeOffset(angle)*outer;
  positions.push(Math.cos(angle)*r,creamHeight(angle,y,amount,outer),Math.sin(angle)*r*.72);
 }
 for(let j=0;j<segments;j++){
  const next=(j+1)%segments;indices.push(0,1+next,1+j);
  for(let ring=0;ring<profile.length-1;ring++){
   const a=1+ring*segments+j,b=1+ring*segments+next,c=a+segments,d=b+segments;
   indices.push(a,b,c,b,d,c);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const ground=new THREE.Mesh(geometry,new StarToonMaterial({color:0xb9d7e8,side:THREE.DoubleSide}));
 ground.castShadow=true;ground.receiveShadow=true;return ground;
}

// The reverse face mirrors Z and closes directly against the cream skirt's final ring.
export function createReverseGround(){
 const segments=256,positions=[0,.29,0],indices=[];
 const [seamRadius,seamY,seamDrop]=creamProfile.at(-1);
 const profile=[[13.2,.29,0],[14.4,.29,.6],[15.10,.40,1],[15.32,.62,1],[15.30,.30,1],[seamRadius,0,1]];
 for(const [ring,[radius,y,outer]]of profile.entries())for(let j=0;j<segments;j++){
  const angle=j*Math.PI*2/segments,r=radius+creamEdgeOffset(-angle)*outer;
  const height=ring===profile.length-1?-2*ISLAND_FACE_OFFSET-creamHeight(-angle,seamY,seamDrop,1):y;
  positions.push(Math.cos(angle)*r,height,Math.sin(angle)*r*.72);
 }
 for(let j=0;j<segments;j++)indices.push(0,1+(j+1)%segments,1+j);
 for(let ring=0;ring<profile.length-1;ring++)for(let j=0;j<segments;j++){
  const a=1+ring*segments+j,b=1+ring*segments+(j+1)%segments,c=a+segments,d=b+segments;
  indices.push(a,b,c,b,d,c);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const surfaceCount=segments*(3+3*6);geometry.addGroup(0,surfaceCount,0);geometry.addGroup(surfaceCount,indices.length-surfaceCount,1);
 const ground=new THREE.Mesh(geometry,[createDarkGroundMaterial(),new StarToonMaterial({color:0x34344f})]);
 ground.castShadow=true;ground.receiveShadow=true;return ground;
}
