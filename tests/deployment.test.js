import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deploymentConfig} from '../scripts/deploy-config.js';
test('deployment configuration rejects shell injection and conflicting private/public ports',()=>{
 const c={host:'192.0.2.10',sshPort:22,user:'root',domain:'game.example.com',httpsPort:6443,backendPort:18080};
 assert.equal(deploymentConfig(c).origin,'https://game.example.com:6443');
 for(const change of [{host:'host;id'},{domain:'a/../b'},{user:'root x'},{httpsPort:22},{backendPort:6443},{sshPort:0}])assert.throws(()=>deploymentConfig({...c,...change}));
});
test('deployment requires explicit private server identity',()=>{
 const c={host:'192.0.2.10',sshPort:22,user:'root',domain:'game.example.com'};
 assert.throws(()=>deploymentConfig({}));
 for(const key of ['host','domain','user','sshPort']){
  const incomplete={...c};delete incomplete[key];
  assert.throws(()=>deploymentConfig(incomplete));
 }
 assert.equal(deploymentConfig(c).backendPort,18080);
});

test('production serves Draco WebAssembly decoders with the correct MIME type',async()=>{
 const {createHttpService}=await import('../server/http-service.js');const directory=await mkdtemp(join(tmpdir(),'orbit-static-'));let service;
 try{
  const wasm=Buffer.from([0,97,115,109,1,0,0,0]);await mkdir(join(directory,'assets','draco'),{recursive:true});await writeFile(join(directory,'assets','draco','draco_decoder.wasm'),wasm);
  service=await createHttpService({directory,dist:directory,token:'static-test-token',origin:'http://game.example',autoStart:false});await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  const response=await fetch(`http://127.0.0.1:${service.server.address().port}/assets/draco/draco_decoder.wasm`);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/wasm');assert.deepEqual(Buffer.from(await response.arrayBuffer()),wasm);
 }finally{await service?.close();await rm(directory,{recursive:true,force:true});}
});

test('production CSP permits WebAssembly decoder compilation without enabling JavaScript eval',async()=>{
 const {createHttpService}=await import('../server/http-service.js');const directory=await mkdtemp(join(tmpdir(),'orbit-csp-'));let service;
 try{
  service=await createHttpService({directory,dist:directory,token:'csp-test-token',origin:'http://game.example',autoStart:false});await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  const response=await fetch(`http://127.0.0.1:${service.server.address().port}/api/state`);const policy=response.headers.get('content-security-policy')??'';
  assert.match(policy,/script-src 'self' 'wasm-unsafe-eval'/);assert.doesNotMatch(policy,/script-src[^;]*'unsafe-eval'/);
 }finally{await service?.close();await rm(directory,{recursive:true,force:true});}
});
