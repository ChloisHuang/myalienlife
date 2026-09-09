import {readFile,writeFile,mkdir,chmod,readdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {deploymentConfig} from './deploy-config.js';
import {buildRelease,run,root} from './build-release.js';

const configPath=resolve(root,'deploy.config.json');
const input=JSON.parse(await readFile(configPath,'utf8'));
const c=deploymentConfig(input),seed=process.argv.includes('--seed-local');
const tests=(await readdir(resolve(root,'tests'))).filter(n=>n.endsWith('.test.js')).map(n=>`tests/${n}`);
run(process.execPath,['--test',...tests]);
const directory=await buildRelease(),id=new Date().toISOString().replace(/[^0-9]/g,''),archive=resolve(root,'.deploy',`${id}.tgz`);
run('tar',[...(process.platform==='darwin'?['--no-xattrs']:[]),'-czf',archive,'-C',directory,'.'],{env:{...process.env,COPYFILE_DISABLE:'1'}});
const hash=createHash('sha256').update(await readFile(archive)).digest('hex');
const target=`${c.user}@${c.host}`,ssh=['-p',String(c.sshPort),'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=20'];
const scp=['-O','-P',String(c.sshPort),'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=20','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=3'];
run('ssh',[...ssh,target,'mkdir -p /opt/myalienlife/incoming && chmod 700 /opt/myalienlife/incoming']);
run('scp',[...scp,archive,`${target}:/opt/myalienlife/incoming/${id}.tgz`]);
if(seed){const file=resolve(root,'.data/orbit-life.json');await stat(file);run('scp',[...scp,file,`${target}:/opt/myalienlife/incoming/${id}.seed.json`]);}
const script=await readFile(resolve(root,'scripts/deploy-remote.sh'),'utf8');
run('ssh',[...ssh,target,`bash -s -- ${id} ${hash} ${c.domain} ${c.httpsPort} ${c.backendPort} ${seed?'seed':'existing'}`],{input:script,stdio:['pipe','inherit','inherit']});
await mkdir(resolve(root,'.deploy'),{recursive:true});
const tokenFile=resolve(root,'.deploy/operator-token.txt');await writeFile(tokenFile,'',{mode:0o600});await chmod(tokenFile,0o600);
run('scp',[...scp,`${target}:/opt/myalienlife/secrets/operator-token`,tokenFile]);await chmod(tokenFile,0o600);
console.log(`Deployed ${c.origin}\nOperator token: ${tokenFile} (keep private)`);
