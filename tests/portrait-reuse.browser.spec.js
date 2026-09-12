import {test,expect} from '@playwright/test';

test('portrait rendering reuses shader programs after all appearance variants are warm',async({page})=>{
 await page.route('**/portrait-reuse-check',route=>route.fulfill({contentType:'text/html',body:'<div id="world" style="width:800px;height:600px"></div>'}));
 await page.goto('http://127.0.0.1:5173/portrait-reuse-check');
 const result=await page.evaluate(async()=>{
  const {createWorld}=await import('/src/world.js'),{createGame}=await import('/src/simulation.js');
  const g=createGame(),world=await createWorld(document.querySelector('#world'),()=>g,{onClick(){},onHover(){},onPlace(){}});
  const createProgram=WebGL2RenderingContext.prototype.createProgram;let programs=0;
  WebGL2RenderingContext.prototype.createProgram=function(){programs++;return createProgram.call(this);};
  const base=structuredClone(g.player),images=[];
  try{
   for(let round=0;round<2;round++){
    if(round===1)programs=0;
    for(const age of [0,8,28,68]){
     Object.assign(g.player,structuredClone(base),{age});
     g.player.prayer={radiance:10,nether:10,mutations:['crown','eyes','freckles','spines']};
     images.push(world.portrait('player'));Object.assign(g.player,structuredClone(base));images.push(world.portrait('player'));
    }
   }
   return {programs,images:images.length,consistent:images.slice(0,8).every((image,i)=>image===images[i+8])};
  }finally{WebGL2RenderingContext.prototype.createProgram=createProgram;}
 });
 expect(result.consistent).toBe(true);expect(result.images).toBe(16);expect(result.programs).toBe(0);
});
