import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ensureStarIsland} from '../src/simulation.js';
import {CAPTURE_FRAME,CAPTURE_WEATHER,captureIslands,prepareIslandCapture,poseCaptureFrame} from '../tools/island-capture-fixture.js';

function source(){const g=createGame();g.civilization.discoveryPath=['home','spore'];g.civilization.visits.spore=1;ensureStarIsland(g,'spore');return g;}
test('island selection is explicit and uses the saved discovery order',()=>{
 const g=source();assert.deepEqual(captureIslands(g).map(i=>[i.number,i.id]),[[1,'home'],[2,'spore']]);
 assert.throws(()=>prepareIslandCapture(g,{islandNumber:3,side:'front',seed:1}),/不存在/);
 assert.throws(()=>prepareIslandCapture(g,{islandNumber:2,side:'wrong',seed:1}),/front/);
});
test('capture preserves objects, construction and the original save while staging residents and a UFO',()=>{
 const g=source(),before=structuredClone(g);g.civilization.projects.spore.construction=240;before.civilization.projects.spore.construction=240;
 const fixture=prepareIslandCapture(g,{islandNumber:2,side:'back',seed:42});
 poseCaptureFrame(fixture,6);
 assert.deepEqual(g,before);assert.deepEqual(fixture.state.objects,g.objects);
 assert.deepEqual(fixture.state.civilization.projects,g.civilization.projects);
 assert.equal(fixture.state.minute,720);assert.equal(fixture.state.speed,0);
 assert.deepEqual(fixture.state.space.ships.map(s=>[s.tier,s.island,s.side,s.reservedBy]),[[3,'spore','back',null]]);
 assert.ok(fixture.placements.length>1);assert.ok(fixture.placements.every(p=>p.action));
 assert.equal(CAPTURE_WEATHER.weights.spores,1);assert.deepEqual(CAPTURE_FRAME,{width:1920,height:1080});
});
test('resident staging is reproducible by seed and animation does not advance the calendar',()=>{
 const g=source(),options={islandNumber:2,side:'front',seed:42};
 const a=prepareIslandCapture(g,options),b=prepareIslandCapture(g,options),c=prepareIslandCapture(g,{...options,seed:43});
 assert.deepEqual(a.placements,b.placements);assert.notDeepEqual(a.placements,c.placements);
 poseCaptureFrame(a,0);const positions=a.placements.map(p=>p.id==='player'?a.state.player.x:a.state.npcs[p.id].x);
 poseCaptureFrame(a,6);assert.equal(a.state.minute,720);assert.equal(a.state.day,g.day);
 assert.ok(a.placements.some((p,i)=>(p.id==='player'?a.state.player.x:a.state.npcs[p.id].x)!==positions[i]));
});
