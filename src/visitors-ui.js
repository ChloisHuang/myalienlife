import {createElement,ChartColumn,X} from 'lucide';
import './visitors.css';

export function createVisitorsUi(client){
 const button=document.createElement('button');button.id='visitor-stats';button.hidden=true;button.title='访问统计';button.setAttribute('aria-label','访问统计');button.append(createElement(ChartColumn));document.querySelector('.identity-actions').append(button);
 const dialog=document.createElement('dialog');dialog.id='visitor-dialog';dialog.setAttribute('aria-labelledby','visitor-title');
 dialog.innerHTML='<header><h2 id="visitor-title">访问统计</h2><button aria-label="关闭访问统计" title="关闭"></button></header><p id="visitor-message" role="status"></p><div id="visitor-results" hidden><dl class="visitor-totals"><div><dt>当前在线</dt><dd id="visitor-online"></dd></div><div><dt>编辑权限</dt><dd id="visitor-operator"></dd></div><div><dt>总访问人次</dt><dd id="visitor-total"></dd></div><div><dt>今日独立 IP</dt><dd id="visitor-today"></dd></div><div><dt>近 30 天访问人次</dt><dd id="visitor-month"></dd></div></dl><h3>近 30 天访问人数</h3><div class="visitor-chart"><canvas role="img" aria-label="近 30 天每日独立 IP 曲线"></canvas></div><h3>IP 归属地</h3><div class="visitor-countries"><table><thead><tr><th>国家 / 地区</th><th>访问人次</th><th>占比</th></tr></thead><tbody></tbody></table></div><p class="visitor-note" id="visitor-since"></p><p class="visitor-note">北京时间 · 同一 IP 连续访问计一次，闲置 30 分钟后再访另计。人数按每日独立 IP 估算；共享网络与代理可能影响结果。仅保存匿名标识和国家 / 地区，不保存原始 IP。</p></div>';
 dialog.querySelector('header button').append(createElement(X));document.querySelector('#app').append(dialog);
 let authenticated=false,chart,version=0;
 dialog.querySelector('header button').onclick=()=>dialog.close();dialog.onclose=()=>{version++;chart?.destroy();chart=null;};
 button.onclick=async()=>{
  if(!authenticated)return;const current=++version;dialog.showModal();const message=dialog.querySelector('#visitor-message'),results=dialog.querySelector('#visitor-results');message.textContent='正在读取统计';results.hidden=true;
  try{
   const [data,{default:Chart}]=await Promise.all([client.visitors(),import('chart.js/auto')]);
   if(current!==version||!authenticated||!dialog.open)return;
   const set=(id,value)=>dialog.querySelector(id).textContent=value.toLocaleString('zh-CN');
   set('#visitor-online',data.onlineCount);const operator=dialog.querySelector('#visitor-operator');operator.textContent=data.operatorHeld?'有人持有':'无人持有';operator.dataset.held=String(data.operatorHeld);set('#visitor-total',data.totalVisits);set('#visitor-today',data.days.at(-1).visitors);set('#visitor-month',data.days.reduce((sum,d)=>sum+d.visits,0));
   const tbody=dialog.querySelector('tbody');tbody.replaceChildren();const names=new Intl.DisplayNames(['zh-CN'],{type:'region'});
   for(const item of data.countries){const row=document.createElement('tr');for(const text of [item.country==='ZZ'?'未知 / 内网':names.of(item.country),item.visits.toLocaleString('zh-CN'),`${(item.visits/Math.max(1,data.totalVisits)*100).toFixed(1)}%`]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}tbody.append(row);}
   dialog.querySelector('#visitor-since').textContent=`统计开始：${data.since} · 历史访问不补算`;
   message.textContent=data.error|| (data.capped?'部分日期达到统计容量上限，人数可能偏低。':data.totalVisits?'':'暂无访问记录');results.hidden=false;
   chart=new Chart(dialog.querySelector('canvas'),{
    type:'line',data:{labels:data.days.map(d=>d.date.slice(5)),datasets:[{label:'独立 IP',data:data.days.map(d=>d.date<data.since?null:d.visitors),borderColor:'#3c7164',backgroundColor:'#3c716418',fill:true,pointRadius:2,tension:.15}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{ticks:{maxTicksLimit:6,maxRotation:0},grid:{display:false}}}}
   });
  }catch(error){if(current===version)message.textContent=error.message;}
 };
 return {setAuthenticated(value){authenticated=value;button.hidden=!value;if(!value&&dialog.open)dialog.close();}};
}
