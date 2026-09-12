import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldAnimateActor} from '../src/actor-animation-visibility.js';

test('visible actor on the current island face keeps full animation',()=>{
 assert.equal(shouldAnimateActor({person:{island:'spore',side:'front'},viewIsland:'spore',viewSide:'front'}),true);
});

test('actor on another island skips full animation',()=>{
 assert.equal(shouldAnimateActor({person:{island:'home',side:'front'},viewIsland:'spore',viewSide:'front'}),false);
});

test('actor on the hidden face skips full animation while the island is settled',()=>{
 assert.equal(shouldAnimateActor({person:{island:'spore',side:'back'},viewIsland:'spore',viewSide:'front'}),false);
});

test('both island faces animate while the island is flipping',()=>{
 assert.equal(shouldAnimateActor({person:{island:'spore',side:'back'},viewIsland:'spore',viewSide:'front',flipping:true}),true);
});

test('blink and onboard presentation keep animation enabled even away from the current face',()=>{
 const base={person:{island:'home',side:'back'},viewIsland:'spore',viewSide:'front'};
 assert.equal(shouldAnimateActor({...base,blinkTransit:true}),true);
 assert.equal(shouldAnimateActor({...base,onboard:true}),true);
});
