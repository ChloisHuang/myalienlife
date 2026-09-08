import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,serialize,restore,sellItem,enqueue} from '../src/simulation.js';
import {PerspectiveCamera,Quaternion} from 'three';
import {createSpiritTree} from '../src/spirit-tree.js';

test('tree blessing eye opens only on success, freezes with elapsed time and closes at the end',()=>{
 const tree=createSpiritTree(),visual=tree.userData.spiritTree,camera=new PerspectiveCamera();camera.position.set(8,5,10);camera.lookAt(0,2.8,0);
 const action={type:'pray',phase:'acting',elapsed:1};
 visual.updateBlessing(action,camera);assert.equal(visual.eye.visible,false);
 action.phase='celebrating';action.blessing={side:'front'};action.elapsed=0;
 visual.updateBlessing(action,camera);const uniforms=visual.eye.material.uniforms;assert.equal(uniforms.opening.value,0);
 action.elapsed=1;visual.updateBlessing(action,camera);assert.equal(visual.eye.visible,true);assert.equal(uniforms.opening.value,1);
 const front=uniforms.tint.value.getHex(),snapshot=JSON.stringify(uniforms);visual.updateBlessing(action,camera);assert.equal(JSON.stringify(uniforms),snapshot);
 tree.rotation.set(Math.PI,.7,0);action.blessing.side='back';visual.updateBlessing(action,camera);
 assert.notEqual(uniforms.tint.value.getHex(),front);assert.ok(visual.eye.getWorldQuaternion(new Quaternion()).angleTo(camera.quaternion)<1e-6);
 action.elapsed=4;visual.updateBlessing(action,camera);assert.equal(visual.eye.visible,false);
 visual.updateBlessing(undefined,camera);assert.equal(visual.eye.visible,false);visual.dispose();
});

test('spirit trees can be bought on both faces, prayed at, saved and sold independently',()=>{
 const game=createGame();
 const front=buyItem(game,'spiritTree',0,5,Math.PI/2);
 assert.equal(front.ok,true);
 game.viewSide='back';
 const back=buyItem(game,'spiritTree',0,5);
 assert.equal(back.ok,true);
 assert.equal(enqueue(game,'pray',back.object.id).ok,true);
 const loaded=restore(serialize(game));
 assert.deepEqual(loaded.objects.filter(o=>o.type==='spiritTree'),[front.object,back.object]);
 const money=loaded.money;
 assert.equal(sellItem(loaded,front.object.id),true);
 assert.ok(loaded.money>money);
 assert.equal(loaded.objects.filter(o=>o.type==='spiritTree').length,1);
 assert.equal(loaded.objects.find(o=>o.type==='spiritTree').side,'back');
});
