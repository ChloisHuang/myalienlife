import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLanguage,resolveLanguage,translateText} from '../src/i18n.js';
test('repeated translations reuse dictionary results and keep languages independent',()=>{
 const source='第 987654 天';let splits=0;
 const split=String.prototype.split;
 String.prototype.split=function(...args){splits++;return split.apply(this,args);};
 try{
  assert.equal(translateText(source,'en'),'Day 987654');assert.ok(splits>0);
  splits=0;assert.equal(translateText(source,'en'),'Day 987654');assert.equal(splits,0);
  assert.equal(translateText(source,'zh'),source);
  assert.equal(translateText('Day 987654','zh'),source);
 }finally{String.prototype.split=split;}
});

test('normalizes system language to the supported Chinese or English locale',()=>{
 assert.equal(normalizeLanguage('zh-CN'),'zh');
 assert.equal(normalizeLanguage('en-US'),'en');
 assert.equal(normalizeLanguage('fr-FR'),'en');
});

test('manual language selection takes precedence over the system language',()=>{
 assert.equal(resolveLanguage({stored:'en',system:'zh-CN'}),'en');
 assert.equal(resolveLanguage({stored:null,system:'zh-TW'}),'zh');
 assert.equal(resolveLanguage({stored:'unknown',system:'en-US'}),'en');
});

test('translates visible day labels in both directions',()=>{
 assert.equal(translateText('第 3 天','en'),'Day 3');
 assert.equal(translateText('Day 3','zh'),'第 3 天');
});

test('localizes resident names without changing their saved Chinese names',()=>{
 assert.equal(translateText('凯伊','en'),'Kai');
 assert.equal(translateText('Kai','zh'),'凯伊');
 assert.equal(translateText('洛瓦','en'),'Lo-Va');
 assert.equal(translateText('Lo-Va','zh'),'洛瓦');
});

test('uses compact English labels for the resident panel tabs',()=>{
 assert.equal(translateText('人物','en'),'Bio');
 assert.equal(translateText('Bio','zh'),'人物');
 assert.equal(translateText('关系','en'),'Rels.');
 assert.equal(translateText('Rels.','zh'),'关系');
});

test('translates dynamic resident, interaction, save, and radio text',()=>{
 assert.equal(translateText('外向 · 浪漫','en'),'Outgoing · Romantic');
 assert.equal(translateText('档案','en'),'Dossier');
 assert.equal(translateText('友好度 100','en'),'Affinity 100');
 assert.equal(translateText('对方：熟悉的同伴','en'),'Other: Familiar companion');
 assert.equal(translateText('给植物补水，让它健康生长','en'),'Water the plant so it grows healthy');
 assert.equal(translateText('Mi-You出生了！Pip的星芽成为星湾的新居民，请照料这位幼体。','en'),"Mi-You was born! Pip's starbud is now a new resident of the bay. Please care for this infant.");
 assert.equal(translateText('已自动保存 · 07:47:13','en'),'Autosaved · 07:47:13');
});

test('translates hosted access status labels',()=>{
 assert.equal(translateText('访客 · 只读','en'),'Guest · read-only');
 assert.equal(translateText('已验证 · 只读','en'),'Verified · read-only');
});
