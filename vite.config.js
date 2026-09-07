import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {createSaveStore} from './server/save-store.js';
import {saveApi} from './server/save-api.js';

const store=createSaveStore(fileURLToPath(new URL('./.data/',import.meta.url)));
const mount=server=>{server.middlewares.use(saveApi(store));};
export default defineConfig({plugins:[{name:'orbit-life-save',configureServer:mount,configurePreviewServer:mount}],server:{watch:{ignored:['**/.data/**']}},build:{target:'esnext'}});
