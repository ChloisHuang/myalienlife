import test from 'node:test';
import assert from 'node:assert/strict';
import {createAmbientClock} from '../src/ambient-clock.js';

test('ambient motion continues through missing snapshots and ignores server catch-up',()=>{
 const clock=createAmbientClock();
 assert.equal(clock.sample(255,1,0),255);
 for(let frame=1;frame<=100;frame++)assert.ok(Math.abs(clock.sample(255,1,frame*20)-(255+frame*.02))<1e-9);
 assert.ok(Math.abs(clock.sample(290,1,2020)-257.02)<1e-9);
});
test('ambient motion respects pause and speed without replaying a blocked browser',()=>{
 const clock=createAmbientClock();clock.sample(100,1,0);
 assert.equal(clock.sample(100,0,20),100);
 assert.equal(clock.sample(100,0,4000),100);
 assert.equal(clock.sample(100,3,4020),100.06);
 assert.ok(Math.abs(clock.sample(500,3,14020)-100.36)<1e-9);
});
