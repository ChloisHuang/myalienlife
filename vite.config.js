import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {createSaveStore} from './server/save-store.js';
import {saveApi} from './server/save-api.js';
import {createProjectConfigStore} from './server/project-config-store.js';
import {projectConfigApi} from './server/project-config-api.js';

const store=createSaveStore(process.env.ORBIT_SAVE_DIR??fileURLToPath(new URL('./.data/',import.meta.url)));
const projectConfig=createProjectConfigStore(process.env.ORBIT_PROJECT_CONFIG??fileURLToPath(new URL('./project-config.json',import.meta.url)));
const mount=server=>{server.middlewares.use(projectConfigApi(projectConfig));server.middlewares.use(saveApi(store));};
export default defineConfig({plugins:[{name:'orbit-life-save',configureServer:mount,configurePreviewServer:mount}],server:{watch:{ignored:['**/.data/**']}},build:{target:'esnext'}});
