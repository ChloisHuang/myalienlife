import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,cp,rm,writeFile,readdir,readFile} from 'node:fs/promises';
import {createProjectConfigStore} from '../server/project-config-store.js';
import {fileURLToPath} from 'node:url';
import {resolve,relative,sep} from 'node:path';
import {injectAnalyticsIntoDist,readAnalyticsSnippet} from './deploy-analytics.js';
export const root=fileURLToPath(new URL('../',import.meta.url));
const analyticsSnippetPath=resolve(root,'.deploy/google-analytics-head.html');
export function run(command,args,options={}){const result=spawnSync(command,args,{cwd:root,stdio:'inherit',...options});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${command} failed (${result.status})`);return result;}
export async function createAssetVersions(directory=resolve(root,'public/assets')){
 const versions={};
 async function visit(current){
  const entries=(await readdir(current,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries){
   const file=resolve(current,entry.name);
   if(entry.isDirectory())await visit(file);
   else if(entry.isFile())versions[`/assets/${relative(directory,file).split(sep).join('/')}`]=createHash('sha256').update(await readFile(file)).digest('hex');
  }
 }
 await visit(directory);return versions;
}
export async function buildRelease({analyticsSnippet}={}){
 const directory=resolve(root,'.deploy/release');await rm(directory,{recursive:true,force:true});await mkdir(directory,{recursive:true});
 const assetVersions=await createAssetVersions();
 run(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:{...process.env,VITE_SERVER_AUTHORITY:'1',VITE_ASSET_VERSIONS:JSON.stringify(assetVersions)}});
 await build({entryPoints:[resolve(root,'server/production.js'),resolve(root,'server/preflight.js')],outdir:directory,bundle:true,platform:'node',format:'esm',target:'node24',external:['geoip-country'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outExtension:{'.js':'.mjs'}});
 const geo=resolve(directory,'node_modules/geoip-country');
 await build({entryPoints:[resolve(root,'node_modules/geoip-country/lib/geoip.js')],outfile:resolve(geo,'lib/geoip.js'),bundle:true,platform:'node',format:'cjs',target:'node24'});
 for(const name of ['data','package.json','LICENSE','EULA'])await cp(resolve(root,'node_modules/geoip-country',name),resolve(geo,name),{recursive:true});
 await cp(resolve(root,'dist'),resolve(directory,'dist'),{recursive:true});
 await injectAnalyticsIntoDist(resolve(directory,'dist'),analyticsSnippet??await readAnalyticsSnippet(analyticsSnippetPath));
 await writeFile(resolve(directory,'project-config.json'),JSON.stringify(await createProjectConfigStore(resolve(root,'project-config.json')).read()));
 return directory;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildRelease();
