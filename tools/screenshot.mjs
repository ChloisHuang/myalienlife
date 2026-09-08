import {chromium} from '@playwright/test';
import {OrthographicCamera,Vector3} from 'three';
const cam=new OrthographicCamera(-14*1600/725,14*1600/725,14,-14,.1,180);cam.position.set(23,25,30);cam.lookAt(0,0,0);cam.updateMatrixWorld();const offset=new Vector3().setFromMatrixColumn(cam.matrixWorld,0).multiplyScalar(2.4);cam.position.add(offset);cam.lookAt(offset);cam.zoom=.92;cam.updateProjectionMatrix();cam.updateMatrixWorld();
for(const [x,z]of [[5,5],[-3,5],[0,5],[-7,3]]){const p=new Vector3(x,.29,z).project(cam);console.log({x,z,screen:[Math.round((p.x+1)*800),Math.round((1-p.y)*725/2+50)]});}
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
await page.goto('http://127.0.0.1:5173');
await page.locator('#world canvas').waitFor();
await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
await page.waitForTimeout(1200);
await page.screenshot({path:'test-results/home.png'});
await page.setViewportSize({width:390,height:844});
await page.waitForTimeout(500);
await page.screenshot({path:'test-results/mobile.png'});
await browser.close();
