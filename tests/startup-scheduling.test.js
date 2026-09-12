import test from 'node:test';
import assert from 'node:assert/strict';
import {afterPaint,deferAfterPaint} from '../src/startup-scheduling.js';

function fakeRaf(){
 const queue=[];
 return {
  raf(callback){queue.push(callback);},
  step(){const callbacks=queue.splice(0);for(const callback of callbacks)callback();},
  get pending(){return queue.length;},
 };
}

test('afterPaint waits through two animation frames so one paint can happen before heavy work resumes',async()=>{
 const clock=fakeRaf();let resolved=false;
 const promise=afterPaint(clock.raf.bind(clock)).then(()=>{resolved=true;});
 assert.equal(clock.pending,1);
 clock.step();await Promise.resolve();
 assert.equal(resolved,false);assert.equal(clock.pending,1);
 clock.step();await promise;
 assert.equal(resolved,true);
});

test('deferAfterPaint starts non-critical work only after the paint boundary',async()=>{
 const clock=fakeRaf();const calls=[];
 const promise=deferAfterPaint(()=>{calls.push('work');return 'done';},clock.raf.bind(clock));
 assert.deepEqual(calls,[]);
 clock.step();await Promise.resolve();assert.deepEqual(calls,[]);
 clock.step();assert.equal(await promise,'done');assert.deepEqual(calls,['work']);
});
