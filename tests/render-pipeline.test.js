import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,OrthographicCamera} from 'three';
import {createPostProcessing} from '../src/npr.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

test('scene keeps four-sample antialiasing and the original bloom settings',()=>{
 const renderer={getPixelRatio:()=>1,getSize:size=>size.set(1440,1000)};
 const composer=createPostProcessing(renderer,new Scene(),new OrthographicCamera());
 assert.equal(composer.readBuffer.samples,4);
 const bloom=composer.passes.find(pass=>pass instanceof UnrealBloomPass);
 assert.equal(bloom.strength,.28);assert.equal(bloom.radius,.65);assert.equal(bloom.threshold,1.15);
 for(const target of [bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical])assert.equal(target.depthBuffer,false,'fullscreen bloom targets do not need depth attachments');
 for(const pass of composer.passes)pass.dispose();composer.dispose();
});

test('composer syncSize follows renderer DPR changes instead of keeping the startup ratio',()=>{
 let ratio=1.75;const renderer={getPixelRatio:()=>ratio,getSize:size=>size.set(1440,1000)};
 const composer=createPostProcessing(renderer,new Scene(),new OrthographicCamera());
 composer.syncSize(400,300);
 assert.deepEqual([composer.readBuffer.width,composer.readBuffer.height],[700,525]);
 ratio=1;
 composer.syncSize(400,300);
 assert.deepEqual([composer.readBuffer.width,composer.readBuffer.height],[400,300]);
 assert.equal(composer.readBuffer.samples,4,'DPR sync does not lower MSAA quality');
 for(const pass of composer.passes)pass.dispose();composer.dispose();
});
