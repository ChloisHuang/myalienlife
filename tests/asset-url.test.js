import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseAssetVersions,versionedAsset} from '../src/asset-url.js';
import {createAssetVersions} from '../scripts/build-release.js';

test('versionedAsset uses a per-file content version map',()=>{
 const versions={'/assets/ocean.glb':'ocean-hash'};
 assert.equal(versionedAsset('/assets/ocean.glb',versions),'/assets/ocean.glb?v=ocean-hash');
 assert.equal(versionedAsset('/assets/alien.glb',versions),'/assets/alien.glb');
 assert.deepEqual(parseAssetVersions(JSON.stringify(versions)),versions);
 assert.deepEqual(parseAssetVersions('not-json'),{});
});

test('asset versions stay stable for unchanged files and change only with file contents',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-asset-versions-'));
 try{
  await mkdir(join(directory,'nested'));
  await writeFile(join(directory,'a.glb'),'alpha');await writeFile(join(directory,'nested','b.webp'),'beta');
  const first=await createAssetVersions(directory),second=await createAssetVersions(directory);
  assert.deepEqual(second,first);
  await writeFile(join(directory,'a.glb'),'changed');
  const third=await createAssetVersions(directory);
  assert.notEqual(third['/assets/a.glb'],first['/assets/a.glb']);
  assert.equal(third['/assets/nested/b.webp'],first['/assets/nested/b.webp']);
 }finally{await rm(directory,{recursive:true,force:true});}
});
