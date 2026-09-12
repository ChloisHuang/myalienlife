export function createAmbientClock(){
 let time,last;
 return {sample(seconds,speed,now){
  if(last===undefined)time=seconds;
  else time+=Math.min(.1,Math.max(0,(now-last)/1000))*speed;
  last=now;return time;
 }};
}
