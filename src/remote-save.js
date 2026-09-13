export async function pullRemoteSave(request=fetch){
 const response=await request('/api/pull-remote-save',{method:'POST',cache:'no-store'});
 let data;try{data=await response.json();}catch{data=null;}
 if(!response.ok)throw Object.assign(new Error(data?.error||`拉取线上存档失败（HTTP ${response.status}）`),{status:response.status});
 return data;
}
