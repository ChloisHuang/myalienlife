export function deploymentTransport(c){
 const options=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=20','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=4'];
 if(c.sshProxy)options.push('-o',`ProxyCommand=nc -X 5 -x ${c.sshProxy.host}:${c.sshProxy.port} %h %p`);
 const ssh=['-p',String(c.sshPort),...options],target=`${c.user}@${c.host}`;
 const shell=['ssh',...ssh].map(arg=>`'${arg.replaceAll("'","'\\''")}'`).join(' ');
 return {target,ssh,upload:(local,remote)=>['--archive','--partial','--inplace','--timeout=90','-e',shell,local,`${target}:${remote}`],download:(remote,local)=>['--archive','--timeout=90','-e',shell,`${target}:${remote}`,local]};
}

export function uploadRelease(run,args){
 // Retry only interrupted transfers; rsync reuses verified blocks of this archive.
 for(let attempt=1;attempt<=3;attempt++){
  const result=run('rsync',args);
  if(result.error)throw result.error;
  if(result.status===0)return;
  if(![10,12,30,35,255].includes(result.status)||attempt===3)throw new Error(`Release upload failed (${result.status}); remote release was not activated`);
 }
}
