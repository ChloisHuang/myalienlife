import {restore} from './simulation.js';

export async function readPreviewSave(request=fetch){
 const response=await request('/api/save',{cache:'no-store'}),saved=await response.json();
 if(!response.ok)throw new Error(saved.error);
 if(!saved.state)throw new Error('暂无存档，请先在游戏页面保存进度');
 return {revision:saved.revision,game:restore(JSON.stringify(saved.state))};
}
