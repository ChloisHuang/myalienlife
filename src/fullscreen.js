const FALLBACK_CLASS='app-fullscreen';
const MOBILE_QUERY='(max-width:760px)';

export function createFullscreenController(options={}){
 const documentRef=options.documentRef??globalThis.document;
 const element=options.element??documentRef.documentElement;
 const screenRef=options.screenRef??globalThis.screen;
 const orientation=screenRef?.orientation;
 const shouldLockOrientation=options.shouldLockOrientation??(()=>globalThis.matchMedia?.(MOBILE_QUERY).matches??false);
 const onChange=options.onChange??(()=>{});
 const onError=options.onError??(()=>{});
 let fallbackActive=false;
 let orientationLocked=false;
 const isNative=()=>documentRef.fullscreenElement===element;
 const isActive=()=>isNative()||fallbackActive;
 const publish=()=>{const active=isActive();documentRef.documentElement.classList.toggle(FALLBACK_CLASS,active);onChange(active);};
 const unlockOrientation=()=>{if(!orientationLocked)return;orientationLocked=false;orientation?.unlock?.();};
 const lockLandscape=async enabled=>{if(!enabled||typeof orientation?.lock!=='function')return;try{await orientation.lock('landscape');orientationLocked=true;}catch{}};
 const setFallback=active=>{fallbackActive=active;publish();};
 const handleChange=()=>{if(documentRef.fullscreenElement!==element){fallbackActive=false;unlockOrientation();}publish();};
 documentRef.addEventListener('fullscreenchange',handleChange);

 async function toggle(){
  if(isNative()){
   await documentRef.exitFullscreen();
   unlockOrientation();
   return false;
  }
  if(fallbackActive){setFallback(false);return false;}
  const lockOnMobile=Boolean(shouldLockOrientation());
  if(typeof element.requestFullscreen==='function'){
   try{await element.requestFullscreen();await lockLandscape(lockOnMobile);return true;}
   catch(error){onError(error);return false;}
  }
  setFallback(true);return true;
 }

 return {toggle,isActive};
}
