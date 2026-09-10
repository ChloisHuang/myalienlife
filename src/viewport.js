export function localPoint(rect,x,y,rotated){
 return rotated?{x:y-rect.top,y:rect.right-x}:{x:x-rect.left,y:y-rect.top};
}

function rotated(element){
 const app=element.ownerDocument.getElementById('app');
 return !!app&&app.contains(element)&&getComputedStyle(app).getPropertyValue('--rotated-layout').trim()==='1';
}

export function elementPoint(element,x,y){
 return localPoint(element.getBoundingClientRect(),x,y,rotated(element));
}

export function layoutPoint(x,y){return elementPoint(document.getElementById('app'),x,y);}
export function layoutSize(){const app=document.getElementById('app');return {width:app.clientWidth,height:app.clientHeight};}

// OrbitControls consumes logical pointer coordinates, including pinch and wheel anchors.
export function controlSurface(element){
 const listeners=new Map();
 return new Proxy(element,{get(target,key){
  if(key==='getBoundingClientRect')return ()=>({left:0,top:0,width:target.clientWidth,height:target.clientHeight});
  if(key==='addEventListener')return (type,listener,options)=>{
   if(!listeners.has(listener))listeners.set(listener,event=>{
    const point=elementPoint(target,event.clientX,event.clientY);
    listener(new Proxy(event,{get(e,property){
     if(property==='clientX'||property==='pageX')return point.x;
     if(property==='clientY'||property==='pageY')return point.y;
     const value=Reflect.get(e,property,e);return typeof value==='function'?value.bind(e):value;
    }}));
   });
   target.addEventListener(type,listeners.get(listener),options);
  };
  if(key==='removeEventListener')return (type,listener,options)=>target.removeEventListener(type,listeners.get(listener),options);
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
}
