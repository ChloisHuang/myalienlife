// PROTOTYPE helper — screenshots tools/flight-board-prototype.html variants. Throwaway.
import {chromium} from '@playwright/test';
const base='http://127.0.0.1:5173/tools/flight-board-prototype.html';
const out=new URL('../.data/proto-shots/',import.meta.url).pathname;
const browser=await chromium.launch({headless:true});
for(const job of process.argv.slice(2)){
  const [variant,lang,scene,mode]=job.split(',');
  const wide=variant==='d'||variant==='all'; /* COMPARE */
  const page=await browser.newPage({viewport:{width:1440,height:variant==='all'?1000:830},deviceScaleFactor:mode==='zoom'?2:1});
  await page.goto(`${base}?variant=${variant}&lang=${lang}&scene=${scene}`);
  await page.waitForTimeout(1000);
  const file=mode==='zoom'?`zoom-${variant}-${lang}-${scene}.png`:`board-${variant}-${lang}-${scene}.png`;
  await page.screenshot({path:`${out}${file}`,...(mode==='zoom'?{clip:wide?{x:0,y:0,width:1440,height:120}:{x:360,y:0,width:720,height:130}}:{})});
  await page.close();
  console.log('shot',file);
}
await browser.close();
