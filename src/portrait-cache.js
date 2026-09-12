export function createPortraitCache(render){
 const images=new Map();
 return {
  get(uid,key,id){
   const cached=images.get(uid);if(cached?.key===key)return cached.url;
   const url=render(id);images.set(uid,{key,url});return url;
  },
  retain(uids){for(const uid of images.keys())if(!uids.has(uid))images.delete(uid);},
  clear(){images.clear();}
 };
}
