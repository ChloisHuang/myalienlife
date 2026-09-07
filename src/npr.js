import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// A shared four-band ramp keeps procedural props and Blender assets in one style.
const ramp=new THREE.DataTexture(new Uint8Array([55,118,190,255]),4,1,THREE.RedFormat);
ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
export class StarToonMaterial extends THREE.MeshToonMaterial{
 constructor(parameters={}){super({gradientMap:ramp,...parameters});}
 onBeforeCompile(shader){
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float edge = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 3.5);
   outgoingLight += vec3(0.18, 0.14, 0.20) * edge;
   #include <opaque_fragment>`);
 }
 customProgramCacheKey(){return 'star-toon-v1';}
}
export class BiolumeMaterial extends StarToonMaterial{
 constructor(parameters={}){super(parameters);this.bio={time:{value:0},strength:{value:.2}};}
 onBeforeCompile(shader){
  super.onBeforeCompile(shader);shader.uniforms.bioTime=this.bio.time;shader.uniforms.bioStrength=this.bio.strength;
  shader.vertexShader='varying vec2 bioUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbioUv=uv;');
  shader.fragmentShader='uniform float bioTime,bioStrength;varying vec2 bioUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
   #include <emissivemap_fragment>
   float branches=sin(bioUv.x*113.1+sin(bioUv.y*23.0)*.65);
   float veins=pow(.5+.5*branches,24.0);
   float tissue=1.0-smoothstep(.28,.72,bioUv.y);
   // A narrow wave travels along the tissue, with staggered branches and a fading wake.
   float branch=floor(bioUv.x*18.0);
   float cycle=fract(bioTime*.23-bioUv.y*.78-sin(branch*2.399)*.075);
   float front=exp(-pow((cycle-.13)*15.0,2.0));
   float wake=smoothstep(.13,.20,cycle)*exp(-max(0.0,cycle-.20)*9.0);
   float pulse=front*.85+wake*.35;
   totalEmissiveRadiance*=bioStrength*(.025+tissue*(.035+veins*(.06+pulse*1.1)));`);
 }
 customProgramCacheKey(){return 'living-tissue-v1';}
}
export function stylizeAsset(source,{soft=false}={}){
 const converted=new Map();
 source.traverse(node=>{if(!node.isMesh)return;
  const original=node.material;
  const Material=soft?THREE.MeshStandardMaterial:['Nebula mushroom','Luminous gills','Pearl stem'].includes(original.name)?BiolumeMaterial:StarToonMaterial;
  if(!converted.has(original))converted.set(original,new Material({
   name:original.name,color:original.color,map:original.map,
   emissive:Material===BiolumeMaterial?new THREE.Color(original.name==='Nebula mushroom'?0xdc9fc9:0xaedbd8):original.emissive,emissiveIntensity:Material===BiolumeMaterial?1:original.name==='Bioluminescence'?.22:original.emissiveIntensity,
   transparent:original.transparent,opacity:original.opacity,side:original.side,
  }));
  node.material=converted.get(original);if(soft){node.material.roughness=original.name==='Obsidian eyes'?.28:.53;node.material.metalness=0;node.material.emissiveIntensity=original.emissiveIntensity;}
 });
}
export function createPostProcessing(renderer,scene,camera){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
 const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.28,.65,1.15);composer.addPass(bloom);composer.addPass(new OutputPass());
 return composer;
}

export const noiseGLSL=`
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float mist(vec2 p){return .57*noise(p)+.28*noise(p*2.03)+.15*noise(p*4.01);}
`;
const uvVertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
export function createPortalMaterial(){
 return new THREE.ShaderMaterial({uniforms:{time:{value:0}},side:THREE.DoubleSide,transparent:true,depthWrite:false,
  vertexShader:uvVertex,fragmentShader:`uniform float time;varying vec2 vUv;${noiseGLSL}
   void main(){vec2 p=(vUv-.5)*2.0;float r=length(p),a=atan(p.y,p.x);
    float spiral=pow(.5+.5*sin(a*3.0-r*16.0+time*.55),5.0);
    float rings=pow(.5+.5*sin(r*35.0-time*.8+mist(p*3.0)*3.0),12.0);
    vec3 color=mix(vec3(.035,.018,.14),vec3(.13,.3,.65),r);
    color+=vec3(.1,.9,.8)*(spiral*.48+rings*.28)*smoothstep(.1,.9,r);
    color+=vec3(.3,1.5,1.35)*pow(r,12.0);
    gl_FragColor=vec4(color,.92*smoothstep(1.0,.97,r));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
}

export function createBioluminescence(parent,{radius,height,color,count=7}){
 const geometry=new THREE.BufferGeometry(),positions=[],phases=[];
 for(let i=0;i<count;i++){const a=i*2.39996,r=radius*(.45+(i%5)*.14);positions.push(Math.cos(a)*r,height*(.3+(i%7)/8),Math.sin(a)*r);phases.push(i*1.73);}
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
 const uniforms={time:{value:0},strength:{value:1},tint:{value:new THREE.Color(color)},pixelRatio:{value:Math.min(devicePixelRatio,1.75)}};
 const points=new THREE.Points(geometry,new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`uniform float time,pixelRatio;attribute float phase;varying float sparkle;
   void main(){vec3 p=position;p.y+=sin(time*.65+phase)*.1;p.x+=sin(time*.35+phase)*.06;
    sparkle=.65+.35*sin(time*.45+phase);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
    gl_PointSize=(2.0+sparkle*2.0)*pixelRatio;}`,
  fragmentShader:`uniform vec3 tint;uniform float strength;varying float sparkle;
   void main(){vec2 p=gl_PointCoord-.5;float d=length(p);
    float alpha=exp(-d*d*22.0)*sparkle*strength*.45;if(alpha<.02)discard;
    gl_FragColor=vec4(tint,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}));
 points.raycast=()=>{};parent.add(points);
 return {update(time,strength=1){uniforms.time.value=time;uniforms.strength.value=strength;points.visible=strength>0;}};
}

export function createAtmosphere(scene,camera,random){
 const time={value:0},cloudCover={value:0},spores={value:0},wind={value:.2},skyBrightness={value:.28};
 // The sky is camera-relative; world-space stars still provide parallax while orbiting.
 const sky=new THREE.Mesh(new THREE.PlaneGeometry(140,100),new THREE.ShaderMaterial({
  uniforms:{time,cloudCover,skyBrightness},depthWrite:false,depthTest:false,vertexShader:uvVertex,
  fragmentShader:`uniform float time,cloudCover,skyBrightness;varying vec2 vUv;${noiseGLSL}
   void main(){vec2 p=vUv*vec2(7.0,5.0);float n=mist(p+vec2(time*.003,0));
    float band=exp(-pow((vUv.y-.52-(vUv.x-.5)*.35+sin(vUv.x*9.0)*.06)*9.0,2.0));
    vec3 color=vec3(.008,.012,.035)+vec3(.048,.025,.105)*n;
    color+=band*pow(n,2.0)*vec3(.10,.15,.20);
    color+=vec3(.012,.065,.06)*pow(mist(p*1.7+5.0),3.0);
    float clouds=smoothstep(.28,.78,mist(p*1.6+vec2(time*.012,0)));
    color=mix(color,vec3(.14,.125,.18),clouds*cloudCover*.7);
    gl_FragColor=vec4(color*skyBrightness,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}));
 sky.position.z=-115;sky.renderOrder=-100;camera.add(sky);scene.add(camera);
 function particles(count,local){
  const positions=[],phases=[],sizes=[];
  for(let i=0;i<count;i++){
   positions.push((random()-.5)*(local?28:120),local?.6+random()*4:random()*65-15,(random()-.5)*(local?19:110));
   phases.push(random()*Math.PI*2);sizes.push(local?2+random()*3:1+Math.pow(random(),5)*9);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));geometry.setAttribute('starSize',new THREE.Float32BufferAttribute(sizes,1));
  const material=new THREE.ShaderMaterial({uniforms:{time,cloudCover,spores,wind,local:{value:local?1:0},pixelRatio:{value:Math.min(devicePixelRatio,1.75)}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
   vertexShader:`uniform float time,local,pixelRatio,cloudCover,spores,wind;attribute float phase,starSize;varying float brightness;varying float tint;varying float nearField;
    void main(){vec3 p=position;p.x+=local*sin(time*.22+phase)*(.27+wind*.8);p.y+=local*sin(time*.38+phase)*.3;p.z+=local*cos(time*.18+phase)*.22;
     brightness=(.45+.55*pow(.5+.5*sin(time*(.45+phase*.07)+phase),2.0))*mix(1.0-cloudCover*.8,.25+spores*1.5,local);tint=phase/6.283;nearField=local;
     gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);gl_PointSize=starSize*pixelRatio*(1.0+local*(.2+spores*.8));}`,
   fragmentShader:`varying float brightness;varying float tint;varying float nearField;
    void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float core=exp(-d*d*38.0);
     float rays=exp(-min(abs(p.x),abs(p.y))*65.0)*pow(max(0.0,1.0-d*2.0),2.0);
     float alpha=(core+rays*.7*(1.0-nearField))*brightness;if(alpha<.015)discard;
     gl_FragColor=vec4(mix(vec3(.55,.85,1.0),vec3(1.0,.65,.9),tint)*1.6,alpha);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;scene.add(points);
 }
 particles(850,false);particles(100,true);
 return {update(t,weather,frontAmount){time.value=t;skyBrightness.value=.28+.12*frontAmount;cloudCover.value=weather.weights.mist*.65+weather.weights.rain*.85;spores.value=weather.weights.spores;wind.value=weather.wind;}};
}
