import {islandOf,sameSide} from './island.js';
import {housingLayout} from './housing-layout.js';

export const PROJECT_WORK={blueprint:300,construction:600};
export const MATERIAL_WORK_SECONDS=10;
export const PROJECT_ACTIONS=['developBlueprint','constructIsland','settleIsland'];
const PROJECT_STATIONS={blueprintTable:['developBlueprint'],constructionTerminal:['constructIsland','settleIsland']};
export const projectActions=o=>PROJECT_STATIONS[o?.type]??[];
export const workbench=o=>Object.hasOwn(PROJECT_STATIONS,o?.type);
export const createProject=(seed=0)=>({blueprint:0,construction:0,plan:housingLayout(seed)});
export const projectFor=(g,id)=>g.civilization.projects[id];
export const projectComplete=(g,id)=>id==='home'||projectFor(g,id)?.construction===PROJECT_WORK.construction;
export function remainingConstructionMaterials(g,id){
 const project=projectFor(g,id);
 return project?Math.ceil(PROJECT_WORK.construction/MATERIAL_WORK_SECONDS)-Math.ceil(project.construction/MATERIAL_WORK_SECONDS):0;
}
export function projectError(g,type,o,p){
 if(!PROJECT_ACTIONS.includes(type))return null;
 const id=islandOf(p),project=projectFor(g,id);
 if(!project||id==='home')return '请先到达需要开发的新星岛。';
 if(!sameSide(o,p))return '请使用当前岛面的工作台。';
 if(!projectActions(o).includes(type))return '设计请使用星图蓝图绘制台，施工与移居请使用筑星施工终端。';
 if(type==='settleIsland')return !projectComplete(g,id)?'岛屿建设完成后才能移居。':p.homeIsland===id?'这里已经是你的根据地。':null;
 if(type==='developBlueprint')return project.blueprint>=PROJECT_WORK.blueprint?'本岛蓝图已开发完成。':null;
 return project.blueprint<PROJECT_WORK.blueprint?'蓝图开发达到 100% 后才能开始建设。':projectComplete(g,id)?'本岛建设已完成。':project.construction>=Math.ceil(project.construction/MATERIAL_WORK_SECONDS)*MATERIAL_WORK_SECONDS&&!(g.space.materials[id]>0)?'本岛缺少植生复材，请由植物职业提取并用飞船运抵。':null;
}
export function contributeProject(g,type,p,seconds){
 const project=projectFor(g,islandOf(p)),key=type==='developBlueprint'?'blueprint':type==='constructIsland'?'construction':null;
 if(!key||!project||key==='construction'&&project.blueprint<PROJECT_WORK.blueprint)return;
 if(key==='construction'){
  const id=islandOf(p),stock=g.space.materials[id]??0,paid=Math.ceil(project.construction/MATERIAL_WORK_SECONDS);
  const next=Math.min(PROJECT_WORK.construction,project.construction+seconds,(paid+stock)*MATERIAL_WORK_SECONDS);
  g.space.materials[id]=stock-(Math.ceil(next/MATERIAL_WORK_SECONDS)-paid);project.construction=next;
 }else project[key]=Math.min(PROJECT_WORK[key],project[key]+seconds);
}
export function validProjects(c){
 const ids=['spore','city',...Object.keys(c.islands)].filter(id=>!c.destroyedIslands.includes(id));
 const rect=r=>r&&['x','z','w','d'].every(k=>Number.isFinite(r[k]))&&Math.abs(r.x)<=13&&Math.abs(r.z)<=10&&r.w>0&&r.w<=22&&r.d>0&&r.d<=10;
 return c.projects&&Object.keys(c.projects).length===ids.length&&ids.every(id=>{const p=c.projects[id];return p&&p.plan&&Number.isInteger(p.plan.kind)&&p.plan.kind>=0&&p.plan.kind<4&&typeof p.plan.name==='string'&&p.plan.name.length<=30&&Array.isArray(p.plan.rooms)&&p.plan.rooms.length===6&&p.plan.rooms.every(r=>rect(r)&&['卧室','客厅','厨房','卫浴','育生室','研究室'].includes(r.type))&&Array.isArray(p.plan.corridors)&&p.plan.corridors.length<=3&&p.plan.corridors.every(rect)&&Number.isFinite(p.blueprint)&&p.blueprint>=0&&p.blueprint<=PROJECT_WORK.blueprint&&Number.isFinite(p.construction)&&p.construction>=0&&p.construction<=PROJECT_WORK.construction&&(p.construction===0||p.blueprint===PROJECT_WORK.blueprint);});
}
