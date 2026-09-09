import test from 'node:test';
import assert from 'node:assert/strict';
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
