import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,OrthographicCamera} from 'three';
import {createPostProcessing} from '../src/npr.js';

test('scene keeps four-sample antialiasing and the original bloom settings',()=>{
 const renderer={getPixelRatio:()=>1,getSize:size=>size.set(1440,1000)};
 const composer=createPostProcessing(renderer,new Scene(),new OrthographicCamera());
 assert.equal(composer.renderTarget1.samples,4);assert.equal(composer.renderTarget2.samples,4);
 assert.equal(composer.passes[1].strength,.28);assert.equal(composer.passes[1].radius,.65);assert.equal(composer.passes[1].threshold,1.15);
 for(const pass of composer.passes)pass.dispose();composer.dispose();
});
