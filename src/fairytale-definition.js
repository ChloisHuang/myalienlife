export const FAIRYTALE_LAYOUT=[
 ['portal',0,0],['pod',-5,-3],['food',-2,-3],['shower',2,-3],['lab',5,-3],
 ['garden',5,2],['sofa',-8,-3],['music',8,5]
].map(([type,x,z])=>({type,x,z,rotation:0}));
export const FAIRYTALE_ITEMS=[
 {id:'fairyBench',name:'绘本花园长椅',pack:'童话花园',price:190,icon:'Armchair',action:'relax',desc:'圆润彩绘木椅 · 舒适 +55 · 能量 +15'},
 {id:'fairyLantern',name:'蜜光庭院灯',pack:'童话花园',price:110,icon:'Lamp',action:null,desc:'暖蜜色玻璃庭院灯'},
 {id:'fairyPlanter',name:'红陶花箱',pack:'童话花园',price:85,icon:'Flower2',action:null,desc:'粉白花朵与圆叶 · 可自由布置的庭院花箱'}
];
export const FAIRYTALE_CONSTRUCTION_ITEMS=[['stove',-6,1],['tea',-3,1],['banquet',3,3],['nursery',-4,5]].map(([type,x,z])=>({type,x,z,rotation:0}));
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function fairytaleHeight(x,z){
 const edge=(Math.abs(x)-11.5)/2.6,bank=(z+2)/3.5,stream=(z-7.5)/.55;
 return .29+1.35*smooth((-z-5.4)/2.3)+.65*Math.exp(-edge*edge-bank*bank)-.37*Math.exp(-stream*stream);
}
export const fairytaleBlocked=(x,z,padding=0,side='front')=>(Math.abs(x-(side==='back'?6.5:0))<4.5+padding&&z< -6.75+padding)||(x< -9.05+padding&&Math.abs(z-1.8)<1.6+padding);
