import floatingStyle from './floating-island.css?inline';

export function createFloatingIsland(scene,{returnIcon,onEnter,onLeave,onWindowChange}){
 const home=scene.parentNode,anchor=document.createComment('island viewport');scene.before(anchor);
 let floating=null,opening=false;
 const returnButton=document.createElement('button');returnButton.className='floating-return';returnButton.setAttribute('aria-label','回归');returnButton.title='回归';returnButton.innerHTML=returnIcon;
 const pageReturn=returnButton.cloneNode(true);pageReturn.hidden=true;document.body.append(pageReturn);
 function restore(){
  if(!floating)return;
  floating=null;anchor.after(scene);home.inert=false;document.body.classList.remove('island-floating');pageReturn.hidden=true;onLeave();onWindowChange(window);
 }
 function returnToPage(){const popup=floating;restore();popup?.close();window.focus();}
 pageReturn.onclick=returnButton.onclick=returnToPage;
 return {
  async open(){
   if(opening||floating)return;
   if(!window.documentPictureInPicture)throw new Error('当前浏览器不支持独立浮窗，请使用桌面版 Chrome 或 Edge 打开游戏。');
   opening=true;
   try{
    const popup=await window.documentPictureInPicture.requestWindow({width:640,height:480,disallowReturnToOpener:true});floating=popup;
    popup.addEventListener('pagehide',restore,{once:true});
    popup.document.title='星外日常';popup.document.body.className='floating-island';const style=popup.document.createElement('style');style.textContent=floatingStyle;popup.document.head.append(style);
    onEnter();popup.document.body.append(scene,returnButton);home.inert=true;document.body.classList.add('island-floating');pageReturn.hidden=false;onWindowChange(popup);
   }catch(error){const popup=floating;restore();popup?.close();throw error;}finally{opening=false;}
  }
 };
}
