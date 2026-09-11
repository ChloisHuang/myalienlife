import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const headTag=/<head\b[^>]*>/i;
const analyticsMarker=/googletagmanager\.com\/gtag\/js|gtag\s*\(\s*['"]config['"]/i;

function validateSnippet(snippet){
 const value=typeof snippet==='string'?snippet.trim():'';
 if(!value||!/<script\b/i.test(value)||!/googletagmanager\.com\/gtag\/js/i.test(value)||!/gtag\s*\(\s*['"]config['"]/i.test(value))throw new Error('Analytics snippet must contain the Google tag script and a gtag config call.');
 return value;
}

export async function readAnalyticsSnippet(file){
 return validateSnippet(await readFile(file,'utf8'));
}

export function injectAnalyticsSnippet(html,snippet){
 const value=validateSnippet(snippet),match=headTag.exec(html);
 if(!match)throw new Error('Cannot inject analytics snippet: HTML page has no opening <head> tag.');
 if(analyticsMarker.test(html))throw new Error('Cannot inject analytics snippet: HTML page already contains a Google tag.');
 const offset=match.index+match[0].length;
 return `${html.slice(0,offset)}\n${value}\n${html.slice(offset)}`;
}

async function htmlFiles(directory){
 const files=[];
 async function visit(current){
  for(const entry of await readdir(current,{withFileTypes:true})){
   const file=join(current,entry.name);
   if(entry.isDirectory())await visit(file);
   else if(entry.isFile()&&/\.html$/i.test(entry.name))files.push(file);
  }
 }
 await visit(directory);
 return files;
}

export async function injectAnalyticsIntoDist(directory,snippet){
 const value=validateSnippet(snippet),files=await htmlFiles(directory);
 if(!files.length)throw new Error(`Cannot inject analytics snippet: no HTML pages found in ${directory}.`);
 for(const file of files){
  const html=await readFile(file,'utf8');
  await writeFile(file,injectAnalyticsSnippet(html,value));
 }
 return files;
}
