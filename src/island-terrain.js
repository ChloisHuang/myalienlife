import * as THREE from 'three';
import {StarToonMaterial,BiolumeMaterial} from './npr.js';
import {seededRandom} from './island-generator.js';
import {BIOMES} from './planet-biomes.js';
import {decorateSurface} from './planet-surfaces.js';
import {housingLayout} from './housing-layout.js';

// Visual detail is derived from the saved blueprint; it never moves buildings or residents.
export function createIslandTerrain(definition,mushroom,side='front'){
 if(definition.level===0)throw new Error('主星球只使用原有固定场景');
 const seed=definition.seed===undefined?definition.level*104729:definition.seed^Math.imul(definition.index+1,2654435761);
 const random=seededRandom(seed^(side==='back'?0x726d13:0x139a7)),root=new THREE.Group(),geometries=new Set(),materials=new Set(),plants=[],floaters=[],ripples=[],living=[];
 root.name=`remote-${definition.name}-${side}`;
 const theme=definition.biome??(definition.level===1?'fungal':'ruins'),dark=side==='back';
 const color=new THREE.Color(definition.color).lerp(new THREE.Color(dark?0x504369:0xd8e4c9),dark?.55:.35),accent=new THREE.Color(dark?0xa69be8:definition.accent??0xe5b6d0);
 const mat=(color,glow=0)=>{const m=new StarToonMaterial({color,emissive:color,emissiveIntensity:glow});materials.add(m);return m;};
 const ground=mat(color),edge=mat(color.clone().multiplyScalar(.72)),stone=mat(color.clone().lerp(new THREE.Color(0xe4d5c1),.55)),glow=mat(accent,.25);
 const own=geometry=>{geometries.add(geometry);return geometry;};
 function add(geometry,material,x,y,z,parent=root){const mesh=new THREE.Mesh(own(geometry),material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 const savedOutline=definition.outline??Array.from({length:48},(_,i)=>{const a=i*Math.PI/24,r=1+.045*Math.sin(a*3+seed)+.02*Math.cos(a*5);return{x:Math.cos(a)*14.5*r,z:Math.sin(a)*10.2*r};});
 const outline=dark?savedOutline.map(p=>({x:p.x,z:-p.z})).reverse():savedOutline;
 const border=new THREE.CatmullRomCurve3(outline.map(p=>new THREE.Vector3(p.x,0,p.z)),true,'catmullrom',.3).getPoints(160).slice(0,-1);
 // Flat play space rolls into an irregular rounded shoulder instead of an extruded cylinder.
 const profile=[[.92,.29],[.975,.25],[1,.06],[1.008,-.24],[.997,-.72],[.968,-1.35],[.91,-1.75]],positions=[0,.29,0],indices=[];
 for(let r=0;r<profile.length;r++)for(let i=0;i<border.length;i++){const p=border[i],a=i/border.length*Math.PI*2,[scale,y]=profile[r],wave=r<2?0:Math.sin(a*5+seed)*.10+Math.cos(a*9)*.055;positions.push(p.x*scale,y+wave,p.z*scale);}
 for(let i=0;i<border.length;i++){const j=(i+1)%border.length;indices.push(0,1+j,1+i);for(let r=0;r<profile.length-1;r++){const a=1+r*border.length+i,b=1+r*border.length+j;indices.push(a,b,a+border.length,b,b+border.length,a+border.length);}}
 const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shell.setIndex(indices);shell.computeVertexNormals();add(shell,ground,0,0,0).name='rounded-island-shell';
 const inside=(x,z)=>{let yes=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;};
 const layout=definition.layout??[{x:0,z:0},{x:-5,z:-3},{x:-2,z:-3},{x:2,z:-3},{x:5,z:-3},{x:5,z:2}];
 const clear=(x,z,r=2)=>inside(x,z)&&layout.every(o=>Math.hypot(o.x-x,o.z-z)>r)&&Math.hypot(x,z-2)>2;
 const flatten=(mesh,x,z)=>{mesh.rotation.x=-Math.PI/2;mesh.scale.set(x,z,1);return mesh;};
 const patches=[mat(color.clone().lerp(new THREE.Color(0x799f9b),.24)),mat(color.clone().lerp(accent,.18)),mat(color.clone().lerp(new THREE.Color(0xf3e0b6),.22))];
 for(let i=0;i<38;i++){const x=(random()-.5)*24,z=(random()-.5)*16;if(!clear(x,z,1.5))continue;const patch=flatten(add(new THREE.CircleGeometry(1,22),patches[i%3],x,.299+i*.0001,z),.45+random()*1.7,.3+random()*.8);patch.rotation.z=random()*6;}
 // Small inlaid stones lead out of the landing area, leaving the surface walkable.
 for(const o of layout.slice(1)){const end=new THREE.Vector3(o.x,.31,o.z+1.7),start=new THREE.Vector3(0,.31,2),mid=start.clone().lerp(end,.5);mid.x+=(random()-.5)*2;const path=new THREE.QuadraticBezierCurve3(start,mid,end);
  for(let i=1;i<7;i++){const p=path.getPoint(i/7);const tile=add(new THREE.CylinderGeometry(.25+random()*.1,.3,.035,7),stone,p.x,p.y,p.z);tile.scale.z=.65;tile.rotation.y=random()*6;}
 }
 // Shallow luminous tide pools sit away from buildings and paths.
 for(const sign of [-1,1]){
  const x=sign*(8+random()),z=sign*(5.5+random());if(!clear(x,z,2.3))continue;
  flatten(add(new THREE.CircleGeometry(1,40),stone,x,.302,z),1.65,1.08);
  const water=mat(dark?0x536f9a:0x8acac6,.12);flatten(add(new THREE.CircleGeometry(1,40),water,x,.309,z),1.5,.92);
  for(let i=0;i<3;i++){const m=new THREE.MeshBasicMaterial({color:dark?0xb0a2ef:0xd4fff0,transparent:true,opacity:.35,depthWrite:false});materials.add(m);const ring=add(new THREE.RingGeometry(.96,1,40),m,x,.316+i*.001,z);ring.rotation.x=-Math.PI/2;ripples.push({mesh:ring,phase:i/3});}
  for(let i=0;i<5;i++){const a=random()*6.28,rock=add(new THREE.IcosahedronGeometry(.16+random()*.2,1),stone,x+Math.cos(a)*1.65,.4,z+Math.sin(a)*1.04);rock.scale.y=.6;}
 }
 const palette=Array.from({length:3},(_,i)=>new THREE.Color([accent.getHex(),dark?0x8394cc:0xcbdba5,dark?0xb79cdb:0xe5c2b5][i]));
 const mushroomMaterials=palette.map(tint=>{const map=new Map();mushroom.traverse(n=>{if(!n.isMesh)return;for(const original of Array.isArray(n.material)?n.material:[n.material])if(!map.has(original)){const m=original instanceof BiolumeMaterial?new BiolumeMaterial({color:original.color,map:original.map,emissive:original.emissive,emissiveIntensity:original.emissiveIntensity}):original.clone();m.color.lerp(tint,original.name==='Nebula mushroom'?.5:.14);materials.add(m);if(m.bio)living.push(m);map.set(original,m);}});return map;});
 const anchors=definition.decor??Array.from({length:19},()=>{const a=random()*6.28,r=.79+random()*.13;return{x:Math.cos(a)*14*r,z:Math.sin(a)*9.8*r,size:.6+random()*.7,rotation:random()*6.28};});
 function plant(x,z,size,rotation,index){
  if(!inside(x,z))return;
  const group=new THREE.Group();group.position.set(x,.29,z);group.rotation.y=rotation;root.add(group);
  if(theme==='fungal'){
   const model=mushroom.clone(true),map=mushroomMaterials[index%3];model.traverse(n=>{if(n.isMesh)n.material=Array.isArray(n.material)?n.material.map(m=>map.get(m)):map.get(n.material);});model.scale.set(size*.95,size*(.85+random()*.35),size*.95);group.add(model);
  }else if(theme==='crystalline'){
   for(let i=0;i<3;i++){const crystal=add(new THREE.CylinderGeometry(0,.27,.9,5),i===0?glow:stone,(i-1)*.35,.55,Math.sin(i*3)*.2,group);crystal.scale.setScalar(size*(i===0?1.8:1));crystal.rotation.z=(i-1)*.2;}
  }else if(theme==='choral'){
   for(let i=0;i<3;i++){const h=size*(.8+random()*1.4),curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3((i-1)*.25,0,0),new THREE.Vector3((i-1)*.6,h*.7,.1),new THREE.Vector3((i-1)*.5,h,.1));add(new THREE.TubeGeometry(curve,8,.045,5,false),edge,0,0,0,group);const flower=add(new THREE.TorusGeometry(.24+size*.15,.055,8,24),glow,(i-1)*.5,h,.1,group);flower.rotation.y=i*.8;}
  }else{
   const h=size*(.8+random());const column=add(new THREE.CylinderGeometry(.23,.33,h,6),stone,0,h/2,0,group);column.rotation.z=(random()-.5)*.22;const cap=add(new THREE.BoxGeometry(.65,.12,.55),glow,0,h+.02,0,group);cap.rotation.y=.3;
   if(index%3===0){add(new THREE.CylinderGeometry(.22,.3,h,6),stone,1,h/2,0,group);add(new THREE.BoxGeometry(1.5,.22,.5),stone,.5,h+.14,0,group);}
  }
  plants.push({group,phase:random()*6.28,amount:theme==='fungal'?.018:theme==='choral'?.045:0});
 }
 for(const [i,anchor] of anchors.entries()){const p=dark&&definition.decor?{...anchor,z:-anchor.z}:anchor;plant(p.x,p.z,p.size*(.9+random()*.4),p.rotation,i);if(i%3!==0){const a=random()*6.28;plant(p.x+Math.cos(a)*.85,p.z+Math.sin(a)*.65,p.size*.4,p.rotation+1,i+1);}}
 // Instancing keeps the small ground life inexpensive on both faces.
 const spots=[];for(let i=0;i<420&&spots.length<110;i++){const x=(random()-.5)*27,z=(random()-.5)*18;if(clear(x,z,2.1)&&Math.abs(Math.sin(x*.38)+Math.cos(z*.57))>.65)spots.push({x,z,size:.08+random()*.15});}
 const budGeometry=own(new THREE.SphereGeometry(1,7,5)),stemGeometry=own(new THREE.ConeGeometry(.08,.48,5)),matrix=new THREE.Object3D();
 for(let c=0;c<3;c++){const subset=spots.filter((_,i)=>i%3===c),buds=new THREE.InstancedMesh(budGeometry,mat(palette[c],dark?.22:.06),subset.length),stems=new THREE.InstancedMesh(stemGeometry,edge,subset.length);root.add(buds,stems);for(const [i,p]of subset.entries()){matrix.position.set(p.x,.29+p.size*2.5,p.z);matrix.rotation.set(0,0,0);matrix.scale.set(p.size,p.size*.8,p.size);matrix.updateMatrix();buds.setMatrixAt(i,matrix.matrix);matrix.position.y=.29+p.size;matrix.scale.setScalar(p.size*5);matrix.updateMatrix();stems.setMatrixAt(i,matrix.matrix);}buds.castShadow=true;}
 for(let i=0;i<9;i++){const a=random()*6.28,p=border[Math.floor(random()*border.length)],rock=add(new THREE.IcosahedronGeometry(.3+random()*.45,1),i%3?edge:glow,p.x*1.075,-.65-random()*.8,p.z*1.075);rock.scale.set(1.3,.6,1);floaters.push({mesh:rock,y:rock.position.y,phase:a});}
 const seeds=Array.from({length:80},()=>({x:(random()-.5)*26,z:(random()-.5)*17,y:.4+random()*3,phase:random()*6.28})).filter(p=>inside(p.x,p.z));
 const dustGeometry=own(new THREE.BufferGeometry());dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(seeds.flatMap(p=>[p.x,p.y,p.z]),3));
 const dustMaterial=new THREE.PointsMaterial({color:dark?0xcebcff:0xc9ffe0,size:.06,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending});materials.add(dustMaterial);const dust=new THREE.Points(dustGeometry,dustMaterial);dust.name='drifting-spores';root.add(dust);
 let disposeSurface;
 if(!dark&&BIOMES[theme]?.kind){
  for(const child of root.children)if(child.name!=='rounded-island-shell')child.visible=false;
  ground.color.set(BIOMES[theme].color);
  disposeSurface=decorateSurface(root,definition,{id:theme,...BIOMES[theme]},housingLayout(definition.seed^definition.index).rooms);
 }
 return {root,clearConstruction(rooms){
  const within=(x,z)=>rooms.some(r=>Math.abs(x-r.x)<r.w/2+.2&&Math.abs(z-r.z)<r.d/2+.2);
  root.updateMatrixWorld(true);
  for(const child of root.children){
   if(child.isGroup&&child.name!=='surface-deposits'){const b=new THREE.Box3().setFromObject(child);if(rooms.some(r=>b.min.x<r.x+r.w/2&&b.max.x>r.x-r.w/2&&b.min.z<r.z+r.d/2&&b.max.z>r.z-r.d/2))child.visible=false;}
   if(child.isInstancedMesh){const matrix=new THREE.Matrix4(),p=new THREE.Vector3();for(let i=0;i<child.count;i++){child.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);if(within(p.x,p.z)){matrix.makeScale(0,0,0);child.setMatrixAt(i,matrix);}}child.instanceMatrix.needsUpdate=true;}
  }
 },update(seconds,wind=0,night=0){
  for(const p of plants)p.group.rotation.z=Math.sin(seconds*.65+p.phase)*p.amount*(1+wind*.2);
  for(const f of floaters){f.mesh.position.y=f.y+Math.sin(seconds*.35+f.phase)*.15;f.mesh.rotation.y=seconds*.025+f.phase;}
  for(const r of ripples){const t=(seconds*.11+r.phase)%1;r.mesh.scale.set(.2+t*1.25,.12+t*.75,1);r.mesh.material.opacity=(1-t)*.35;}
  for(const m of living){m.bio.time.value=seconds;m.bio.strength.value=.35+night*.95;}
  const pos=dustGeometry.attributes.position;for(let i=0;i<seeds.length;i++){const p=seeds[i];pos.setXYZ(i,p.x+Math.sin(seconds*.23+p.phase)*.25,p.y+Math.sin(seconds*.4+p.phase)*.24,p.z+Math.cos(seconds*.18+p.phase)*.18);}pos.needsUpdate=true;dustMaterial.opacity=.25+night*.35;
 },dispose(){disposeSurface?.();root.removeFromParent();root.traverse(n=>{if(n.isInstancedMesh)n.dispose();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
