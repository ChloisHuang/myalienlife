// PROTOTYPE helper — fails if the board prototype throws. Throwaway.
import {chromium} from '@playwright/test';
const base='http://127.0.0.1:5173/tools/flight-board-prototype.html';
const browser=await chromium.launch({headless:true});
let bad=0;
for(const v of ['current','a','b','c','d','all'])for(const lang of ['zh','en']){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}?variant=${v}&lang=${lang}&scene=night`);
  await page.waitForTimeout(300);
  const text=await page.locator('#stage').innerText();
  if(!text.includes(lang==='en'?'Storybook Atoll':'童梦星屿'))errors.push('board text missing');
  if(errors.length){bad++;console.log('FAIL',v,lang,errors);}else console.log('ok  ',v,lang);
  await page.close();
}
await browser.close();process.exit(bad?1:0);
