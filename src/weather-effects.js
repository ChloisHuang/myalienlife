import * as THREE from 'three';
import {noiseGLSL} from './npr.js';

export function createWeatherEffects(scene,random){
 const time={value:0},rainAmount={value:0},fogAmount={value:0},wind={value:.2};
 const dropPositions=[],tips=[];
 for(let i=0;i<420;i++){
  const a=random()*Math.PI*2,r=Math.sqrt(random())*15,x=Math.cos(a)*r,z=Math.sin(a)*r*.72,y=random()*8;
  for(const tip of [0,1]){dropPositions.push(x,y,z);tips.push(tip);}
 }
 const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dropPositions,3));rainGeometry.setAttribute('tip',new THREE.Float32BufferAttribute(tips,1));
 const rain=new THREE.LineSegments(rainGeometry,new THREE.ShaderMaterial({
  uniforms:{time,rainAmount,wind},transparent:true,depthWrite:false,
  vertexShader:`uniform float time,wind;attribute float tip;varying vec3 location;varying float fade;
   void main(){vec3 p=position;p.y=.25+mod(position.y-time*5.0,8.0);p.x+=wind*(p.y-4.0)*.22;
    p+=vec3(-wind*.08, .32,0.0)*tip;location=p;fade=1.0-tip*.7;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
  fragmentShader:`uniform float rainAmount;varying vec3 location;varying float fade;
   void main(){if(location.x>-8.5&&location.x<4.5&&location.z>-6.3&&location.z<1.4&&location.y<3.2)discard;
    gl_FragColor=vec4(.66,.75,.86,rainAmount*.3*fade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}));
 rain.frustumCulled=false;rain.raycast=()=>{};scene.add(rain);
 const mistMaterial=new THREE.ShaderMaterial({uniforms:{time,fogAmount},transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform float time,fogAmount;varying vec2 vUv;${noiseGLSL}
   void main(){vec2 p=vUv*vec2(6.0,3.0)+vec2(time*.018,0.0);float density=smoothstep(.24,.75,mist(p));
    float edge=pow(max(0.0,1.0-length((vUv-.5)*2.0)),1.4);
    gl_FragColor=vec4(.62,.56,.69,density*edge*fogAmount*.38);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const mist=new THREE.Group();scene.add(mist);
 for(const [x,y,z,angle]of [[-7,.5,4,.2],[7,.8,-2,-.2],[-3,1.2,-5,.45]]){
  const sheet=new THREE.Mesh(new THREE.PlaneGeometry(22,10),mistMaterial);sheet.rotation.set(-Math.PI/2,0,angle);sheet.position.set(x,y,z);sheet.raycast=()=>{};mist.add(sheet);
 }
 const splashPositions=[],phases=[];
 for(let i=0;i<60;i++){const a=random()*Math.PI*2,r=5+random()*9,x=Math.cos(a)*r,z=Math.sin(a)*r*.7;if(x>-8.5&&x<4.5&&z>-6.3&&z<1.4)continue;splashPositions.push(x,.09,z);phases.push(random());}
 const splashGeometry=new THREE.BufferGeometry();splashGeometry.setAttribute('position',new THREE.Float32BufferAttribute(splashPositions,3));splashGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
 const splashes=new THREE.Points(splashGeometry,new THREE.ShaderMaterial({uniforms:{time,rainAmount,pixelRatio:{value:Math.min(globalThis.devicePixelRatio||1,1.75)}},transparent:true,depthWrite:false,
  vertexShader:`uniform float time,pixelRatio;attribute float phase;varying float age;
   void main(){age=fract(time*.7+phase);gl_PointSize=(3.0+age*11.0)*pixelRatio;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform float rainAmount;varying float age;void main(){vec2 p=(gl_PointCoord-.5)*vec2(1.0,1.8);float d=length(p);float ring=exp(-pow((d-.35)*32.0,2.0));gl_FragColor=vec4(.72,.81,.88,ring*(1.0-age)*rainAmount*.16);}`,
 }));splashes.raycast=()=>{};scene.add(splashes);
 let weatherDensity=1,fogDensity=1;
 function setQuality(profile){
  weatherDensity=profile.weatherDensity;fogDensity=profile.fogDensity;
  rainGeometry.setDrawRange(0,Math.floor(420*weatherDensity)*2);
  splashGeometry.setDrawRange(0,Math.floor(splashGeometry.getAttribute('position').count*weatherDensity));
  const layers=Math.ceil(3*weatherDensity);mist.children.forEach((sheet,index)=>{sheet.userData.qualityLayer=index<layers;});
 }
 setQuality({weatherDensity:1,fogDensity:1});
 return {setQuality,update(t,weather){time.value=t;rainAmount.value=weather.weights.rain;fogAmount.value=(weather.weights.mist+weather.weights.rain*.28)*fogDensity;wind.value=weather.wind;rain.visible=splashes.visible=rainAmount.value>.001;mist.visible=fogAmount.value>.001;mist.children.forEach(sheet=>{sheet.visible=mist.visible&&sheet.userData.qualityLayer;});}};
}
