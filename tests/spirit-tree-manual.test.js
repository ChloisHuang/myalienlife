import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,tick,buyItem,serialize,restore,enqueue} from '../src/simulation.js';

function quietGame(){
 const g=createGame();g.autonomy.enabled=false;
 for(const n of Object.values(g.npcs))n.ai.enabled=false;
 for(const key in g.config.needDecay)g.config.needDecay[key]=0;
 return g;
}
test('crossing days never grows a spirit tree, even with zero random rolls',()=>{
 const g=quietGame();g.civilization.discoveryPath=['home','spore'];g.civilization.visits.spore=1;
 g.config.time.gameMinutesPerRealSecond=1;
 for(let day=0;day<5;day++){g.minute=1439;tick(g,1,()=>0);}
 assert.equal(g.day,6);assert.equal(g.objects.filter(o=>o.type==='spiritTree').length,0);
 assert.ok(!g.majorEvents.some(e=>e.text.includes('自然长出')));
});
test('existing spirit trees survive reload and remain available for prayer',()=>{
 const g=quietGame(),tree={id:'existing-tree',type:'spiritTree',x:-9,z:5,rotation:0,island:'home',side:'front',fixed:true};g.objects.push(tree);
 const loaded=restore(serialize(g));assert.deepEqual(loaded.objects.find(o=>o.id===tree.id),tree);
 assert.equal(enqueue(loaded,'pray',tree.id).ok,true);
});
test('spirit trees can still be purchased manually',()=>{
 const result=buyItem(quietGame(),'spiritTree',-9,5);
 assert.equal(result.ok,true);assert.equal(result.object.type,'spiritTree');
});
