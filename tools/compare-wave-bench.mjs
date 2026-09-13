import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}});
 await page.goto('http://127.0.0.1:5193/tools/wave-bench-preview.html?isolated');
 await page.locator('body[data-ready=true]').waitFor();
 await page.evaluate(()=>new Promise(requestAnimationFrame));
 const metrics=await page.evaluate(()=>{
  const source=benchPreview.renderer.domElement,canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let left=canvas.width,right=0,top=canvas.height,bottom=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>127){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return {normalizedBounds:{x:left/canvas.width,y:top/canvas.height,w:(right-left+1)/canvas.width,h:(bottom-top+1)/canvas.height},alignment:'bounding-box only; visual review required'};
 });
 await page.screenshot({path:'artifacts/ocean/wave-bench-isolated.png',omitBackground:true});
 await writeFile('artifacts/ocean/wave-bench-reference-check.json',JSON.stringify(metrics,null,2));
 await page.setViewportSize({width:1200,height:700});
 await page.goto('http://127.0.0.1:5193/tools/wave-bench-comparison.html');
 await page.locator('body[data-ready=true]').waitFor();
 await page.screenshot({path:'artifacts/ocean/wave-bench-comparison.png'});
 console.log(metrics);
}finally{await browser.close();}
