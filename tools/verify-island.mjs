import {WONDER_OPTIONS,createWonder} from '../src/wonders.js';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGame} from '../src/simulation.js';

await mkdir('artifacts',{recursive:true});
const label=process.argv[2]||'island';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|shader/i.test(message.text()))errors.push(message.text());});
 const state=createGame();state.speed=0;state.viewSide='back';state.player.side='back';state.player.x=2;state.player.z=2;
 if(process.argv[3])state.minute=Number(process.argv[3]);
 for(const [type,x,z]of [['stove',3,0],['tea',5,0],['banquet',0,0],['relic',6,-3],['beacon',-4,-4],['glowlight',0,4],['polelight',-4,2]])state.objects.push({id:`preview-${type}`,type,side:'back',x,z,rotation:0,...(WONDER_OPTIONS[type]?{wonder:createWonder(type)}:{})});
 await page.route('**/api/save',route=>route.fulfill({json:{state,revision:1,savedAt:null}}));
 await page.goto('http://127.0.0.1:5173');await page.locator('#loading').waitFor({state:'hidden',timeout:45000});
 await page.waitForTimeout(500);await page.screenshot({path:`artifacts/${label}-back.png`});
 await page.getByRole('button',{name:'翻转星岛',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#world').dataset.side==='front'&&document.querySelector('#world').dataset.flipping==='false');
 await page.screenshot({path:`artifacts/${label}-front.png`});
 assert.deepEqual(errors,[]);console.log('Both island faces rendered without JavaScript or shader errors; screenshots in artifacts/.');
}finally{await browser.close();}
