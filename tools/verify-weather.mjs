import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createGame} from '../src/simulation.js';

await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=createGame();state.speed=0;
await page.route('**/api/save',route=>route.fulfill({json:{state,revision:1,savedAt:null}}));
for(const [type,minute]of [['clear',510],['mist',705],['rain',885],['spores',1425]]){
 state.minute=minute;await page.goto('http://127.0.0.1:5173');await page.locator('#loading').waitFor({state:'hidden',timeout:45000});
 await expect(page.locator('#weather')).toHaveAttribute('data-weather',type);await page.waitForTimeout(600);
 await page.screenshot({path:`artifacts/weather-${type}.png`});
}
state.minute=839;await page.reload();await page.locator('#loading').waitFor({state:'hidden',timeout:45000});
await expect(page.locator('#weather')).toHaveAttribute('data-weather','mist');
const frozen=await page.locator('#weather').innerText();await page.waitForTimeout(500);await expect(page.locator('#weather')).toHaveText(frozen);
await page.keyboard.press('3');await expect(page.locator('#weather')).toHaveAttribute('data-weather','rain',{timeout:6000});
await page.waitForTimeout(2500);await page.keyboard.press('1');
const video=await page.evaluate(async()=>{
 const stream=document.querySelector('#world canvas').captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
 recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();await new Promise(resolve=>setTimeout(resolve,5000));recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
 let binary='';for(const b of new Uint8Array(await new Blob(chunks).arrayBuffer()))binary+=String.fromCharCode(b);return btoa(binary);
});await writeFile('artifacts/weather-rain.webm',Buffer.from(video,'base64'));
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:'artifacts/weather-mobile.png'});
expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
await browser.close();console.log(JSON.stringify({errors,verified:['clear','mist','rain','spores','pause','live transition','mobile']}));if(errors.length)process.exitCode=1;
