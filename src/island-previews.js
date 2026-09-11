import {HalfFloatType,OrthographicCamera,Vector3,Vector4,WebGLRenderTarget} from 'three';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
export const ISLAND_PREVIEW_TTL=5*60*1000;
export const islandPreviewDue=(capturedAt,now)=>capturedAt===undefined||now-capturedAt>=ISLAND_PREVIEW_TTL;

export function createIslandPreviews(renderer,scene,hidden){
 const width=192,height=384,camera=new OrthographicCamera(-14*16/9,14*16/9,14,-14,.1,180);
 camera.position.set(23,25,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const offset=new Vector3().setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar(2.4);
 camera.position.add(offset);camera.lookAt(offset);camera.zoom=.92;
 const target=new WebGLRenderTarget(width,height,{type:HalfFloatType,samples:2});
 const output=new WebGLRenderTarget(width,height,{depthBuffer:false}),pass=new OutputPass();
 const pixels=new Uint8Array(width*height*4),cache=new Map();
 let pending=false;
 return {
  get(id){return cache.get(id)?.canvas;},
  fresh(id,now){return !islandPreviewDue(cache.get(id)?.capturedAt,now);},
  async update(game,now){
   const id=game.viewIsland,entry=cache.get(id);
   if(pending||!islandPreviewDue(entry?.capturedAt,now))return;
   pending=true;
   try{
    const previousTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(new Vector4()),scissor=renderer.getScissor(new Vector4()),scissorTest=renderer.getScissorTest(),visibility=hidden.map(node=>node.visible);
    let read;
    try{
     // Match the old 1920x1080 screenshots' portrait CSS crops, without rendering the unused pixels.
     camera.setViewOffset(1920,1080,(1920-540)*(id==='home'?.34:.49),0,540,1080);
     hidden.forEach(node=>{node.visible=false;});
     renderer.setRenderTarget(target);renderer.render(scene,camera);
     pass.render(renderer,output,target);
     read=renderer.readRenderTargetPixelsAsync(output,0,0,width,height,pixels);
    }finally{
     hidden.forEach((node,index)=>{node.visible=visibility[index];});
     renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
    }
    await read;
    const canvas=entry?.canvas??document.createElement('canvas');
    canvas.width=width;canvas.height=height;canvas.setAttribute('aria-hidden','true');
    const context=canvas.getContext('2d'),image=context.createImageData(width,height),stride=width*4;
    // WebGL rows start at the bottom; Canvas image data starts at the top.
    for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-y-1)*stride,(height-y)*stride),y*stride);
    context.putImageData(image,0,0);cache.set(id,{capturedAt:now,canvas});
   }finally{pending=false;}
  },
  dispose(){target.dispose();output.dispose();pass.dispose();cache.clear();}
 };
}
