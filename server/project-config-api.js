export function projectConfigApi(store){
 return async(req,res,next)=>{
  if(req.url?.split('?')[0]!=='/api/project-config')return next();
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  try{
   let config;
   if(req.method==='GET')config=await store.read();
   else if(req.method==='PUT'){
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Object.assign(new Error('请求来源不匹配'),{status:403});
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1048576)throw Object.assign(new Error('配置过大'),{status:413});}
    let request;try{request=JSON.parse(body);}catch{throw Object.assign(new Error('无效的 JSON'),{status:400});}
    config=await store.write(request?.config);
   }else{res.statusCode=405;res.end(JSON.stringify({error:'不支持的请求方法'}));return;}
   res.end(JSON.stringify({config}));
  }catch(error){res.statusCode=error.status||500;res.end(JSON.stringify({error:res.statusCode===500?'服务器无法读取或写入项目配置，请保留当前页面':error.message}));}
 };
}
