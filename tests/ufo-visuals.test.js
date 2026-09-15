import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/simulation.js';
import {islandDefinition} from '../src/civilization.js';
import {groundHeight} from '../src/characters.js';
import {ufoHoverMotion,createUfoVisual,ufoDock,ufoFlightPresentation,UFO_HOVER_HEIGHT,ufoPassengerPresentation,createUfoTransferBeam,ufoRepark,ufoPlacement} from '../src/ufo-visuals.js';
function fixture(){const g=createGame();g.space.ships=[{id:'flight-test',tier:2,island:'eva',side:'front',food:4,durability:100,reservedBy:99}];g.queue=[{id:99,type:'voyage',phase:'acting',elapsed:0,destinationId:'spore',passengerUids:[]}];return g;}
test('every moving leg leans along travel, brakes back and levels at transfers',()=>{
 const g=fixture(),ship=g.space.ships[0],frame=p=>{g.queue[0].elapsed=p*g.config.actionDurations.voyage;return ufoFlightPresentation(g,ship);};
 for(const [start,end] of [[0,.12],[.28,.5],[.5,.70],[.86,1]]){
  const a=frame(start+(end-start)*.25),b=frame(start+(end-start)*.26),brake=frame(start+(end-start)*.9);
  const dx=b.x-a.x,dz=b.z-a.z;
  assert.ok(-a.roll*dx+a.pitch*dz>0,'accelerating tilt must follow travel direction');
  assert.ok(-brake.roll*dx+brake.pitch*dz<0,'braking tilt must oppose travel');
  assert.ok(Math.hypot(a.pitch,a.roll)<.4);
 }
 for(const p of [0,.12,.2,.28,.5,.70,.8,.86,1]){const f=frame(p);assert.ok(Math.hypot(f.pitch,f.roll)<1e-8);}
});
test('all dock slots stay on the screen-left outer arc on either island face',()=>{
 const g=createGame();
 for(const island of ['eva','spore'])for(const side of ['front','back']){
  g.space.ships=Array.from({length:24},(_,i)=>({id:`left-dock-${i}`,tier:i%3+1,island,side}));
  const outline=islandDefinition(g,island).outline,rx=outline?Math.max(...outline.map(p=>Math.abs(p.x))):15.4,rz=outline?Math.max(...outline.map(p=>Math.abs(p.z))):10.9;
  for(const ship of g.space.ships){const dock=ufoDock(g,ship);assert.ok(dock.x<0&&dock.z>0,`${island}/${side}: ${dock.x}, ${dock.z}`);assert.ok((dock.x/rx)**2+(dock.z/rz)**2>1);}
 }
});
test('UFO flight rises and recedes, then approaches the destination and docks without a position jump',()=>{
 const g=fixture(),ship=g.space.ships[0],duration=g.config.actionDurations.voyage;
 const start=ufoFlightPresentation(g,ship);assert.equal(start.y,ufoDock(g,ship).y);assert.equal(start.scale,1);
 g.queue[0].elapsed=duration*.4;const departure=ufoFlightPresentation(g,ship);assert.equal(departure.island,'eva');assert.ok(departure.y>start.y);assert.ok(departure.scale<1);
 g.queue[0].elapsed=duration*.5;const cruise=ufoFlightPresentation(g,ship);assert.equal(cruise.island,'spore');assert.equal(cruise.scale,0);assert.ok(cruise.route.includes('→'));
 g.queue[0].elapsed=duration*.85;const landing=ufoFlightPresentation(g,ship);assert.equal(landing.stage,'光束放下');assert.ok(landing.scale>cruise.scale);assert.ok(landing.y<cruise.y);
 assert.deepEqual(ufoFlightPresentation(JSON.parse(JSON.stringify(g)),ship),landing);
 g.queue[0].elapsed=duration;const end=ufoFlightPresentation(g,ship);ship.island='spore';ship.reservedBy=null;g.queue=[];const dock=ufoFlightPresentation(g,ship);assert.equal(end.x,dock.x);assert.equal(end.y,dock.y);assert.equal(end.z,dock.z);assert.equal(end.scale,dock.scale);
});
test('queued and cancelled flights keep the UFO at its dock',()=>{
 const g=fixture(),ship=g.space.ships[0];g.queue[0].phase='waiting';let state=ufoFlightPresentation(g,ship);assert.equal(state.flying,false);assert.equal(state.stage,'等待登船');assert.equal(state.x,ufoDock(g,ship).x);
 ship.reservedBy=null;g.queue=[];state=ufoFlightPresentation(g,ship);assert.equal(state.stage,'悬浮停靠');assert.equal(state.scale,1);
});
test('empty return and dispatch flights reuse the inter-island UFO motion without passenger beams',()=>{
 const g=createGame(),ship={id:'empty-flight',tier:2,island:'spore',side:'front',food:0,durability:80,reservedBy:null};g.space.ships=[ship];
 ship.flight={kind:'return',from:{island:'spore',side:'front'},to:{island:'eva',side:'front'},elapsed:0,duration:6};
 const start=ufoFlightPresentation(g,ship);assert.equal(start.island,'spore');assert.equal(start.scale,1);assert.equal(start.beam,0);assert.deepEqual(start.crew,[]);
 ship.flight.elapsed=3;const cruise=ufoFlightPresentation(g,ship);assert.equal(cruise.island,'eva');assert.ok(cruise.scale<.05);assert.match(cruise.route,/→/);
 ship.flight.elapsed=6;const end=ufoFlightPresentation(g,ship),targetDock=ufoDock(g,{...ship,island:'eva',side:'front'});assert.equal(end.island,'eva');assert.equal(end.x,targetDock.x);assert.equal(end.y,targetDock.y);assert.equal(end.z,targetDock.z);assert.equal(end.scale,1);
 ship.flight={kind:'dispatch',from:{island:'eva',side:'front'},to:{island:'spore',side:'front'},elapsed:1,duration:6};assert.match(ufoFlightPresentation(g,ship).stage,/调度/);
});
test('a re-parked UFO glides to its new slot instead of snapping',()=>{
 const from={x:-9.41,y:4.93,z:9.48},to={x:-15.77,y:4.93,z:2.54};
 const step=ufoRepark(from,to,.05);assert.ok(step.x<from.x&&step.x>to.x,'lateral glide is gradual');assert.ok(step.z<from.z&&step.z>to.z);
 const settled=ufoRepark(from,to,10);assert.ok(Math.abs(settled.x-to.x)<1e-3&&Math.abs(settled.z-to.z)<1e-3,'a long frame still lands exactly on the slot');
 const lift=ufoRepark({x:0,y:4.9,z:0},{x:0,y:8.3,z:0},.05);assert.ok(lift.y>4.9&&lift.y<8.3,'a layer change rises instead of jumping');
 const stay=ufoRepark(to,to,.05);assert.deepEqual(stay,to);
});
test('a parked UFO glides to a re-computed berth but follows its own flight path exactly',()=>{
 const parked=(x,y,z)=>({x,y,z,berth:'eva/front'}),parkedFlight={island:'eva',side:'front',x:0,y:5,z:0,flying:false};
 const first=ufoPlacement(undefined,parkedFlight,.05);assert.deepEqual(first,{x:0,y:5,z:0,berth:'eva/front'},'a ship without an anchor is placed at once');
 const gliding=ufoPlacement(parked(9,5,0),parkedFlight,.05);assert.ok(gliding.x<9&&gliding.x>0,'a re-parked neighbour glides toward the new slot');
 const flying=ufoPlacement(parked(9,5,0),{...parkedFlight,x:2,y:7,z:-3,flying:true},.05);
 assert.deepEqual(flying,{x:2,y:7,z:-3,berth:'eva/front'},'a travelling saucer follows its flight path exactly');
 const boarded=ufoPlacement(parked(9,5,0),{...parkedFlight,island:'spore',side:'front',x:1,y:5,z:1},.05);
 assert.deepEqual(boarded,{x:1,y:5,z:1,berth:'spore/front'},'another island face snaps instead of flying across the world');
});
test('a passenger leg clears the island before it shrinks away and before it grows back',()=>{
 const g=fixture(),ship=g.space.ships[0],duration=g.config.actionDurations.voyage,footprint=point=>(point.x/15.4)**2+(point.z/10.9)**2;
 g.queue[0].elapsed=duration*.5-.001;const leaving=ufoFlightPresentation(g,ship);
 assert.ok(leaving.scale<.02);assert.ok(footprint(leaving)>1,`takeoff must clear the island before vanishing: ${leaving.x}, ${leaving.z}`);
 g.queue[0].elapsed=duration*.5;const entering=ufoFlightPresentation(g,ship);
 assert.ok(entering.scale<.02);assert.ok(footprint(entering)>1,`arrival must grow back outside the island: ${entering.x}, ${entering.z}`);
 assert.ok(leaving.x>0&&entering.x<0&&leaving.z<2&&entering.z<2,'the leg still flies out to the upper right and returns in from the upper left');
 g.queue[0].elapsed=duration*(.28+.22*.35);const climbing=ufoFlightPresentation(g,ship);
 assert.ok(climbing.y>UFO_HOVER_HEIGHT+1+6,`takeoff must climb clear of the village roofs: y=${climbing.y.toFixed(2)}`);
});
test('all UFO tiers use hull fluorescence with no detached orbit or light cone',()=>{
 for(const tier of [1,2,3]){const visual=createUfoVisual(tier);assert.ok(visual.root.getObjectByName('hull-fluorescent-strip'));visual.root.traverse(node=>{if(node.geometry?.type==='TorusGeometry')assert.ok(node.geometry.parameters.radius<1.6);assert.notEqual(node.material?.blending,2);});visual.update(1,12);assert.equal(visual.root.userData.foodStatus,'full');visual.update(.2,13);assert.equal(visual.root.userData.foodStatus,'partial');visual.dispose();}
});

test('parking is outside the island, varied in height and stable when other ships leave',()=>{
 const g=fixture(),ship=g.space.ships[0],dock=ufoDock(g,ship);assert.ok((dock.x/15.4)**2+(dock.z/10.9)**2>1);assert.ok(dock.y>=UFO_HOVER_HEIGHT&&dock.y<=UFO_HOVER_HEIGHT+.8);g.space.ships.unshift({id:'other',tier:1,island:'eva',side:'front'});assert.deepEqual(ufoDock(g,ship),dock);assert.notEqual(ufoDock(g,g.space.ships[0]).y,dock.y);
});
test('passengers rise into the beam, stay hidden in flight and lower onto the landing spot',()=>{
 const g=fixture(),ship=g.space.ships[0],duration=g.config.actionDurations.voyage,frame=p=>{g.queue[0].elapsed=p*duration;return ufoFlightPresentation(g,ship);};
 const low=ufoPassengerPresentation(frame(.13),g.player),high=ufoPassengerPresentation(frame(.26),g.player);assert.ok(high.y>low.y);assert.ok(high.scale<low.scale);assert.equal(ufoPassengerPresentation(frame(.4),g.player).visible,false);
 const above=ufoPassengerPresentation(frame(.71),g.player),below=ufoPassengerPresentation(frame(.85),g.player);assert.ok(above.y>below.y);assert.ok(above.scale<below.scale);assert.equal(below.island,'spore');
 const beam=createUfoTransferBeam();beam.update(frame(.2));assert.equal(beam.root.visible,true);beam.update(frame(.4));assert.equal(beam.root.visible,false);beam.dispose();
});
test('the transfer beam starts only after the saucer has arrived and then unfolds down from it',()=>{
 const g=fixture(),ship=g.space.ships[0],duration=g.config.actionDurations.voyage,dt=1/60;
 let anchor=null,start=null,stages=new Set();
 for(let step=0;step<=Math.ceil(duration/dt);step++){
  g.queue[0].elapsed=Math.min(duration,step*dt);const flight=ufoFlightPresentation(g,ship);anchor=ufoPlacement(anchor,flight,dt);
  assert.deepEqual({x:anchor.x,y:anchor.y,z:anchor.z},{x:flight.x,y:flight.y,z:flight.z},'a travelling saucer follows its own path, so it can never trail its beam');
  if(flight.beam>0){stages.add(flight.stage);start??=flight;}
 }
 assert.deepEqual([...stages],['光束吸入','光束放下'],'the beam appears on the pickup and the drop-off leg only');
 assert.ok(start.beam<1,'the beam unfolds instead of switching on at full strength');
 assert.deepEqual({x:start.x,y:start.y,z:start.z},{x:start.pickup.x,y:start.pickup.y,z:start.pickup.z},'the saucer already hovers over the spot when the beam starts');
 const beam=createUfoTransferBeam();beam.update(start);const cone=beam.root.children[0],ground=groundHeight(start.pickup.x,start.pickup.z,start.side,start.island),full=start.y-.7-ground,top=()=>beam.root.position.y+cone.position.y+cone.scale.y/2,frame=p=>{g.queue[0].elapsed=p*duration;return ufoFlightPresentation(g,ship);};
 assert.ok(start.beam<1&&cone.scale.y<full,'the cone hangs short at first');assert.ok(Math.abs(top()-(start.y-.7))<1e-9,'the cone stays attached to the saucer as it unfolds');
 beam.update(frame(.2));assert.ok(Math.abs(cone.scale.y-full)<1e-9,'the cone reaches the ground once the beam is fully emitted');
 beam.update(frame(.4));assert.equal(beam.root.visible,false);beam.dispose();
});


test('hover drifts and tilts gently on all axes with unique smooth headings per ship',()=>{
 const idle={flying:false,progress:0},a=ufoHoverMotion('ship-a',100,idle),b=ufoHoverMotion('ship-b',100,idle);
 assert.notDeepEqual(a,b);assert.deepEqual(a,ufoHoverMotion('ship-a',100,idle));
 for(let t=0;t<300;t+=.25){const m=ufoHoverMotion('ship-a',t,idle),next=ufoHoverMotion('ship-a',t+.001,idle);assert.ok(Math.abs(m.x)<=.15&&Math.abs(m.y)<=.13&&Math.abs(m.z)<=.12);assert.ok(Math.abs(m.pitch)<=.035&&Math.abs(m.roll)<=.045);for(const key of Object.keys(m))assert.ok(Math.abs(next[key]-m[key])<.001);}
 for(const key of Object.keys(a))assert.notEqual(a[key],ufoHoverMotion('ship-a',110,idle)[key]);
});
test('hover settles for boarding and fades back into the same parked motion after landing',()=>{
 const at=p=>ufoHoverMotion('ship-a',100,{flying:true,progress:p}),idle=ufoHoverMotion('ship-a',100,{flying:false});
 assert.deepEqual(at(0),idle);assert.deepEqual(at(1),idle);for(const p of [.12,.2,.5,.8,.86]){const m=at(p);for(const key of ['x','y','z','pitch','roll'])assert.equal(Math.abs(m[key]),0);}
});

test('parked fleets keep hull and hover clearance using height when the narrow outer arc fills',()=>{
 const g=createGame();g.space.ships=Array.from({length:24},(_,i)=>({id:`parked-${i}`,tier:i%3+1,island:'eva',side:'front'}));
 const docks=g.space.ships.map(s=>({...ufoDock(g,s),radius:1.58*(.85+s.tier*.18)}));
 for(let i=0;i<docks.length;i++)for(let j=0;j<i;j++){const a=docks[i],b=docks[j];assert.ok(Math.abs(a.y-b.y)>=2.6||Math.hypot(a.x-b.x,a.z-b.z)>=a.radius+b.radius+.8);}
 const original=ufoDock(g,g.space.ships[5]);g.space.ships.reverse();assert.deepEqual(ufoDock(g,g.space.ships.find(s=>s.id==='parked-5')),original);
});

test('UFO core and hull lights emit only during active flight and turn off again while waiting',()=>{
 const g=fixture(),ship=g.space.ships[0],visual=createUfoVisual(ship.tier),core=visual.root.getObjectByName('fluorescent-core'),strip=visual.root.getObjectByName('hull-fluorescent-strip');
 const frame=()=>visual.update(.5,12,ufoFlightPresentation(g,ship).flying);
 g.queue[0].phase='waiting';frame();visual.root.traverse(n=>{if(n.isMesh&&n.material.emissive?.getHex()!==0)assert.equal(n.material.emissiveIntensity,0);});
 g.queue[0].phase='acting';frame();assert.ok(core.material.emissiveIntensity>2);assert.ok(strip.material.emissiveIntensity>1);for(let i=0;i<8;i++)assert.ok(visual.root.getObjectByName(`food-segment-${i}`).material.emissiveIntensity>1);
 ship.reservedBy=null;g.queue=[];frame();assert.equal(core.material.emissiveIntensity,0);assert.equal(strip.material.emissiveIntensity,0);visual.dispose();
});
