import test from 'node:test';
import assert from 'node:assert/strict';
import {localPoint} from '../src/viewport.js';

test('portrait landscape coordinates map screen corners back to the horizontal scene',()=>{
 const rect={left:10,top:20,right:370,width:360,height:800};
 assert.deepEqual(localPoint(rect,370,20,true),{x:0,y:0});
 assert.deepEqual(localPoint(rect,10,820,true),{x:800,y:360});
 assert.deepEqual(localPoint(rect,190,420,true),{x:400,y:180});
 assert.deepEqual(localPoint(rect,190,420,false),{x:180,y:400});
});
