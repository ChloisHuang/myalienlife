export const OCEAN_LAYOUT=[
 ['portal',-5.5,7],['pod',-11,3],['food',-5,-7.6],['shower',11.5,-1.4],
 ['lab',2.4,-7.7],['sofa',-1.5,-8.2],['music',11,5.5]
].map(([type,x,z])=>({type,x,z,rotation:0}));
export const OCEAN_ITEMS=[
 {id:'oceanPearlLamp',name:'潮汐珍珠灯',pack:'珊瑚浅湾',price:120,icon:'Lamp',action:null,desc:'贝壳托起冷白珍珠 · 可移动照明'},
 {id:'oceanShellPlanter',name:'珊瑚贝壳盆景',pack:'珊瑚浅湾',price:90,icon:'Flower2',action:null,desc:'粉珊瑚与海草 · 可自由布置'},
 {id:'oceanBubbleMobile',name:'海流风铃',pack:'珊瑚浅湾',price:150,icon:'Waves',action:null,desc:'悬挂珍珠与贝片的海流摆饰'}
];
// World-space authored landmark footprints. The submerged floor is still traversable.
export function oceanBlocked(x,z,padding=0,side='front'){
 return Math.hypot((x-7)/1.25,z+7)<(side==='back'?2.6:1.7)+padding||
  side==='front'&&Math.hypot(x+8.3,z)<1.55+padding||
  side==='front'&&Math.hypot(x-.35,z-1.55)<1.1+padding||
  (side==='back'?Math.hypot(x+8,z+1)<1.8+padding:Math.hypot(x+11,z+1)<1.6+padding||Math.hypot(x+9,z+6.7)<1.7+padding);
}
export const OCEAN_WATER={front:{rx:15.8,rz:11.25,y:.62},back:{rx:14.5,rz:10.2,y:1.32}};
export function oceanFrontLand(x,z){
 const radius=Math.hypot(x/14.6,z/10.4),angle=Math.atan2(z/10.4,x/14.6);
 const bend=.055*Math.sin(radius*21)+.028*Math.sin(radius*43);
 return radius>.59&&!(angle>.78+bend&&angle<1.38+bend);
}
export function oceanHeight(x,z,side='front'){
 if(side==='back'||!oceanFrontLand(x,z))return .29;
 return 1.55+.10*Math.sin(x*.5)*Math.cos(z*.45);
}
