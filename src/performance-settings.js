export const QUALITY_LEVELS=Object.freeze(['low','medium','high']);
export const DEVICE_CLASSES=Object.freeze({pc:'pc',mobileNew:'mobile-new',mobileOld:'mobile-old'});
export const QUALITY_LABELS=Object.freeze({low:'低',medium:'中',high:'高'});
export const DEVICE_LABELS=Object.freeze({pc:'PC', 'mobile-new':'新手机', 'mobile-old':'老手机'});

const PROFILES={
 pc:{
  low:{level:'low',shadows:false,shadowMapSize:512,treeAnimation:'off',weatherDensity:.25,fogDensity:.45,modelLod:'aggressive',modelLodDistance:27,textureQuality:'low',textureAnisotropy:1,maxPixelRatio:1},
  medium:{level:'medium',shadows:true,shadowMapSize:1024,treeAnimation:'reduced',weatherDensity:.6,fogDensity:.75,modelLod:'balanced',modelLodDistance:42,textureQuality:'medium',textureAnisotropy:2,maxPixelRatio:1.35},
  high:{level:'high',shadows:true,shadowMapSize:2048,treeAnimation:'full',weatherDensity:1,fogDensity:1,modelLod:'off',modelLodDistance:Infinity,textureQuality:'high',textureAnisotropy:1,maxPixelRatio:1.75},
 },
 'mobile-new':{
  low:{level:'low',shadows:false,shadowMapSize:512,treeAnimation:'off',weatherDensity:.2,fogDensity:.4,modelLod:'aggressive',modelLodDistance:20,textureQuality:'low',textureAnisotropy:1,maxPixelRatio:1},
  medium:{level:'medium',shadows:true,shadowMapSize:1024,treeAnimation:'reduced',weatherDensity:.5,fogDensity:.7,modelLod:'balanced',modelLodDistance:32,textureQuality:'medium',textureAnisotropy:2,maxPixelRatio:1.25},
  high:{level:'high',shadows:true,shadowMapSize:2048,treeAnimation:'full',weatherDensity:1,fogDensity:1,modelLod:'off',modelLodDistance:Infinity,textureQuality:'high',textureAnisotropy:1,maxPixelRatio:1.75},
 },
 'mobile-old':{
  low:{level:'low',shadows:false,shadowMapSize:512,treeAnimation:'off',weatherDensity:.15,fogDensity:.35,modelLod:'aggressive',modelLodDistance:16,textureQuality:'low',textureAnisotropy:1,maxPixelRatio:1},
  medium:{level:'medium',shadows:true,shadowMapSize:512,treeAnimation:'reduced',weatherDensity:.35,fogDensity:.6,modelLod:'aggressive',modelLodDistance:26,textureQuality:'medium',textureAnisotropy:1,maxPixelRatio:1.1},
  high:{level:'high',shadows:true,shadowMapSize:2048,treeAnimation:'full',weatherDensity:1,fogDensity:1,modelLod:'off',modelLodDistance:Infinity,textureQuality:'high',textureAnisotropy:1,maxPixelRatio:1.75},
 },
};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function mobileOsVersion(userAgent){
 const ios=String(userAgent).match(/OS (\d+)[._]/i),android=String(userAgent).match(/Android\s+(\d+)/i);
 return {ios:Number(ios?.[1]||0),android:Number(android?.[1]||0)};
}

export function detectDeviceClass(info={}){
 const userAgent=String(info.userAgent||''),width=Number(info.viewportWidth||0),touch=Number(info.maxTouchPoints||0);
 const mobile=info.mobile===true||/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)||touch>1&&width>0&&width<=1000;
 if(!mobile)return DEVICE_CLASSES.pc;
 const cores=Number(info.hardwareConcurrency||0),memory=Number(info.deviceMemory||0),version=mobileOsVersion(userAgent);
 return memory>=4||cores>=6||version.ios>=16||version.android>=11?DEVICE_CLASSES.mobileNew:DEVICE_CLASSES.mobileOld;
}

export function detectDeviceInfo(){
 const nav=globalThis.navigator||{},viewportWidth=Number(globalThis.innerWidth||globalThis.screen?.width||0),viewportHeight=Number(globalThis.innerHeight||globalThis.screen?.height||0);
 let webglRenderer='';
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
  if(gl){const debug=gl.getExtension('WEBGL_debug_renderer_info');webglRenderer=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)||''):String(gl.getParameter(gl.RENDERER)||'');}
 }
 return {userAgent:String(nav.userAgent||''),mobile:nav.userAgentData?.mobile===true,hardwareConcurrency:Number(nav.hardwareConcurrency||0),deviceMemory:Number(nav.deviceMemory||0),maxTouchPoints:Number(nav.maxTouchPoints||0),viewportWidth,viewportHeight,devicePixelRatio:Number(globalThis.devicePixelRatio||1),webglRenderer};
}

export function scoreDevice(info={}){
 const cores=Number(info.hardwareConcurrency||0),memory=Number(info.deviceMemory||0),renderer=String(info.webglRenderer||'');
 const cpu=clamp((cores-1)/11,0,1)*30;
 const ram=memory>0?clamp(memory/24,0,1)*25:17;
 const gpu=/swiftshader|software|llvmpipe/i.test(renderer)?4:/apple\s+m[2-9]|rtx|rx\s*[5679]|arc|adreno\s*7|mali-g7/i.test(renderer)?34:/apple|geforce|nvidia|radeon|amd|iris|uhd|adreno|mali/i.test(renderer)?25:16;
 const area=Number(info.viewportWidth||0)*Number(info.viewportHeight||0)*Math.pow(Number(info.devicePixelRatio||1),2);
 const display=area>5e6?4:area>2.5e6?8:12;
 return Math.round(clamp(cpu+ram+gpu+display,0,100));
}

export function getQualityProfile(deviceClass,level){
 if(!Object.hasOwn(PROFILES,deviceClass))throw new RangeError(`Unknown device class: ${deviceClass}`);
 if(!QUALITY_LEVELS.includes(level))throw new RangeError(`Unknown quality level: ${level}`);
 return {...PROFILES[deviceClass][level]};
}
