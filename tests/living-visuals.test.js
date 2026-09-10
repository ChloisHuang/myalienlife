import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGame} from '../src/simulation.js';
import {mutableResident} from '../src/living-state.js';

test('living visuals have visible buds, an independent shadow and a bounded light field without writing state',async()=>{
 const module=await import('../src/living-visuals.js').catch(()=>null);
 assert.ok(module?.createLivingVisual,'a real render-only living visual must exist');
 const g=createGame(),p=g.player;p.island='spore';p.side='back';p.prayer.radiance=10;
 Object.assign(mutableResident(g,p),{garden:40,shadow:60,fear:50,charge:70});
 const rig={root:new THREE.Group(),joints:{LeftAntenna:new THREE.Group(),RightAntenna:new THREE.Group()}};
 const v=module.createLivingVisual(rig),before=JSON.stringify(g);
 v.update(g,p,{type:'shareLight',phase:'acting',elapsed:2},1,.1);
 assert.equal(v.buds.visible,true);assert.equal(v.shadow.visible,true);assert.equal(v.aura.visible,true);
 const count=v.root.children.length;for(let i=0;i<100;i++)v.update(g,p,null,i/10,.1);
 assert.equal(v.root.children.length,count);assert.equal(JSON.stringify(g),before);
 const old=v.shadow.position.clone();p.x+=1;v.update(g,p,null,12,.1);
 assert.notEqual(v.shadow.position.x,old.x);assert.notEqual(v.shadow.position.x,p.x);
 p.side='front';v.update(g,p,null,12,0);assert.ok(v.shadow.material.opacity<.3);
 const s=mutableResident(g,p);Object.assign(s,{garden:0,shadow:0,charge:0,fear:0});v.update(g,p,null,13,0);assert.equal(v.buds.visible,false);assert.equal(v.shadow.visible,false);
 s.imprint='bloom';v.update(g,p,null,13,0);assert.equal(v.buds.visible,true);
 s.imprint='roots';v.update(g,p,null,13,0);assert.equal(v.imprint.visible,true);
 s.imprint='shade';v.update(g,p,null,13,0);assert.equal(v.shadow.visible,true);
 v.dispose();assert.equal(v.root.parent,null);
});
