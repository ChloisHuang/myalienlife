import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHttpService} from './http-service.js';

const token=(await readFile(process.env.ORBIT_TOKEN_FILE,'utf8')).trim();
const service=await createHttpService({directory:process.env.ORBIT_DATA_DIR??resolve('.data'),dist:process.env.ORBIT_DIST_DIR??resolve('dist'),token,origin:process.env.ORBIT_ORIGIN,release:process.env.ORBIT_RELEASE??'local'});
service.server.listen(Number(process.env.PORT??18080),process.env.HOST??'127.0.0.1',()=>console.log('Orbit authority ready'));
let stopping=false;async function stop(){if(stopping)return;stopping=true;try{await service.close();process.exitCode=0;}catch{process.exitCode=1;}}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
