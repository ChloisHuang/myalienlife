import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BiolumeMaterial} from './npr.js';
import {PRAYER_RULES} from './prayer.js';

// One deterministic silhouette; the placement face controls its living light.
const palettes={
 front:{bark:0x839b97,vein:0xa7ead6,tip:0xffdf96,strength:.65,light:2},
 back:{bark:0x354b83,vein:0x65ceff,tip:0xbe8cff,strength:2.4,light:13}
};
const curve=points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));

function taperedTube(path,radius,tip,segments=20,sides=8){
 const geometry=new THREE.TubeGeometry(path,segments,radius,sides,false),positions=geometry.attributes.position;
 const point=new THREE.Vector3(),vertex=new THREE.Vector3();
 for(let i=0;i<=segments;i++){
  path.getPointAt(i/segments,point);
  const scale=THREE.MathUtils.lerp(radius,tip,Math.pow(i/segments,.8))/radius;
  for(let j=0;j<=sides;j++){
   const index=i*(sides+1)+j;
   vertex.fromBufferAttribute(positions,index).sub(point).multiplyScalar(scale).add(point);
   positions.setXYZ(index,vertex.x,vertex.y,vertex.z);
  }
 }
 geometry.computeVertexNormals();return geometry;
}

function join(parts){const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();return geometry;}

export function createSpiritTree(){
 const root=new THREE.Group();root.name='星灵垂光树';
 const wood=[],silk=[],motes=[],phases=[];
 let seed=731;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const trunk=curve([[0,0,0],[-.17,1,.08],[.08,2.1,0],[.4,3.2,-.14],[.26,4.4,0],[.65,5.65,.06]]);
 wood.push(taperedTube(trunk,.53,.018,40,12));
 // Flared buttress roots and a twisting secondary trunk join the same crown.
 for(let i=0;i<9;i++){
  const a=i*Math.PI*2/9,r=.7+random()*.23;
  wood.push(taperedTube(curve([[Math.cos(a)*.18,.95,Math.sin(a)*.18],[Math.cos(a)*.43,.3,Math.sin(a)*.43],[Math.cos(a)*r,.045,Math.sin(a)*r]]),.19,.014,14));
 }
 wood.push(taperedTube(curve([[.26,.1,.13],[.4,1.2,.25],[.12,2.3,.15],[.36,3.35,-.1]]),.28,.06,28));
 for(let i=0;i<10;i++){
  const a=i*2.399,r=2.5+random()*.65,y=2.25+(i%4)*.36;
  const start=trunk.getPoint(y/5.65),end=[Math.cos(a)*r,4.1+random()*1.15,Math.sin(a)*r];
  const branch=curve([start.toArray(),[Math.cos(a)*.9,y+.65,Math.sin(a)*.9],[Math.cos(a)*r*.62,end[1]-.2,Math.sin(a)*r*.62],end]);
  wood.push(taperedTube(branch,.19,.014,24));
  for(let j=0;j<3;j++){
   const origin=branch.getPoint(.45+j*.18),angle=a+(j%2?-.5:.5),length=.65+random()*.55;
   const twig=curve([origin.toArray(),[origin.x+Math.cos(angle)*length*.55,origin.y+.2,origin.z+Math.sin(angle)*length*.55],[origin.x+Math.cos(angle)*length,origin.y+.65+random()*.45,origin.z+Math.sin(angle)*length]]);
   wood.push(taperedTube(twig,.055,.004,12,6));
  }
  // Light curtains hang from the spreading boughs with irregular lengths.
  for(let j=0;j<15;j++){
   const p=branch.getPoint(.36+j*.043),length=.7+random()*Math.min(2.65,p.y-1.1),offset=(random()-.5)*.32;
   p.z+=offset;
   const strand=curve([p.toArray(),[p.x+.07,p.y-length*.4,p.z+.05],[p.x-.05,p.y-length*.8,p.z+.08],[p.x+.03,p.y-length,p.z+.05]]);
   const geometry=taperedTube(strand,.009,.003,12,4);
   geometry.setAttribute('phase',new THREE.Float32BufferAttribute(Array(geometry.attributes.position.count).fill(random()*Math.PI*2),1));
   silk.push(geometry);
   for(let k=0;k<2;k++){const point=strand.getPoint(.4+random()*.6);motes.push(point.x,point.y,point.z);phases.push(random()*Math.PI*2);}
  }
 }
 // Bark uses circumference across U and root-to-tip distance along V.
 for(const geometry of wood){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getY(i),uv.getX(i));}
 const bark=new BiolumeMaterial({emissiveIntensity:3});
 const body=new THREE.Mesh(join(wood),bark);body.castShadow=true;body.receiveShadow=true;root.add(body);
 const uniforms={time:{value:0},strength:{value:1},tint:{value:new THREE.Color()},tip:{value:new THREE.Color()},wind:{value:.2}};
 const strands=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  vertexShader:`uniform float time,wind;attribute float phase;varying vec2 vUv;varying float vPhase;
   void main(){vUv=uv;vPhase=phase;vec3 p=position;
    p.x+=sin(time*.7+phase+uv.x*2.0)*uv.x*uv.x*(.035+wind*.05);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
  fragmentShader:`uniform float time,strength;uniform vec3 tint,tip;varying vec2 vUv;varying float vPhase;
   void main(){float wave=pow(.5+.5*sin(vUv.x*19.0-time*2.1+vPhase),12.0);
    vec3 color=mix(tint,tip,smoothstep(.2,1.0,vUv.x));
    gl_FragColor=vec4(color*strength*(.6+wave*2.0),(.3+wave*.6)*(1.0-smoothstep(.92,1.0,vUv.x)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const curtain=new THREE.Mesh(join(silk),strands);root.add(curtain);
 const motesGeometry=new THREE.BufferGeometry();
 motesGeometry.setAttribute('position',new THREE.Float32BufferAttribute(motes,3));
 motesGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
 const motesMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`uniform float time,wind;attribute float phase;varying float alpha;
   void main(){vec3 p=position;p.x+=sin(time*.7+phase)*(.04+wind*.05);p.y+=sin(time*.4+phase)*.06;
    alpha=.2+.8*pow(.5+.5*sin(time*1.2+phase),4.0);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);gl_PointSize=2.0+alpha*3.0;}`,
  fragmentShader:`uniform vec3 tip;uniform float strength;varying float alpha;
   void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(tip*strength*1.6,exp(-d*d*24.0)*alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const particles=new THREE.Points(motesGeometry,motesMaterial);particles.raycast=()=>{};root.add(particles);
 const light=new THREE.PointLight(0xffffff,1,6,2);light.position.set(0,2,0);root.add(light);
 const eyeUniforms={opening:{value:0},fade:{value:0},time:{value:0},tint:{value:new THREE.Color()},irisTint:{value:new THREE.Color()}};
 const eyeMaterial=new THREE.ShaderMaterial({uniforms:eyeUniforms,transparent:true,depthWrite:false,
  vertexShader:`varying vec2 eyeUv;void main(){eyeUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec2 eyeUv;uniform float opening,fade,time;uniform vec3 tint,irisTint;
   void main(){
    vec2 p=(eyeUv-.5)*2.0;float lid=max(.025,opening*.68);
    float edge=(1.0-p.x*p.x)*lid;float distance=abs(p.y)-edge;
    float ends=1.0-smoothstep(.87,.99,abs(p.x));
    float rim=exp(-pow(distance/.045,2.0))*ends;
    float halo=exp(-abs(distance)*22.0)*ends;
    float inside=(1.0-smoothstep(-.015,.015,distance))*ends;
    vec2 ip=p*vec2(1.0,.618);float radius=length(ip),angle=atan(ip.y,ip.x);
    float iris=(1.0-smoothstep(.33,.38,radius))*inside*opening;
    float fibers=.55+.45*pow(.5+.5*sin(angle*38.0+radius*48.0-time*2.0),3.0);
    float pupil=(1.0-smoothstep(.045,.08,abs(ip.x)))*(1.0-smoothstep(.23,.3,abs(ip.y)));
    float irisRim=exp(-pow((radius-.34)/.025,2.0))*inside*opening;
    vec3 color=vec3(.012,.02,.045)*inside+tint*(rim*3.4+halo*.3);
    color+=irisTint*(iris*fibers*(1.0-pupil)*1.8+irisRim*2.4);
    float alpha=max(inside*.94,max(rim,halo*.4))*fade;if(alpha<.01)discard;
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const eye=new THREE.Mesh(new THREE.PlaneGeometry(3.4,2.1),eyeMaterial);eye.name='祈祷睁眼光纹';eye.visible=false;eye.raycast=()=>{};root.add(eye);
 const eyeRotation=new THREE.Quaternion(),eyeOffset=new THREE.Vector3();
 root.userData.spiritTree={
  eye,
  updateBlessing(action,camera){
   eye.visible=action?.type==='pray'&&action.phase==='celebrating'&&action.elapsed<PRAYER_RULES.celebrationSeconds;
   if(!eye.visible)return;
   const t=action.elapsed,close=1-THREE.MathUtils.smoothstep(t,3.1,PRAYER_RULES.celebrationSeconds),back=action.blessing.side==='back';
   eyeUniforms.opening.value=THREE.MathUtils.smoothstep(t,.12,.85)*close;eyeUniforms.fade.value=THREE.MathUtils.smoothstep(t,0,.16)*close;eyeUniforms.time.value=t;
   eyeUniforms.tint.value.set(back?0xaa83ff:0xffcf70);eyeUniforms.irisTint.value.set(back?0x53ddff:0xb5ffe1);
   // Anchor the sign to the trunk while keeping the opening readable from either island face.
   root.getWorldQuaternion(eyeRotation).invert();camera.getWorldQuaternion(eye.quaternion);eye.quaternion.premultiply(eyeRotation);
   eyeOffset.set(0,0,1.2).applyQuaternion(eye.quaternion);eye.position.set(0,2.75,0).add(eyeOffset);
  },
  update(time,side,daylight,wind,vitality=1){
   const palette=palettes[side],life=.12+.88*vitality,strength=palette.strength*(1+(1-daylight)*.35)*life;
   bark.color.set(palette.bark);bark.emissive.set(palette.vein);bark.bio.time.value=time;bark.bio.strength.value=strength;
   uniforms.time.value=time;uniforms.strength.value=strength;uniforms.tint.value.set(palette.vein);uniforms.tip.value.set(palette.tip);uniforms.wind.value=wind;
   light.color.set(palette.vein);light.intensity=palette.light*(1+(1-daylight)*.3)*life;
  },
  dispose(){for(const geometry of [body.geometry,curtain.geometry,motesGeometry,eye.geometry])geometry.dispose();for(const material of [bark,strands,motesMaterial,eyeMaterial])material.dispose();}
 };
 root.userData.spiritTree.update(0,'front',1,.2);
 return root;
}
