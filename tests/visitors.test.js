import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createVisitors} from '../server/visitors.js';

test('visitor sessions, daily unique IPs, country counts and persistence',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-visitors-'));let now=Date.UTC(2026,8,9,0);
 try{
  const v=await createVisitors({directory,now:()=>now,lookup:()=>({country:'CN'})});
  v.record('1.2.3.4');v.record('1.2.3.4');v.record('2.3.4.5');
  assert.equal(v.summary().totalVisits,2);assert.equal(v.summary().days.at(-1).visitors,2);
  now+=31*60000;v.record('1.2.3.4');assert.equal(v.summary().totalVisits,3);
  assert.equal(v.summary().days.at(-1).visitors,2);assert.equal(v.summary().countries[0].visits,3);
  await v.close();assert.ok(!(await readFile(join(directory,'visitors.json'),'utf8')).includes('1.2.3.4'));
  const restored=await createVisitors({directory,now:()=>now});assert.equal(restored.summary().totalVisits,3);
  now+=32*86400000;restored.record('1.2.3.4');assert.equal(restored.summary().days.length,30);
  assert.equal(restored.summary().totalVisits,4);await restored.close();
 }finally{await rm(directory,{recursive:true,force:true});}
});
