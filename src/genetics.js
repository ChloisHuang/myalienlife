export const defaultGenome=()=>({stature:1,build:1,head:1,antenna:1});
export function inheritTraits(parents,random=Math.random){
 const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
 const genome=Object.fromEntries(Object.keys(defaultGenome()).map(key=>[key,mean(parents.map(p=>p.genome[key]))]));
 const channels=[1,3,5].map(offset=>Math.round(mean(parents.map(p=>parseInt(p.color.slice(offset,offset+2),16)))));
 const preferences=Object.fromEntries([...new Set(parents.flatMap(p=>Object.keys(p.preferences)))].map(key=>[key,mean(parents.map(p=>p.preferences[key]||0))]));
 const familyDesire=mean(parents.map(p=>p.familyDesire)),mutations=[];
 // A birth has a 12% chance of one bounded mutation. All results are saved once.
 if(random()<.12){
  const index=Math.min(4,Math.floor(random()*5)),delta=(random()<.5?-1:1)*.12;
  if(index===0){const shift=Math.round(delta*500);channels[1]+=channels[1]+shift>255||channels[1]+shift<0?-shift:shift;mutations.push('肤色变异');}
  else{const key=Object.keys(genome)[index-1];genome[key]+=genome[key]+delta>1.2||genome[key]+delta<.8?-delta:delta;mutations.push({stature:'身高变异',build:'体型变异',head:'头部比例变异',antenna:'触角变异'}[key]);}
 }
 const color='#'+channels.map(n=>n.toString(16).padStart(2,'0')).join('');
 const favorite=Object.entries(preferences).sort((a,b)=>b[1]-a[1])[0]?.[0];
 const trait={research:'好奇心旺盛',observe:'爱观星',garden:'热爱自然',chat:'喜欢陪伴',dance:'热爱音乐'}[favorite]||'随和';
 return{genome,color,preferences,familyDesire,mutations,trait:`${trait} · ${mutations.length?'独特星芽':'家族传承'}`};
}
