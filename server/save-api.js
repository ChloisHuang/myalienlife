export function saveApi(store){
 return async(req,res,next)=>{
  if(req.url?.split('?')[0]!=='/api/save')return next();
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  try{
   let saved;
   if(req.method==='GET')saved=await store.read();
   else if(req.method==='POST'){
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Object.assign(new Error('请求来源不匹配'),{status:403});
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1048576)throw Object.assign(new Error('存档过大'),{status:413});}
    let request;try{request=JSON.parse(body);}catch{throw Object.assign(new Error('无效的 JSON'),{status:400});}
    saved=await store.write(request);
   }else{res.statusCode=405;res.end(JSON.stringify({error:'不支持的请求方法'}));return;}
   res.end(JSON.stringify({revision:saved.revision,savedAt:saved.savedAt,state:saved.state}));
  }catch(error){res.statusCode=error.status||500;res.end(JSON.stringify({error:res.statusCode===500?'服务器无法读取或写入存档，请保留当前页面':error.message}));}
 };
}
