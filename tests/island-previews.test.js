import test from 'node:test';
import assert from 'node:assert/strict';
import {ISLAND_PREVIEW_TTL,islandPreviewDue} from '../src/island-previews.js';

test('missing previews are due immediately',()=>{
 assert.equal(islandPreviewDue(undefined,0),true);
});
test('previews stay frozen for five real minutes including time zero',()=>{
 assert.equal(ISLAND_PREVIEW_TTL,300000);
 assert.equal(islandPreviewDue(0,299999),false);
 assert.equal(islandPreviewDue(0,300000),true);
 assert.equal(islandPreviewDue(100000,399999),false);
});
