import {STAR_ISLANDS,SPACE_LEVELS,spaceLevel,discovered,voyageError} from './civilization.js';
import {sideOf,SIDES} from './island.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const CITY_RECORDS=['星能补给站','星城档案馆','发光生态温室'];
export function explorationContent(g){
 const w=g.wonders,c=g.civilization,level=spaceLevel(g),next=SPACE_LEVELS[level+1];
 const relics=g.objects.filter(o=>o.type==='relic');
 return `<div class="exploration-intro">家园共享探索档案 · 所有居民共同推进，所有研究与考察跨人物、跨代累计，居民离世也不会清除文明进度。</div><div class="exploration-grid">
 <article><h4>太空科技 <b>${level} 级 · ${SPACE_LEVELS[level].name}</b></h4><progress value="${c.technology}" max="120"></progress><p>共享工程进度 ${c.technology} / 120</p><small>${next?`下一阶段：${next.name} · ${next.points} 点`:'现有航行科技已完成'}<br>普通研究 +1；太空工程研究 +4；异岛勘察 +6。<br>研究台需要科学经验 6 才能研发太空科技。</small></article>
 <article><h4>星图测绘 <b>${c.observations} 次</b></h4><p>${c.observations>=3?'✓ 已定位孢海浮洲':'○ 完成 3 次观测或家园轨道勘察，定位孢海浮洲'}</p><small>发现坐标只是第一步；登岛还需要科技、兴趣和技能。</small></article>
 <article><h4>星岛航路</h4>${Object.entries(STAR_ISLANDS).filter(([id])=>id!=='home').map(([id,island])=>`<p>${island.name} · ${discovered(g,id)?'已发现':'未定位'}<br>科技 ${island.level} 级 · ${island.skill==='botany'?'植物学':'科学'}经验 ${island.required} · 相关兴趣 ≥ 5<br>累计登陆 ${c.visits[id]} 次 · 勘察 ${c.surveys[id]} 次</p><small>${escape(voyageError(g,g.player,g.skills,id)||'主控居民符合出航条件')}</small>${discovered(g,id)?`<button class="island-launch" data-voyage="${id}" ${voyageError(g,g.player,g.skills,id)?'disabled':''}>安排前往${island.name}</button>`:''}`).join('')}<button class="island-launch" data-voyage="home" ${g.player.island&&g.player.island!=='home'?'':'disabled'}>乘星舟返回家园</button></article>
 <article><h4>古文明记忆 <b>${w.archive} / 3</b></h4><progress value="${w.archive}" max="3"></progress><p>${['拓印迁徙残纹','解读失落星图','重现文明记忆'].map((t,i)=>`${w.archive>i?'✓':'○'} ${t}`).join('<br>')}</p><p>${w.coauthored?'✓ 已发现双人生态线索':'○ 邀请邻居协作解读可发现生态线索'}</p><small>${w.archive===3?'已定位失落星城，登岛需要太空科技 2 级':'完成三章后定位失落星城'}</small></article>
 <article><h4>星城考察 <b>${w.expeditions} 次</b></h4><p>独特记录 ${w.cityRecords.length} / 3</p><p>${CITY_RECORDS.map((t,i)=>`${w.cityRecords.includes(i)?'✓':'○'} ${t}`).join('<br>')}</p><small>${w.lastExpeditionDay===g.day?'今日已探访，明日可再出发':'今日尚未探访'} · 单次带回 120 星币、2 份微尘<br>次数与独特记录从本次更新起累计，旧存档未记录的历史不补算。</small></article>
 <article><h4>幽光微尘 <b>${w.dust} 份</b></h4><p>来源：捕捉幽光虫、探访失落星城。</p><p>用途：晶簇充满后消耗 1 份，激活一次共振。</p><small>安眠：附近一次睡眠额外恢复 15 能量。<br>灵感：附近一次研究额外获得 1 科学经验。<br>有效范围 5 米；免费切换频率会从零充能。</small></article>
 <article><h4>遗迹现场 <b>${relics.length} 座</b></h4>${relics.map(o=>`<p>${SIDES[sideOf(o)]} (${o.x}, ${o.z}) · ${o.wonder.chapter} / 3 章${o.wonder.coauthored?' · 协作线索':''}</p>`).join('')||'<p>尚未摆放虚空遗迹。</p>'}</article>
</div><p class="exploration-intro">自主选择会权衡需求、个人兴趣、技能、距离与伙伴队列。共同活动会邀请并排队；技能越熟练，相关活动的选择权重越高。</p>`;
}
