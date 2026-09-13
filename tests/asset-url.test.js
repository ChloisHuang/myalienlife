import test from 'node:test';
import assert from 'node:assert/strict';
import {versionedAsset} from '../src/asset-url.js';

test('versionedAsset changes public asset URLs for each release',()=>{
 assert.equal(versionedAsset('/assets/ocean.glb','20260913123000000'),'/assets/ocean.glb?v=20260913123000000');
 assert.equal(versionedAsset('/assets/ocean.glb',''),'/assets/ocean.glb');
});
