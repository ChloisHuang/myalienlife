import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('ocean seating ships a tall wave backrest within its authored bounds',()=>{
 const bytes=readFileSync(new URL('../public/assets/ocean.glb',import.meta.url));
 const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 const node=gltf.nodes.find(n=>n.name==='ocean-sofa');
 assert.ok(node,'ocean sofa remains available to the island skin loader');
 const primitives=gltf.meshes[node.mesh].primitives;
 const bounds=primitives.map(p=>gltf.accessors[p.attributes.POSITION]);
 assert.ok(Math.max(...bounds.map(b=>b.max[1]))>3.7,'the raised central crest keeps its new head clearance');
 assert.ok(Math.max(...bounds.map(b=>b.max[2]))<2.1,'bench stays within its authored width');
 assert.ok(Math.min(...bounds.map(b=>b.min[2]))>-2.1,'bench stays within its authored width');
 assert.ok(primitives.some(p=>gltf.materials[p.material].name==='wave foam'),'white foam is exported');
});
