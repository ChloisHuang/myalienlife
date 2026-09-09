// Preview palette and geology study; does not alter saved island blueprints.
import * as THREE from 'three';
import {BIOMES,seededRandom} from './island-generator.js';
import {insideOutline} from './housing-layout.js';

export const SURFACES=Object.entries(BIOMES).map(([id,b])=>({id,...b,original:!b.kind}));

function impactCrater(random,color){
 const segments=40,phase=random()*Math.PI*2,positions=[],colors=[],indices=[];
 const profile=[[0,.305],[.3,.307],[.63,.325],[.87,.47],[1.02,.395],[1.36,.305]];
 for(const [ring,[radius,height]] of profile.entries())for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,irregular=1+.07*Math.sin(a*3+phase)+.035*Math.cos(a*7-phase);
  positions.push(Math.cos(a)*radius*irregular,height+(ring===0||ring===5?0:Math.sin(a*5+phase)*.015),Math.sin(a)*radius*irregular*.86);
  const tint=new THREE.Color(color).multiplyScalar([.86,.88,.95,1.055,1.025,1][ring]);colors.push(tint.r,tint.g,tint.b);
 }
 for(let r=0;r<profile.length-1;r++)for(let i=0;i<segments;i++){const a=r*segments+i,b=r*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function decorateSurface(root,definition,surface,rooms){
 if(surface.original)return;
 const random=seededRandom(definition.seed^0x261854),materials=new Map(),geometries=new Set();
 const own=new THREE.Group();root.add(own);
 own.name='surface-deposits';
 const usable=definition.outline.map(p=>({x:p.x*.91,z:p.z*.91}));
 const mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:surface.kind==='obsidian'?.25:.8,metalness:surface.kind==='plates'?.45:.05}));return materials.get(color);};
 const add=(geo,color,x,y,z)=>{geometries.add(geo);const m=new THREE.Mesh(geo,mat(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;own.add(m);return m;};
 const clear=(x,z,margin=.6)=>!rooms.some(r=>Math.abs(x-r.x)<r.w/2+margin&&Math.abs(z-r.z)<r.d/2+margin)&&definition.layout.every(p=>Math.hypot(p.x-x,p.z-z)>1.7);
 const inside=(x,z)=>insideOutline(usable,x,z);
 const pixels=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,d=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(Math.max(0,1-d)**1.5*180);}
 const texture=new THREE.DataTexture(pixels,32,32);texture.needsUpdate=true;
 const deposit=new THREE.MeshStandardMaterial({color:new THREE.Color(surface.color).lerp(new THREE.Color(surface.accent),.45),map:texture,transparent:true,depthWrite:false,roughness:1});materials.set('deposits',deposit);
 // Broad mineral deposits break up the ground without changing traversable height.
 for(let i=0;i<95;i++){
  const x=(random()-.5)*27,z=(random()-.5)*18;if(!inside(x,z)||!clear(x,z))continue;
  const patch=add(new THREE.CircleGeometry(.5+random()*1.2,24),surface.color,x,.302+i*.0001,z);patch.material=deposit;patch.rotation.x=-Math.PI/2;patch.rotation.z=random()*6.28;patch.scale.y=.4+random()*.6;
 }
 const craterSites=[];
 for(let i=0;i<34;i++){
  const a=random()*Math.PI*2,x=Math.cos(a)*(11.5+random()*2),z=Math.sin(a)*(8.2+random()*1.4);if(!inside(x,z)||!clear(x,z,1.2))continue;
  const h=.55+random()*1.2,color=surface.minerals[i%2],kind=surface.kind;
  if(kind==='strata'||kind==='plates')for(let k=0;k<3;k++){const m=add(new THREE.CylinderGeometry(.75-k*.12,.84-k*.1,.2,kind==='plates'?5:7),k%2?surface.accent:color,x,.4+k*.22,z);m.scale.set(1.4,1,.65);m.rotation.y=a;}
  else if(kind==='cubes')for(let k=0;k<3;k++){const m=add(new THREE.BoxGeometry(.5,.5,.5),k%2?surface.accent:color,x+k*.28,.55+k*.18,z);m.rotation.y=a;}
  else if(kind==='pebbles'){const m=add(new THREE.SphereGeometry(.75,12,8),color,x,.57,z);m.scale.set(1.25,.48,.8);for(let k=0;k<3;k++){const band=add(new THREE.TorusGeometry(.56+k*.07,.025,6,24),surface.accent,x,.6+k*.04,z);band.rotation.x=Math.PI/2;band.scale.y=.72;}}
  else if(kind==='craters'){
   if(craterSites.length>=5||craterSites.some(p=>Math.hypot(p.x-x,p.z-z)<4.5))continue;
   craterSites.push({x,z});const basin=add(impactCrater(random,surface.color),surface.color,x,0,z);basin.name='impact-basin';
   if(!materials.has('basin'))materials.set('basin',new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));basin.material=materials.get('basin');
   const stone=add(new THREE.DodecahedronGeometry(.2),surface.minerals[0],x+.2,.38,z-.15);stone.scale.set(1.5,.5,.8);
  }
  else for(let k=0;k<3;k++){const needle=kind==='needles',m=add(new THREE.CylinderGeometry(0,needle?.10:.3,h*(k===1?1.5:1),needle?5:6),k%2?surface.accent:color,x+(k-1)*.33,.3+h*(k===1?.75:.5),z);m.rotation.z=(k-1)*.19;}
 }
 if(surface.kind==='obsidian')for(let i=0;i<14;i++){
  const x=(random()-.5)*24,z=(random()-.5)*15;if(!clear(x,z))continue;
  const points=[new THREE.Vector3(x,.315,z),new THREE.Vector3(x+.5,.315,z+.3),new THREE.Vector3(x+.8,.315,z-.2)];
  const m=add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),8,.025,5,false),surface.accent,0,0,0);m.material=new THREE.MeshStandardMaterial({color:surface.accent,emissive:0xc7999e,emissiveIntensity:.15});materials.set(`lava-${i}`,m.material);
 }
 // Validate actual transformed vertices, not just the decoration's centre.
 own.updateMatrixWorld(true);const vertex=new THREE.Vector3();let rejected=0;
 for(const m of [...own.children]){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);if(!inside(vertex.x,vertex.z)||!clear(vertex.x,vertex.z,.15)){m.removeFromParent();rejected++;break;}}}
 own.userData.rejected=rejected;own.userData.validated=true;
 return()=>{for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();texture.dispose();own.removeFromParent();};
}
