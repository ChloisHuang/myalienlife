const CONDITIONS={
 clear:{name:'晴空',icon:'CloudSun',description:'微风带着星尘',temperature:0,wind:.2},
 mist:{name:'星雾',icon:'CloudFog',description:'薄雾漫过浮岛',temperature:-2,wind:.3},
 rain:{name:'微雨',icon:'CloudDrizzle',description:'细雨轻落，菌光流转',temperature:-3,wind:.65},
 spores:{name:'孢子风',icon:'Wind',description:'发光孢子随风迁徙',temperature:1,wind:.85},
};
const SEQUENCE=['clear','mist','rain','mist','clear','spores','clear','rain'];
const PERIOD=180,TRANSITION=24;
const conditionAt=epoch=>SEQUENCE[((epoch+Math.floor(epoch/8)*3)%SEQUENCE.length+SEQUENCE.length)%SEQUENCE.length];

// Deriving weather from the saved calendar makes pause, speed and reload agree,
// without a second clock or a random roll on page load.
export function getWeather({day,minute}){
 const elapsed=(day-1)*1440+minute-480,epoch=Math.floor(elapsed/PERIOD);
 const phase=Math.min(1,(elapsed-epoch*PERIOD)/TRANSITION),blend=phase*phase*(3-2*phase);
 const from=conditionAt(epoch-1),to=conditionAt(epoch),weights={clear:0,mist:0,rain:0,spores:0};
 weights[from]+=1-blend;weights[to]+=blend;
 const type=blend<.5?from:to,condition=CONDITIONS[type];
 const mix=key=>Object.entries(weights).reduce((sum,[id,weight])=>sum+CONDITIONS[id][key]*weight,0);
 return {type,weights,wind:mix('wind'),temperature:Math.round(22+Math.sin((minute/1440-.25)*Math.PI*2)*2+mix('temperature')),
  name:condition.name,icon:condition.icon,description:condition.description,
  transitioning:from!==to&&phase<1,nextName:CONDITIONS[to].name,
 };
}
