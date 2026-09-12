import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {StarToonMaterial} from './npr.js';
import {batchStatic,disposeStaticBatches} from './static-batching.js';
import {OCEAN_ITEMS,OCEAN_WATER,oceanHeight} from './ocean-definition.js';

const skins=new Set(['pod','food','shower','lab','portal','sofa','music','blueprintTable','constructionTerminal']);
const vertexShader=`varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const causticsGLSL=`
 float oceanCaustic(sampler2D causticsMap,vec2 q){return texture2D(causticsMap,q/vec2(36.,26.)+.5).r;}`;
const causticsPassVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const causticsPassFragment=`precision highp float;varying vec2 vUv;uniform float time;
 #define MOD3 vec3(443.8975,397.2973,491.1871)
 vec3 hash33(vec3 p3){p3=fract(p3*MOD3);p3+=dot(p3,p3.yxz+19.19);return -1.+2.*fract(vec3((p3.x+p3.y)*p3.z,(p3.x+p3.z)*p3.y,(p3.y+p3.z)*p3.x));}
 float perlinNoise(vec3 p){
  vec3 pi=floor(p),pf=p-pi,w=pf*pf*(3.-2.*pf);
  return mix(mix(mix(dot(pf,hash33(pi)),dot(pf-vec3(1,0,0),hash33(pi+vec3(1,0,0))),w.x),mix(dot(pf-vec3(0,0,1),hash33(pi+vec3(0,0,1))),dot(pf-vec3(1,0,1),hash33(pi+vec3(1,0,1))),w.x),w.z),mix(mix(dot(pf-vec3(0,1,0),hash33(pi+vec3(0,1,0))),dot(pf-vec3(1,1,0),hash33(pi+vec3(1,1,0))),w.x),mix(dot(pf-vec3(0,1,1),hash33(pi+vec3(0,1,1))),dot(pf-vec3(1,1,1),hash33(pi+vec3(1,1,1))),w.x),w.z),w.y);
 }
 float waterNoise(vec3 p){return perlinNoise(p*2.);}
 void main(){
  vec2 world=(vUv-.5)*vec2(36.,26.);float bottomY=-5.5;vec3 bottomPoint=vec3(world.x,bottomY,world.y),light=vec3(10.,10.,10.);
  vec3 ray=normalize(bottomPoint-light);float waterHit=(1.-light.y)/min(ray.y,-.03);vec3 waterSurface=light+ray*waterHit;
  vec3 noisePos=waterSurface+vec3(0.,time*1.3,0.);float e=.5;
  float h1=waterNoise(noisePos+vec3(e,0,0)),h2=waterNoise(noisePos-vec3(e,0,0)),h3=waterNoise(noisePos+vec3(0,0,e)),h4=waterNoise(noisePos-vec3(0,0,e));
  float height=waterNoise(noisePos);vec3 waterNormal=normalize(vec3(h2-h1,2.*e,h4-h3));
  vec3 flatRay=refract(ray,vec3(0,1,0),1./1.333),refracted=refract(ray,waterNormal,1./1.333);vec3 deformedSurface=waterSurface+vec3(0,height,0);
  float beforeHit=(bottomY-waterSurface.y)/min(flatRay.y,-.03),afterHit=(bottomY-deformedSurface.y)/min(refracted.y,-.03);
  vec3 beforePos=waterSurface+flatRay*beforeHit,afterPos=deformedSurface+refracted*afterHit;
  float beforeArea=length(dFdx(beforePos.xz))*length(dFdy(beforePos.xz));float afterArea=max(length(dFdx(afterPos.xz))*length(dFdy(afterPos.xz)),1e-5);
  float caustic=clamp(beforeArea/afterArea,.001,6.);gl_FragColor=vec4(vec3(caustic),1.);
 }`;

export function createOceanCaustics(renderer,{size=384,hz=30}={}){
 const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false});
 target.texture.name='ocean-caustics-dynamic';target.texture.colorSpace=THREE.NoColorSpace;target.texture.generateMipmaps=false;
 const material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:causticsPassVertex,fragmentShader:causticsPassFragment,depthTest:false,depthWrite:false});
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),geometry=new THREE.PlaneGeometry(2,2),quad=new THREE.Mesh(geometry,material);scene.add(quad);
 let last=-Infinity;const interval=1/hz;
 return {target,texture:target.texture,material,update(seconds,enabled=true){if(!enabled)return false;if(seconds>=last&&seconds-last<interval)return false;last=seconds;material.uniforms.time.value=seconds;const previous=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(previous);return true;},dispose(){geometry.dispose();material.dispose();target.dispose();}};
}

export function createOceanWater(side,causticsTexture=null){
 const dark=side==='back',spec=OCEAN_WATER[side],root=new THREE.Group();
 const uniforms={time:{value:0},deep:{value:dark?1:0},outline:{value:1},extent:{value:new THREE.Vector2(spec.rx,spec.rz)},causticsMap:{value:causticsTexture}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.FrontSide,vertexShader,
  fragmentShader:`uniform float time;uniform float deep;uniform float outline;uniform vec2 extent;uniform sampler2D causticsMap;varying vec2 p;
  ${causticsGLSL}
  void main(){
   vec2 local=(p*2.-1.)*extent*vec2(1.,-1.);vec2 shape=local/vec2(14.6,10.4);
   float radius=length(shape),angle=atan(shape.y,shape.x);
   float bend=.055*sin(radius*21.)+.028*sin(radius*43.);
   if(outline>.5&&deep<.5&&radius>.60&&!(angle>.78+bend&&angle<1.38+bend))discard;
   float caustic=oceanCaustic(causticsMap,local*vec2(.9,1.05));float energy=min(pow(max(caustic-.12,0.),.8)*.38,1.6);float hot=smoothstep(.16,.95,energy);vec3 causticTint=mix(vec3(.12,.55,.50),vec3(.98,1.,.92),hot);
   vec2 basinPoint=local+vec2(sin(local.y*.42)*.8,cos(local.x*.36)*.55);
   float basin=length(basinPoint/mix(vec2(8.65,6.16),vec2(14.6,10.4),deep));
   float radialDepth=1.-smoothstep(.08,1.02,basin);
   float rearDepth=(1.-smoothstep(-5.2,2.,local.y))*(.3+.7*radialDepth);
   float depth=mix(rearDepth,radialDepth,deep);
   depth=clamp(depth+.06*sin(local.x*.73+local.y*.41),0.,1.);
   vec3 shallows=mix(vec3(.11,.62,.59),vec3(.045,.36,.38),deep);
   vec3 depths=mix(vec3(.006,.26,.31),vec3(.003,.042,.078),deep);
   vec3 base=mix(shallows,depths,smoothstep(.0,1.15,depth));
   float clearChannel=exp(-pow((local.x-1.)/5.,2.)-pow((local.y-2.)/5.5,2.))*(1.-deep);
   base=mix(base,vec3(.24,.78,.72),clearChannel*.75);
   vec3 color=base+causticTint*energy*mix(.48,.30,deep)*(1.-depth*.55);
   float ripple=pow(.5+.5*sin(basin*70.-time*.7+sin(angle*7.)*.5),24.)*smoothstep(.7,1.,basin)*(1.-smoothstep(1.,1.06,basin));
   color+=ripple*vec3(.055,.12,.10);
   gl_FragColor=vec4(color,mix(.12,.42,deep)+depth*mix(.17,.28,deep)+min(energy,.8)*.025);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const surface=new THREE.Mesh(new THREE.CircleGeometry(1,96),material);
 surface.rotation.x=-Math.PI/2;surface.scale.set(spec.rx,spec.rz,1);surface.position.y=spec.y;
 surface.name=`ocean-${side}-water`;surface.renderOrder=4;if(!dark)root.add(surface);
 const falls=new THREE.ShaderMaterial({uniforms,vertexShader,side:THREE.DoubleSide,transparent:true,depthWrite:false,
  fragmentShader:`uniform float time;varying vec2 p;void main(){
   float threads=pow(.5+.5*sin(p.x*57.+sin(p.y*9.-time*1.4)),7.);
   float edge=sin(p.x*3.14159);float flow=.6+.4*sin(p.y*35.+time*3.);
   gl_FragColor=vec4(vec3(.025,.59,.72)+threads*vec3(.38,.40,.28),edge*(.42+threads*.40)*(.85+.15*flow));
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const geometries=[],poolMaterial=dark?null:material.clone();
 if(poolMaterial){
  poolMaterial.uniforms.time=uniforms.time;poolMaterial.uniforms.outline.value=0;
  for(const [x,z,r,y]of [[10,4,1.13,2.04],[8.9,3.2,.63,2.36],[10.35,2.6,.48,2.74],[-8.3,0,1.25,1.56],[-8.3,0,.49,2.46]]){
   const geometry=new THREE.CircleGeometry(r,32);geometries.push(geometry);
   const pool=new THREE.Mesh(geometry,poolMaterial);pool.rotation.x=-Math.PI/2;pool.position.set(x,y,z);pool.renderOrder=4;pool.userData.revealAt=x<0?.6:.8;root.add(pool);
  }
  for(const [x,z,y]of [[10.35,3.05,2.5],[9.15,3.7,2.2]]){
   const geometry=new THREE.PlaneGeometry(.24,.5);geometries.push(geometry);
   const cascade=new THREE.Mesh(geometry,falls);cascade.position.set(x,y,z);cascade.userData.revealAt=.8;root.add(cascade);
  }
  for(const [x,z,y,w,h]of [[-8.3,1.43,1.02,.5,1.1],[-8.3,0,2.75,.075,.6]]){
   const geometry=new THREE.PlaneGeometry(w,h);geometries.push(geometry);
   const cascade=new THREE.Mesh(geometry,falls);cascade.position.set(x,y,z);cascade.userData.revealAt=.6;root.add(cascade);
  }
 }
 return {root,surface,time:uniforms.time,update(t){uniforms.time.value=t;},dispose(){surface.geometry.dispose();for(const g of geometries)g.dispose();material.dispose();poolMaterial?.dispose();falls.dispose();}};
}

function createSeaLife(){
 const root=new THREE.Group(),dummy=new THREE.Object3D();
 const body=new THREE.SphereGeometry(1,8,6);body.scale(.23,.08,.075);
 const tail=new THREE.ConeGeometry(.11,.18,3);tail.rotateZ(Math.PI/2);tail.translate(-.26,0,0);
 const geometry=mergeGeometries([body,tail]);body.dispose();tail.dispose();
 const fish=new THREE.InstancedMesh(geometry,new StarToonMaterial({color:0xa7dad0,emissive:0x4c949a,emissiveIntensity:.3}),36);
 fish.name='ocean-midwater-fish';fish.frustumCulled=false;root.add(fish);
 const positions=new Float32Array(80*3);
 for(let i=0;i<80;i++){positions[i*3]=i<18?10+Math.sin(i*12.97)*.55:Math.sin(i*12.97)*19;positions[i*3+1]=.5+(i%19)*.48;positions[i*3+2]=i<18?4+Math.cos(i*7.37)*.5:Math.cos(i*7.37)*14;}
 const particles=new THREE.BufferGeometry();particles.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const mist=new THREE.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,
  vertexShader:`uniform float time;varying float fade;void main(){vec3 p=position;p.y=.4+mod(p.y+time*.45,10.);p.x+=sin(time*.5+p.z)*.24;fade=smoothstep(.4,1.4,p.y)*(1.-smoothstep(8.,10.4,p.y));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=(5.+mod(abs(position.x)*13.,9.))*clamp(projectionMatrix[1][1]*12.,.6,2.);}`,
  fragmentShader:`varying float fade;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.48)discard;float rim=exp(-pow((d-.39)*36.,2.));float glint=exp(-dot(p-vec2(-.16,-.2),p-vec2(-.16,-.2))*190.);gl_FragColor=vec4(.65,.94,1.,(rim*.28+glint*.65)*fade);}`});
 const bubbles=new THREE.Points(particles,mist);bubbles.name='ocean-rising-bubbles';bubbles.frustumCulled=false;root.add(bubbles);
 const bell=new THREE.SphereGeometry(.43,16,10,0,Math.PI*2,0,Math.PI*.58);bell.scale(1,.65,1);
 const lip=new THREE.TorusGeometry(.415,.035,6,24);lip.rotateX(Math.PI/2);lip.translate(0,-.065,0);
 const jellyBell=mergeGeometries([bell,lip]);bell.dispose();lip.dispose();
 const strands=[];
 for(let j=0;j<6;j++){
  const a=j*Math.PI/3,points=[];
  for(let k=0;k<9;k++){const t=k/8;points.push(new THREE.Vector3(Math.cos(a)*(.24+t*.09)+Math.sin(t*5+j)*.08,-.08-t*(.8+j%3*.22),Math.sin(a)*(.24+t*.09)));}
  strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),14,.014,4,false));
 }
 const jellyStrands=mergeGeometries(strands);for(const g of strands)g.dispose();
 const jellyMaterial=new StarToonMaterial({color:0xb9b8e8,emissive:0x8e9bdc,emissiveIntensity:.85,side:THREE.DoubleSide});
 const strandMaterial=new StarToonMaterial({color:0xb9eeeb,emissive:0x62d7e5,emissiveIntensity:.7});
 const jellyfish=[];
 for(const [x,y,z]of [[-11,3.5,5],[11,4.8,3],[-4,5.5,-7],[8,6,0],[2.8,3.8,4.5]]){
  const jelly=new THREE.Group();jelly.name='ocean-glowing-jellyfish';jelly.position.set(x,y,z);jelly.userData.baseY=y;
  jelly.add(new THREE.Mesh(jellyBell,jellyMaterial),new THREE.Mesh(jellyStrands,strandMaterial));root.add(jelly);jellyfish.push(jelly);
 }
 return {root,setExposure(value){root.visible=value>.01;},update(t){
  mist.uniforms.time.value=t;
  for(const [i,jelly]of jellyfish.entries()){
   const pulse=Math.sin(t*1.6+i*1.7);jelly.position.y=jelly.userData.baseY+Math.sin(t*.45+i)*.3;
   jelly.children[0].scale.set(1+pulse*.07,1-pulse*.1,1+pulse*.07);jelly.children[1].rotation.y=Math.sin(t*.6+i)*.12;
  }
  for(let i=0;i<36;i++){
   const school=Math.floor(i/12),angle=t*(.055+school*.009)+i*.11,r=3.3+school*2.3+(i%4)*.22;
   dummy.position.set(Math.cos(angle)*r,2.7+school*1.55+(i%5)*.22+Math.sin(t*.4+i)*.18,Math.sin(angle)*r*.64);
   dummy.rotation.set(0,-angle+Math.PI/2,Math.sin(t*2+i)*.04);dummy.updateMatrix();fish.setMatrixAt(i,dummy.matrix);
  }
  fish.instanceMatrix.needsUpdate=true;
 },dispose(){geometry.dispose();fish.material.dispose();fish.dispose();particles.dispose();mist.dispose();jellyBell.dispose();jellyStrands.dispose();jellyMaterial.dispose();strandMaterial.dispose();}};
}

export function createOceanKit(asset,groundTexture,causticsTexture=null){
 if(!groundTexture?.isTexture)throw new Error('Ocean ground texture is required');
 groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;groundTexture.anisotropy=4;
 function model(name){
  const source=asset.getObjectByName(name);if(!source)throw new Error(`Ocean asset missing: ${name}`);
  const root=new THREE.Group(),copy=source.clone(true),shared=new Map();root.add(copy);
  function convert(m){if(!shared.has(m))shared.set(m,new StarToonMaterial({name:m.name,color:m.color,emissive:m.emissive,emissiveIntensity:m.emissiveIntensity,vertexColors:m.vertexColors,side:THREE.DoubleSide}));return shared.get(m);}
  copy.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);o.castShadow=o.receiveShadow=true;}});
  return root;
 }
 return {
  prop(type,island,batching=true){
   const name=OCEAN_ITEMS.some(i=>i.id===type)?type:island==='ocean'&&skins.has(type)?`ocean-${type}`:null;
   if(!name)return null;
   const root=model(name);if(batching)batchStatic(root);
   if(type==='oceanPearlLamp'){const light=new THREE.PointLight(0xbce9df,3,3,2);light.position.y=1;root.add(light);}
   return root;
  },
  terrain(side){
   const root=model(`ocean-${side}`),stages=[];
   root.name=`ocean-${side}`;root.traverse(o=>{if(typeof o.userData.revealAt==='number')stages.push(o);});
   batchStatic(root);
   if(side==='back'){
    root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
     if(m.name==='ocean warm glass'){m.emissive.set(0xffd79a);m.emissiveIntensity=1.4;}
     if(m.name==='ocean cold pearl')m.emissiveIntensity=1.3;
     if(m.name==='treasure'){m.emissive.set(0xffad28);m.emissiveIntensity=1.6;}
    }});
    for(const [x,y,z,color,power,stage]of [[7,2.5,-5.1,0xa8eeed,7,1],[-8,1.5,.3,0xffd49a,4,.4],[10,2.5,4,0x73ece8,5,.8]]){
     const light=new THREE.PointLight(color,power,5,2);light.position.set(x,y,z);light.userData.revealAt=stage;root.add(light);stages.push(light);
    }
   }
   if(side==='front'){
    const lighthouse=stages.find(o=>o.userData.revealAt===1);
    lighthouse?.traverse(o=>{if(o.isMesh){
     const illuminate=m=>{
      if(m.name!=='ocean warm glass')return m;
      const glow=m.clone(),base=glow.onBeforeCompile.bind(glow);glow.emissive.set(0xffb768);glow.emissiveIntensity=2.3;
      glow.onBeforeCompile=shader=>{base(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
       float pearlFacing=max(dot(normal,normalize(vViewPosition)),0.);
       totalEmissiveRadiance=mix(vec3(1.,.16,.025),vec3(1.,.68,.30),pow(pearlFacing,.75))*2.3;
      `);};glow.customProgramCacheKey=()=> 'ocean-amber-pearl-v1';return glow;
     };
     o.material=Array.isArray(o.material)?o.material.map(illuminate):illuminate(o.material);
    }});
    const light=new THREE.PointLight(0xffa45b,8,5,2);light.name='ocean-lighthouse-beacon';
    light.position.set(7,oceanHeight(7,-7)-.29+6.05,-6.08);light.userData.revealAt=1;root.add(light);stages.push(light);
   }
   const water=createOceanWater(side,causticsTexture),life=side==='back'?createSeaLife():null,submerged=new Set();
   const stone=new Set(),plants=new Set();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(m.name==='sand'){
     const p=o.geometry.getAttribute('position'),uv=new Float32Array(p.count*2);
     for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)/7;uv[i*2+1]=p.getZ(i)/7;}
     o.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));m.map=groundTexture;m.color.set(0xffffff);m.needsUpdate=true;
    }else if(['lagoonBed','submergedStone'].includes(m.name)||side==='back'&&m.name==='floor')submerged.add(m);
    else if(['deepKelp','deepCoral'].includes(m.name))plants.add(m);
    else if(['ivory','stone','slate','reef'].includes(m.name))stone.add(m);
   }});
   for(const m of stone)weatheredSurface(m);
   for(const m of submerged)submergedSurface(m,water.time,causticsTexture);
   for(const m of plants){
    const base=m.onBeforeCompile.bind(m),amplitude=m.name==='deepKelp'?.11:.035;
    m.onBeforeCompile=shader=>{base(shader);shader.uniforms.currentTime=water.time;shader.vertexShader='uniform float currentTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed.x+=sin(currentTime*.6+position.y*1.6+position.x*.7)*${amplitude}*max(0.,position.y-.25);`);};
    m.customProgramCacheKey=()=>`ocean-current-${amplitude}`;
   }
   root.add(water.root);water.root.traverse(o=>{if(typeof o.userData.revealAt==='number')stages.push(o);});if(life)root.add(life.root);
   return {root,lodTargets:[],setProgress(p){for(const s of stages)s.visible=p>=s.userData.revealAt;},
    update(seconds,wind,night,exposure=1){water.update(seconds);life?.setExposure(exposure);life?.update(seconds);},
    dispose(){water.root.removeFromParent();life?.root.removeFromParent();water.dispose();life?.dispose();disposeStaticBatches(root);const materials=new Set();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const m of materials)m.dispose();root.removeFromParent();}
   };
  }
 };
}

function submergedSurface(material,time,causticsTexture){
 const base=material.onBeforeCompile.bind(material),bed=material.name==='lagoonBed',abyss=material.name==='floor';
 material.onBeforeCompile=shader=>{
  base(shader);shader.uniforms.causticsMap={value:causticsTexture};
  shader.vertexShader='varying vec3 seabedPoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nseabedPoint=position;');
  shader.fragmentShader=`varying vec3 seabedPoint;uniform sampler2D causticsMap;${causticsGLSL}\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 q=seabedPoint.xz;
   ${abyss?`float wreckShade=exp(-pow((q.x+8.)/3.8,2.)-pow((q.y+7.)/3.,2.));
   float sediment=.5+.5*sin(q.x*.48+sin(q.y*.61))*cos(q.y*.57);
   diffuseColor.rgb=mix(mix(vec3(.018,.105,.14),vec3(.035,.23,.25),sediment),vec3(.004,.024,.045),wreckShade*.9);`:''}
   ${bed?`float sandbar=.5+.5*sin(q.x*.57+sin(q.y*.43)*1.8)*cos(q.y*.67-q.x*.21);
   float channel=exp(-pow((q.x-.5)/5.,2.)-pow((q.y-2.)/5.,2.));
   vec3 bedColor=mix(vec3(.035,.21,.23),vec3(.14,.41,.35),sandbar);
   diffuseColor.rgb=mix(bedColor,vec3(.12,.65,.57),smoothstep(.12,.85,channel)*(.85+.15*sandbar));`:''}
   float oceanFocus=oceanCaustic(causticsMap,q*vec2(.9,1.05));float oceanEnergy=min(pow(max(oceanFocus-.12,0.),.8)*.38,1.6);float oceanHot=smoothstep(.16,.95,oceanEnergy);vec3 oceanTint=mix(vec3(.10,.52,.48),vec3(.98,1.,.90),oceanHot);diffuseColor.rgb+=oceanTint*oceanEnergy*${abyss?'.32':'.52'};
  `);
 };material.customProgramCacheKey=()=>`ocean-submerged-caustics-v2-${bed}-${abyss}`;
}

function weatheredSurface(material){
 const base=material.onBeforeCompile.bind(material);
 material.onBeforeCompile=shader=>{
  base(shader);
  shader.vertexShader='varying vec3 shorePoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshorePoint=position;');
  shader.fragmentShader='varying vec3 shorePoint;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float grain=fract(sin(dot(floor(shorePoint*63.),vec3(12.9898,78.233,37.713)))*43758.5453);
   float mottling=sin(shorePoint.x*1.7+sin(shorePoint.z*2.))*cos(shorePoint.z*1.3+shorePoint.y*2.);
   diffuseColor.rgb*=.965+.035*grain+.035*mottling;
   diffuseColor.rgb*=1.-.13*step(.985,grain);
  `);
 };
 material.customProgramCacheKey=()=> 'ocean-weathered-stone-v3';
}

export function createOceanFragments(sources){
 const geometry=new THREE.IcosahedronGeometry(1,1),position=geometry.getAttribute('position'),colors=[];
 const pearl=new THREE.Color(0xd3ded1),reef=new THREE.Color(0x709a98);
 for(let i=0;i<position.count;i++){const c=position.getY(i)>.1?pearl:reef;colors.push(c.r,c.g,c.b);}
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const material=new StarToonMaterial({vertexColors:true}),root=new THREE.InstancedMesh(geometry,material,sources.length*3),dummy=new THREE.Object3D();
 root.name='ocean-peripheral-reef';root.frustumCulled=false;
 return {root,update(enabled){
  root.visible=enabled;if(!enabled)return;
  for(let i=0;i<sources.length;i++)for(let j=0;j<3;j++){
   const source=sources[i];dummy.position.copy(source.position);dummy.position.x+=j*.48;dummy.position.z+=Math.sin(i+j)*.3;
   dummy.quaternion.copy(source.quaternion);const s=source.geometry.parameters.radius*(.33-j*.055);
   dummy.scale.set(s*1.1,s*.65,s*.9);dummy.updateMatrix();root.setMatrixAt(i*3+j,dummy.matrix);
  }
  root.instanceMatrix.needsUpdate=true;
 }};
}
