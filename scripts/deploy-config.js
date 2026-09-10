export function deploymentConfig(input){
 const c={httpsPort:6443,backendPort:18080,...input};
 for(const key of ['host','domain'])if(typeof c[key]!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(c[key]))throw new Error(`Invalid ${key}`);
 if(typeof c.user!=='string'||!/^[a-z_][a-z0-9_-]*$/.test(c.user))throw new Error('Invalid SSH user');
 for(const key of ['sshPort','httpsPort','backendPort'])if(!Number.isInteger(c[key])||c[key]<1||c[key]>65535)throw new Error(`Invalid ${key}`);
 if(c.httpsPort<1024||c.backendPort<1024||new Set([c.sshPort,c.httpsPort,c.backendPort]).size!==3)throw new Error('Ports must be distinct, application ports >= 1024');
 if(c.sshProxy!==undefined){
  const p=c.sshProxy;
  if(!p||typeof p.host!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(p.host)||!Number.isInteger(p.port)||p.port<1||p.port>65535)throw new Error('Invalid SOCKS5 SSH proxy');
 }
 return {...c,origin:`https://${c.domain}:${c.httpsPort}`};
}
