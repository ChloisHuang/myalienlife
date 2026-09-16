// PROTOTYPE helper (throwaway) — one screenshot of the live game's flight board.
import {chromium} from '@playwright/test';
const [out='artifacts/flight-board/live.png',wait='22000',w='1440',h='1000']=process.argv.slice(2);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:Number(w),height:Number(h)},deviceScaleFactor:1,locale:'zh-CN'});
 page.on('pageerror',error=>console.log('pageerror:',error.message));
 await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForTimeout(Number(wait));
 const info=await page.evaluate(()=>{
  const box=node=>{const rect=node.getBoundingClientRect();return {x:Math.round(rect.x),y:Math.round(rect.y),w:Math.round(rect.width),h:Math.round(rect.height)};};
  const board=document.querySelector('.ufo-flight-board');
  return {display:board?getComputedStyle(board).display:'absent',board:board?box(board):null,tickets:[...document.querySelectorAll('.ufo-ticket')].map(box),card:document.querySelector('.ufo-card')?box(document.querySelector('.ufo-card')):null,stamp:document.querySelector('.ufo-stamp')?box(document.querySelector('.ufo-stamp')):null,text:board.innerText};
 });
 console.log(JSON.stringify(info,null,1));
 await page.screenshot({path:out,timeout:120000});
}finally{await browser.close();}
