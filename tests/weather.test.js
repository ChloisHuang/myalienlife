import test from 'node:test';
import assert from 'node:assert/strict';
import {getWeather} from '../src/weather.js';
import {createGame,tick,serialize,restore} from '../src/simulation.js';

test('weather includes clear skies, mist, rain and spore winds across a day',()=>{
 const types=new Set();for(let minute=0;minute<1440;minute+=15)types.add(getWeather({day:1,minute}).type);
 assert.deepEqual([...types].sort(),['clear','mist','rain','spores']);
});
test('weather remains continuous across changes and midnight with bounded weights',()=>{
 const before=getWeather({day:1,minute:1439.999}),after=getWeather({day:2,minute:0});
 for(const key of Object.keys(before.weights))assert.ok(Math.abs(before.weights[key]-after.weights[key])<.001);
 let previous=getWeather({day:1,minute:0});
 for(let minute=.1;minute<2880;minute+=.1){const current=getWeather({day:1,minute});
  assert.ok(Math.abs(Object.values(current.weights).reduce((a,b)=>a+b,0)-1)<1e-9);
  for(const key of Object.keys(current.weights)){assert.ok(current.weights[key]>=0&&current.weights[key]<=1);assert.ok(Math.abs(current.weights[key]-previous.weights[key])<.01);}
  previous=current;
 }
});
test('pause and save reload preserve weather; advancing simulation changes it',()=>{
 const game=createGame();game.minute=650;game.speed=0;const before=getWeather(game);
 tick(game,20);assert.deepEqual(getWeather(game),before);
 assert.deepEqual(getWeather(restore(serialize(game))),before);
 game.speed=3;tick(game,20);assert.notDeepEqual(getWeather(game).weights,before.weights);
});
