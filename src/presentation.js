const lerp=(a,b,t)=>a+(b-a)*t;
const compatible=(a,b)=>a&&b&&a.uid===b.uid&&a.island===b.island&&a.side===b.side&&Math.hypot(a.x-b.x,a.z-b.z)<6;
function action(out,a,b,t){
 if(!a||!b||a.id!==b.id||a.phase!==b.phase)return;
 out.elapsed=lerp(a.elapsed,b.elapsed,t);
 for(const key of ['transit','blinkTransit'])if(a[key]&&b[key]&&Number.isFinite(a[key].elapsed)&&Number.isFinite(b[key].elapsed))out[key].elapsed=lerp(a[key].elapsed,b[key].elapsed,t);
}

// Render-only snapshots: never tick, predict rewards, or write into the live game.
export function createPresentation(){
 let frames=[],gap=250,cursor=-Infinity,rendered,source;
 return{
  push(state,at=performance.now()){
   const last=frames.at(-1);
   if(last&&(state.speed!==last.state.speed||state.player.uid!==last.state.player.uid||state.day<last.state.day)){frames=[];cursor=-Infinity;source=null;}
   else if(last){const interval=at-last.at;if(interval>100)gap=frames.length===1?interval:lerp(gap,interval,.2);}
   frames.push({state,at});if(frames.length>32)frames.shift();
  },
  sample(current,now=performance.now()){
   if(!frames.length)return current;
   const latest=frames.at(-1);cursor=Math.max(cursor,Math.min(latest.at,now-Math.min(1500,Math.max(250,gap*1.5))));
   while(frames.length>2&&frames[1].at<=cursor)frames.shift();
   const a=frames[0],b=frames[1]??a,t=current.speed?Math.max(0,Math.min(1,(cursor-a.at)/Math.max(1,b.at-a.at))):1;
   if(source!==b){source=b;rendered=structuredClone(b.state);}
   rendered.viewIsland=current.viewIsland;rendered.viewSide=current.viewSide;
   const minutes=lerp((a.state.day-1)*1440+a.state.minute,(b.state.day-1)*1440+b.state.minute,t);rendered.day=Math.floor(minutes/1440)+1;rendered.minute=minutes%1440;
   const people=[['player',a.state.player,b.state.player,rendered.player],...Object.keys(b.state.npcs).map(id=>[id,a.state.npcs[id],b.state.npcs[id],rendered.npcs[id]])];
   for(const [id,from,to,out]of people){
    if(!compatible(from,to))continue;
    out.x=lerp(from.x,to.x,t);out.z=lerp(from.z,to.z,t);
    const qa=id==='player'?a.state.queue:from.queue,qb=id==='player'?b.state.queue:to.queue,qo=id==='player'?rendered.queue:out.queue;
    if(qo?.[0])action(qo[0],qa?.[0],qb?.[0],t);
   }
   return rendered;
  }
 };
}
