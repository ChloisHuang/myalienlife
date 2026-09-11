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

test('multisampling keeps scene depth testing without copying unused depth into postprocessing',()=>{
 const renderer={getPixelRatio:()=>1.75,getSize:size=>size.set(1440,1000)};
 const composer=createPostProcessing(renderer,new Scene(),new OrthographicCamera());
 for(let frame=0;frame<3;frame++){
  assert.equal(composer.readBuffer.samples,4,'every scene frame retains MSAA');
  assert.equal(composer.readBuffer.depthBuffer,true,'geometry retains depth testing');
  assert.equal(composer.readBuffer.resolveDepthBuffer,false,'postprocessing does not sample depth');
  assert.equal(composer.readBuffer.resolveStencilBuffer,false);
  for(const pass of composer.passes){
   if(pass.needsSwap)composer.swapBuffers();
  }
 }
 composer.setSize(390,844);
 assert.equal(composer.readBuffer.samples,4);
 for(const pass of composer.passes)pass.dispose();composer.dispose();
});
