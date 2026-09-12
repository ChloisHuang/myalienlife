import {readFile,writeFile,mkdir,chmod,readdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {deploymentConfig} from './deploy-config.js';
import {deploymentTransport,uploadRelease} from './deploy-transport.js';
import {buildRelease,run,root} from './build-release.js';
import {readAnalyticsSnippet} from './deploy-analytics.js';

const configPath=resolve(root,'deploy.config.json');
const input=JSON.parse(await readFile(configPath,'utf8'));
const c=deploymentConfig(input),seed=process.argv.includes('--seed-local');
const analyticsSnippet=await readAnalyticsSnippet(resolve(root,'.deploy/google-analytics-head.html'));
const transport=deploymentTransport(c),{target,ssh}=transport;
// Fail before the build when the configured route or transfer dependency is unavailable.
run('rsync',['--version']);
run('ssh',[...ssh,target,'command -v rsync >/dev/null']);
const tests=(await readdir(resolve(root,'tests'))).filter(n=>n.endsWith('.test.js')).map(n=>`tests/${n}`);
// Keep the wall-clock capacity gate isolated from other test workers.
run(process.execPath,['--test','--test-concurrency=1',...tests]);
const directory=await buildRelease({analyticsSnippet}),id=new Date().toISOString().replace(/[^0-9]/g,''),archive=resolve(root,'.deploy',`${id}.tgz`);
run('tar',[...(process.platform==='darwin'?['--no-xattrs']:[]),'-czf',archive,'-C',directory,'.'],{env:{...process.env,COPYFILE_DISABLE:'1'}});
const hash=createHash('sha256').update(await readFile(archive)).digest('hex');
run('ssh',[...ssh,target,'mkdir -p /opt/myalienlife/incoming && chmod 700 /opt/myalienlife/incoming']);
const upload=(local,remote)=>uploadRelease((command,args)=>spawnSync(command,args,{cwd:root,stdio:'inherit'}),transport.upload(local,remote));
upload(archive,`/opt/myalienlife/incoming/${id}.tgz`);
if(seed){const file=resolve(root,'.data/orbit-life.json');await stat(file);upload(file,`/opt/myalienlife/incoming/${id}.seed.json`);}
const script=await readFile(resolve(root,'scripts/deploy-remote.sh'),'utf8');
run('ssh',[...ssh,target,`bash -s -- ${id} ${hash} ${c.domain} ${c.httpsPort} ${c.backendPort} ${seed?'seed':'existing'}`],{input:script,stdio:['pipe','inherit','inherit']});
await mkdir(resolve(root,'.deploy'),{recursive:true});
const tokenFile=resolve(root,'.deploy/operator-token.txt');await writeFile(tokenFile,'',{mode:0o600});await chmod(tokenFile,0o600);
run('rsync',transport.download('/opt/myalienlife/secrets/operator-token',tokenFile));await chmod(tokenFile,0o600);
console.log(`Deployed ${c.origin}\nOperator token: ${tokenFile} (keep private)`);
