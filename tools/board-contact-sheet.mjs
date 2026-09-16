// PROTOTYPE helper (throwaway) — folds the 12 real-game board screenshots into one contact sheet.
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const root=fileURLToPath(new URL('../',import.meta.url));
const ALL=[['a','A · 遥测刻度条'],['b','B · 星港登机牌'],['c','C · 航行刻度盘'],['d','D · 星港翻牌通栏']];
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.split('=')));
const COUNTS=(args.counts??'1,2,3').split(',').map(Number);
const SCALE=Number(args.scale??.62),WINDOW=880;
const OUT=args.out??'artifacts/flight-board/contact-sheet.png';
const STYLES=args.styles?ALL.filter(([key])=>args.styles.split(',').includes(key)):ALL;
const crop=style=>style==='d'?{x:0,y:74,w:WINDOW,h:170}:{x:290,y:74,w:WINDOW,h:230};

const cell=(style,count)=>{
 const box=crop(style),file=`/artifacts/flight-board/board-${style}-${count}.png`;
 return `<figure><div class="win" style="width:${box.w*SCALE}px;height:${box.h*SCALE}px">
  <img src="${file}" style="left:${-box.x*SCALE}px;top:${-box.y*SCALE}px;width:${1440*SCALE}px"/>
 </div><figcaption>${count} 班</figcaption></figure>`;
};

const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>UFO 航行动态条 · 对照</title><link rel="icon" href="data:,">
<style>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap');
*{box-sizing:border-box}body{margin:0;padding:26px 30px 30px;background:#101725;color:#e9f1f5;font-family:'Manrope','Noto Sans SC',sans-serif}
h1{margin:0 0 6px;font-size:19px;font-weight:700;letter-spacing:1px}
p{margin:0 0 20px;font-size:11px;color:#8ea3b2;letter-spacing:.4px}
table{border-collapse:separate;border-spacing:14px}
th{font-size:11px;font-weight:700;letter-spacing:1.6px;color:#7ff0cd;text-align:center;padding-bottom:2px}
th.row{text-align:left;color:#cfe0e8;white-space:nowrap;padding-right:6px}
td{vertical-align:top}
figure{margin:0}
.win{position:relative;overflow:hidden;border-radius:3px;background:#0b1220;box-shadow:0 6px 18px #05090f80}
.win img{position:absolute;display:block;image-rendering:auto}
figcaption{margin-top:5px;font-size:10px;color:#7d93a3;letter-spacing:1px;text-align:center}
</style></head><body>
<h1>UFO 航行动态条 · 真实游戏内对照</h1>
<p>四种版式 × 1 / 2 / 3 班航班同时在飞。截图取自真实游戏（童梦星屿正面，1440×1000）。</p>
<table>
 <tr><th class="row"></th>${COUNTS.map(count=>`<th>${count} 班</th>`).join('')}</tr>
 ${STYLES.map(([style,label])=>`<tr><th class="row">${label}</th>${COUNTS.map(count=>`<td>${cell(style,count)}</td>`).join('')}</tr>`).join('')}
</table></body></html>`;

await writeFile(join(root,'tools/flight-board-sheet.html'),html);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1800,height:Number(args.vh??1200)},deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:5173/tools/flight-board-sheet.html');
 await page.evaluate(async()=>{try{await document.fonts.ready;}catch{};await Promise.all([...document.images].map(image=>image.complete?0:new Promise(done=>{image.onload=image.onerror=done;})));});
 await page.waitForTimeout(600);
 const box=await page.locator('table').boundingBox();
 await page.screenshot({path:join(root,OUT),clip:{x:0,y:0,width:Math.ceil(box.x+box.width+30),height:Math.ceil(box.y+box.height+30)},timeout:120000});
 console.log('contact sheet written');
}finally{await browser.close();}
