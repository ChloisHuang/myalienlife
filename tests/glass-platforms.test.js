import test from 'node:test';
import assert from 'node:assert/strict';
import {GLASS_PLATFORMS,glassPlatformHeight} from '../src/glass-platforms.js';
import {groundHeight} from '../src/characters.js';

test('residents stand on the glass and return to ground across rounded platform boundaries',()=>{
 for(const p of GLASS_PLATFORMS){
  const world=(x,z)=>[p.x+x*Math.cos(p.rotation)+z*Math.sin(p.rotation),p.z-x*Math.sin(p.rotation)+z*Math.cos(p.rotation)];
  assert.equal(groundHeight(p.x,p.z),p.height);
  assert.equal(glassPlatformHeight(...world(p.width/2-.1,0)),p.height);
  assert.equal(glassPlatformHeight(...world(p.width/2+.1,0)),null);
  assert.equal(glassPlatformHeight(...world(p.width/2-.01,p.depth/2-.01)),null);
  assert.equal(groundHeight(p.x,p.z,'back'),.29);
 }
 assert.equal(groundHeight(-10,5),-.08);
 assert.equal(groundHeight(-3,-2),.29);
});
