import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {injectAnalyticsIntoDist,injectAnalyticsSnippet,readAnalyticsSnippet} from '../scripts/deploy-analytics.js';

const snippet=`<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"></script>
<script>gtag('config', 'G-TEST123');</script>`;

test('deployment injects one analytics snippet after the opening head tag in every HTML page',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-analytics-'));
 try{
  await mkdir(join(directory,'nested'),{recursive:true});
  await writeFile(join(directory,'index.html'),'<html><head><title>Home</title></head><body></body></html>');
  await writeFile(join(directory,'nested','page.html'),'<html><head data-page="nested"></head><body></body></html>');
  await injectAnalyticsIntoDist(directory,snippet);
  for(const file of [join(directory,'index.html'),join(directory,'nested','page.html')]){
   const html=await readFile(file,'utf8');
   assert.equal((html.match(/googletagmanager\.com\/gtag\/js/g)??[]).length,1);
   assert.match(html,/<head(?: data-page="nested")?>\n<!-- Google tag \(gtag\.js\) -->/);
  }
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('deployment reads the analytics snippet from a local file and rejects incomplete fragments',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-analytics-snippet-'));
 try{
  const file=join(directory,'google-analytics-head.html');
  await writeFile(file,snippet);
  assert.equal(await readAnalyticsSnippet(file),snippet);
  await writeFile(file,'<script>console.log("not analytics")</script>');
  await assert.rejects(readAnalyticsSnippet(file),/Google tag script and a gtag config call/);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('deployment refuses to add a second Google tag to a page',()=>{
 const html='<html><head><script src="https://www.googletagmanager.com/gtag/js?id=G-EXISTING"></script></head></html>';
 assert.throws(()=>injectAnalyticsSnippet(html,snippet),/already contains a Google tag/);
});
