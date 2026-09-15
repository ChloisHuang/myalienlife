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

test('translates the global fleet, automatic return, and remote dispatch rules',()=>{
 const help='在全息研究台制造，完成后悬浮停靠在岛边外圈；全局上限等于未摧毁星岛数量（N），不限制单个星岛停靠数；只有载客航段消耗 10 耐久，耗尽到站回收；空船返航和远程调度不消耗耐久；载客抵达后 UFO 会留在当地，等待下一次调度；量子科学职业且科学满级可独自通过星门，无需飞船或食物；储备粮由星厨在所在星球制作；出发星球有在世星厨时，缺粮禁止出航，无星厨才允许扣营养和能量航行；UFO 自动导航，乘坐不限技能、种族和职业，幼体可由同行居民携带。';
 assert.match(translateText(help,'en'),/global fleet limit equals the number of intact islands \(N\)/);
 assert.match(translateText(help,'en'),/stays on that island until it is called again/);
 assert.equal(translateText('调度到露米纳星湾 · 晴昼面','en'),'Dispatch to Lumina Bay · Daylight side');
});
