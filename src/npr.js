import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// Quantize the combined lighting once so fill/rim lights cannot wash out the cel bands.
// Characters, props and living tissue share this three-band cel shader.
export class StarToonMaterial extends THREE.MeshToonMaterial{
 onBeforeCompile(shader){
  shader.fragmentShader=shader.fragmentShader.replace('#include <gradientmap_pars_fragment>',`
   vec3 getGradientIrradiance(vec3 normal,vec3 lightDirection){return vec3(max(dot(normal,lightDirection),0.0));}`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_toon_pars_fragment>',
   THREE.ShaderChunk.lights_toon_pars_fragment.replaceAll('BRDF_Lambert( material.diffuseColor )','vec3( RECIPROCAL_PI )'));
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec3 illumination=reflectedLight.directDiffuse+reflectedLight.indirectDiffuse;
   const vec3 luma=vec3(.2126,.7152,.0722);
   // Relative lighting selects cel bands; absolute energy and light color still shade them.
   float keyLight=0.0;
   #if NUM_DIR_LIGHTS > 0
    for(int i=0;i<NUM_DIR_LIGHTS;i++)keyLight=max(keyLight,dot(directionalLights[i].color,luma));
   #endif
   float lightBudget=dot(ambientLightColor,luma)+keyLight;
   #if NUM_HEMI_LIGHTS > 0
    for(int i=0;i<NUM_HEMI_LIGHTS;i++)lightBudget+=max(dot(hemisphereLights[i].skyColor,luma),dot(hemisphereLights[i].groundColor,luma));
   #endif
   lightBudget=max(lightBudget*RECIPROCAL_PI,.001);
   float luminance=dot(illumination,luma);
   float lightLevel=luminance/lightBudget;
   float aa=max(fwidth(lightLevel),.006);
   float mid=smoothstep(.38-aa,.38+aa,lightLevel);
   float lit=smoothstep(.78-aa,.78+aa,lightLevel);
   vec3 shade=mix(vec3(.30,.34,.48),vec3(.60,.65,.76),mid);
   shade=mix(shade,vec3(1.0,.97,.94),lit);
   shade*=illumination/max(luminance,.001);
   shade*=min(max(lightBudget,luminance),1.0);
   // A narrow ink edge follows the original surface; no outline geometry is added.
   float facing=max(dot(normal,normalize(vViewPosition)),0.0);
   float ink=1.0-smoothstep(.04,.14,facing);
   outgoingLight=diffuseColor.rgb*shade*mix(1.0,.32,ink)+totalEmissiveRadiance;
   #include <opaque_fragment>`);
 }
 customProgramCacheKey(){return 'star-cel-v2';}
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
 customProgramCacheKey(){return 'living-tissue-cel-v3';}
}
export function stylizeAsset(source,{character=false}={}){
 const converted=new Map();
 source.traverse(node=>{if(!node.isMesh)return;
  const original=node.material;
  const Material=['Nebula mushroom','Luminous gills','Pearl stem','Mutant cap','Mutant gills','Mutant stem','Mutant spores'].includes(original.name)?BiolumeMaterial:StarToonMaterial;
  if(!converted.has(original))converted.set(original,new Material({
   name:original.name,color:original.name==='Nebula mushroom'?new THREE.Color(0xd99bc5):original.color,map:original.map,
   emissive:Material===BiolumeMaterial?new THREE.Color(original.name==='Nebula mushroom'?0xe8cddd:0xaedbd8):original.emissive,emissiveIntensity:Material===BiolumeMaterial?1:!character&&original.name==='Bioluminescence'?.22:original.emissiveIntensity,
   transparent:original.transparent,opacity:original.opacity,side:original.side,
  }));
  node.material=converted.get(original);
 });
}
export function createPostProcessing(renderer,scene,camera,{bloomStrength=.28,bloomRadius=.65}={}){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
 const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),bloomStrength,bloomRadius,1.15);composer.addPass(bloom);composer.addPass(new OutputPass());
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
 const time={value:0},cloudCover={value:0},spores={value:0},wind={value:.2},front={value:1},aspect={value:1},storybook={value:0};
 // Fill the viewport directly so zooming cannot crop away the nebula's detail.
 const sky=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
  uniforms:{time,cloudCover,front,aspect,storybook},depthWrite:false,depthTest:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}',
  fragmentShader:`uniform float time,cloudCover,front,aspect,storybook;varying vec2 vUv;${noiseGLSL}
   void main(){
    vec2 p=(vUv-.5)*vec2(aspect,1.0);
    if(storybook>.5){
     vec3 upper=mix(vec3(.020,.032,.040),vec3(.23,.43,.49),front);
     vec3 lower=mix(vec3(.075,.105,.083),vec3(.64,.73,.62),front);
     vec3 color=mix(lower,upper,smoothstep(0.,1.,vUv.y));
     color+=vec3(mist(p*2.3)*.012);
     gl_FragColor=vec4(color,1.0);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
     return;
    }
    vec3 upper=mix(vec3(.010,.014,.036),vec3(.035,.10,.28),front);
    vec3 lower=mix(vec3(.020,.036,.063),vec3(.23,.195,.30),front);
    vec3 color=mix(lower,upper,smoothstep(.0,.95,vUv.y));
    float arc=p.y+.17+.10*cos(p.x*2.0+time*.0007);
    float veil=exp(-pow(arc*mix(8.0,3.0,front),2.0));
    float cloud=mist(p*3.0+vec2(time*.0005,0.0));
    color+=veil*(.85+.15*cloud)*mix(vec3(.007,.019,.030),vec3(.045,.037,.025),front);
    float sunlight=exp(-dot((p-vec2(-.55,.35))*vec2(2.0,4.0),(p-vec2(-.55,.35))*vec2(2.0,4.0)));
    color+=front*sunlight*vec3(.095,.055,.060)*(1.0-cloudCover*.7);
    // Small distant stars complement the existing world-space parallax stars.
    vec2 starGrid=p*90.0,cell=floor(starGrid);
    vec2 starOffset=vec2(hash(cell),hash(cell+37.2))*.7+.15;
    float starDistance=length(fract(starGrid)-starOffset);
    float starAA=length(fwidth(starGrid))*.65;
    float star=(1.0-smoothstep(.025,.025+starAA,starDistance))*step(mix(.988,.996,front),hash(cell+71.0));
    color+=star*vec3(.65,.80,1.0)*mix(.8,.30,front)*(.85+.15*sin(time*.35+hash(cell)*24.0))*(1.0-cloudCover*.65);
    color=mix(color,mix(vec3(.026,.038,.060),vec3(.15,.16,.195),front),cloudCover*.20);
    color*=1.0-.10*smoothstep(.35,1.1,length(p));
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}));
 sky.frustumCulled=false;sky.renderOrder=-100;camera.add(sky);scene.add(camera);
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
 return {update(t,weather,frontAmount,isStorybook=false){storybook.value=isStorybook?1:0;time.value=t;aspect.value=(camera.right-camera.left)/(camera.top-camera.bottom);front.value=frontAmount;cloudCover.value=weather.weights.mist*.65+weather.weights.rain*.85;spores.value=weather.weights.spores;wind.value=weather.wind;}};
}
