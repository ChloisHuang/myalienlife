export const defaultGenome=()=>({stature:1,build:1,head:1,antenna:1});
export const DEFAULT_MUTATION_RATES={color:2.4,stature:2.4,build:2.4,head:2.4,antenna:2.4};
export const MUTATION_PARTS={color:'肤色',stature:'身高',build:'体型',head:'头部比例',antenna:'触角'};
const NAME_FIRST=[['艾','research','observe'],['阿','chat','dance'],['伊','observe','chat'],['欧','research','dance'],['洛','research','garden'],['维','research','observe'],['泽','garden','research'],['希','observe','chat'],['赛','research','dance'],['塔','research','garden'],['奈','chat','garden'],['科','research'],['弥','chat','dance'],['珂','garden','observe'],['芙','garden','chat'],['索','research','observe'],['乌','garden','observe'],['莱','research','garden'],['卡','dance','research'],['提','observe','dance'],['苏','garden','chat'],['尤','chat','observe'],['帕','dance','research'],['赫','research','observe']].map(([char,...styles])=>({char,styles}));
const NAME_SECOND=[['恩','research','observe'],['瓦','garden','observe'],['米','dance','chat'],['克','research'],['尔','research','observe'],['拉','garden','chat'],['弥','chat','dance'],['希','observe','chat'],['娅','chat','garden'],['斯','research','observe'],['特','research'],['昂','observe','research'],['珀','research','garden'],['诺','chat','observe'],['萨','garden','dance'],['因','research','observe'],['卡','dance','research'],['罗','chat','garden'],['泽','garden','research'],['亚','chat','observe'],['塔','research','garden'],['尤','chat','dance'],['安','chat'],['埃','observe','research']].map(([char,...styles])=>({char,styles}));
const nameHash=value=>{let hash=2166136261;for(const char of String(value)){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;};
const namePartScore=(part,preferences)=>part.styles.reduce((score,key)=>score+(preferences?.[key]||0),0);
export function generateResidentName({uid,preferences={}},usedNames=[]){
 const used=new Set(usedNames),candidates=[];
 for(const first of NAME_FIRST)for(const second of NAME_SECOND){if(first.char===second.char)continue;const name=first.char+second.char;if(used.has(name))continue;candidates.push({name,score:namePartScore(first,preferences)+namePartScore(second,preferences),tie:nameHash(`${uid}:${name}`)});}
 candidates.sort((a,b)=>b.score-a.score||b.tie-a.tie);if(!candidates[0])throw new Error('外星名字库已用尽');return candidates[0].name;
}
export function inheritTraits(parents,random=Math.random,rates=DEFAULT_MUTATION_RATES){
 const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
 const genome=Object.fromEntries(Object.keys(defaultGenome()).map(key=>[key,mean(parents.map(p=>p.genome[key]))]));
 const channels=[1,3,5].map(offset=>Math.round(mean(parents.map(p=>parseInt(p.color.slice(offset,offset+2),16)))));
 const preferences=Object.fromEntries([...new Set(parents.flatMap(p=>Object.keys(p.preferences)))].map(key=>[key,mean(parents.map(p=>p.preferences[key]||0))]));
 const familyDesire=mean(parents.map(p=>p.familyDesire)),mutations=[];
 // Each configured body-part rate contributes to one bounded mutation roll.
 const parts=Object.keys(DEFAULT_MUTATION_RATES),total=Math.min(100,parts.reduce((sum,key)=>sum+(rates[key]??DEFAULT_MUTATION_RATES[key]),0));
 if(random()<total/100){
  const pick=random()*total;let cursor=0;const part=parts.find(key=>(cursor+=rates[key]??DEFAULT_MUTATION_RATES[key])>pick)||parts.at(-1),delta=(random()<.5?-1:1)*.12;
  if(part==='color'){const shift=Math.round(delta*500);channels[1]+=channels[1]+shift>255||channels[1]+shift<0?-shift:shift;mutations.push('肤色变异');}
  else{genome[part]+=genome[part]+delta>1.2||genome[part]+delta<.8?-delta:delta;mutations.push(`${MUTATION_PARTS[part]}变异`);}
 }
 const color='#'+channels.map(n=>n.toString(16).padStart(2,'0')).join('');
 const favorite=Object.entries(preferences).sort((a,b)=>b[1]-a[1])[0]?.[0];
 const trait={research:'好奇心旺盛',observe:'爱观星',garden:'热爱自然',chat:'喜欢陪伴',dance:'热爱音乐'}[favorite]||'随和';
 return{genome,color,preferences,familyDesire,mutations,trait:`${trait} · ${mutations.length?'独特星芽':'家族传承'}`};
}
