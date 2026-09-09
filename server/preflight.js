import {createSaveStore} from './save-store.js';
const saved=await createSaveStore('/data').read();
if(!saved.state)throw new Error('Migration requires a valid existing save');
console.log(JSON.stringify({valid:true,revision:saved.revision,version:saved.state.version}));
