import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/simulation.js';
import {createUfoVisual,ufoDock,ufoFlightPresentation,UFO_HOVER_HEIGHT,ufoPassengerPresentation,createUfoTransferBeam} from '../src/ufo-visuals.js';
function fixture(){const g=createGame();g.space.ships=[{id:'flight-test',tier:2,island:'home',side:'front',food:4,reservedBy:99}];g.queue=[{id:99,type:'voyage',phase:'acting',elapsed:0,destinationId:'spore',passengerUids:[]}];return g;}
test('UFO flight rises and recedes, then approaches the destination and docks without a position jump',()=>{
 const g=fixture(),ship=g.space.ships[0],duration=g.config.actionDurations.voyage;
 const start=ufoFlightPresentation(g,ship);assert.equal(start.y,ufoDock(g,ship).y);assert.equal(start.scale,1);
 g.queue[0].elapsed=duration*.4;const departure=ufoFlightPresentation(g,ship);assert.equal(departure.island,'home');assert.ok(departure.y>start.y);assert.ok(departure.scale<1);
 g.queue[0].elapsed=duration*.5;const cruise=ufoFlightPresentation(g,ship);assert.equal(cruise.island,'spore');assert.equal(cruise.scale,0);assert.ok(cruise.route.includes('→'));
 g.queue[0].elapsed=duration*.85;const landing=ufoFlightPresentation(g,ship);assert.equal(landing.stage,'光束放下');assert.ok(landing.scale>cruise.scale);assert.ok(landing.y<cruise.y);
 assert.deepEqual(ufoFlightPresentation(JSON.parse(JSON.stringify(g)),ship),landing);
 g.queue[0].elapsed=duration;const end=ufoFlightPresentation(g,ship);ship.island='spore';ship.reservedBy=null;g.queue=[];const dock=ufoFlightPresentation(g,ship);assert.equal(end.x,dock.x);assert.equal(end.y,dock.y);assert.equal(end.z,dock.z);assert.equal(end.scale,dock.scale);
});
test('queued and cancelled flights keep the UFO at its dock',()=>{
 const g=fixture(),ship=g.space.ships[0];g.queue[0].phase='waiting';let state=ufoFlightPresentation(g,ship);assert.equal(state.flying,false);assert.equal(state.stage,'等待登船');assert.equal(state.x,ufoDock(g,ship).x);
 ship.reservedBy=null;g.queue=[];state=ufoFlightPresentation(g,ship);assert.equal(state.stage,'悬浮停靠');assert.equal(state.scale,1);
});
test('all UFO tiers use hull fluorescence with no detached orbit or light cone',()=>{
 for(const tier of [1,2,3]){const visual=createUfoVisual(tier);assert.ok(visual.root.getObjectByName('hull-fluorescent-strip'));visual.root.traverse(node=>{if(node.geometry?.type==='TorusGeometry')assert.ok(node.geometry.parameters.radius<1.6);assert.notEqual(node.material?.blending,2);});visual.update(1,12);assert.equal(visual.root.userData.foodStatus,'full');visual.update(.2,13);assert.equal(visual.root.userData.foodStatus,'partial');visual.dispose();}
});

test('parking is outside the island, varied in height and stable when other ships leave',()=>{
 const g=fixture(),ship=g.space.ships[0],dock=ufoDock(g,ship);assert.ok((dock.x/15.4)**2+(dock.z/10.9)**2>1);assert.ok(dock.y>=UFO_HOVER_HEIGHT&&dock.y<=UFO_HOVER_HEIGHT+.8);g.space.ships.unshift({id:'other',tier:1,island:'home',side:'front'});assert.deepEqual(ufoDock(g,ship),dock);assert.notEqual(ufoDock(g,g.space.ships[0]).y,dock.y);
});
test('passengers rise into the beam, stay hidden in flight and lower onto the landing spot',()=>{
 const g=fixture(),ship=g.space.ships[0],duration=g.config.actionDurations.voyage,frame=p=>{g.queue[0].elapsed=p*duration;return ufoFlightPresentation(g,ship);};
 const low=ufoPassengerPresentation(frame(.13),g.player),high=ufoPassengerPresentation(frame(.26),g.player);assert.ok(high.y>low.y);assert.ok(high.scale<low.scale);assert.equal(ufoPassengerPresentation(frame(.4),g.player).visible,false);
 const above=ufoPassengerPresentation(frame(.71),g.player),below=ufoPassengerPresentation(frame(.85),g.player);assert.ok(above.y>below.y);assert.ok(above.scale<below.scale);assert.equal(below.island,'spore');
 const beam=createUfoTransferBeam();beam.update(frame(.2));assert.equal(beam.root.visible,true);beam.update(frame(.4));assert.equal(beam.root.visible,false);beam.dispose();
});
