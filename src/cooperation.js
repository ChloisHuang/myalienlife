// One reservation per activity; queued guests never hold a device for their host.
export const groupId=q=>q.hostActionId??q.sofaGroup??q.id;
export function releaseGroup(people,q){
 const id=groupId(q);
 for(const p of people)for(let i=p.queue.length-1;i>=0;i--)if(groupId(p.queue[i])===id)p.queue.splice(i,1);
}
export function advanceCooperation(people,dt,isPaired){
 // Waiting dependencies must be acyclic. Keep the older arrangement if an old
 // save or a changed queue creates a cycle between two or more invitations.
 const dependencies=new Map(people.map(p=>[p,[]]));
 for(const p of people){const q=p.queue[0];if(!q||!isPaired(q))continue;
  for(const peer of people)if(peer!==p&&peer.queue.some(a=>groupId(a)===groupId(q))&&groupId(peer.queue[0])!==groupId(q))dependencies.get(p).push(peer);
 }
 const done=new Set(),stack=[];
 function visit(p){
  const start=stack.indexOf(p);if(start>=0){const cycle=stack.slice(start),newest=cycle.map(n=>n.queue[0]).filter(q=>q&&isPaired(q)).sort((a,b)=>groupId(b)-groupId(a))[0];if(newest)releaseGroup(people,newest);return;}
  if(done.has(p))return;stack.push(p);for(const peer of dependencies.get(p))visit(peer);stack.pop();done.add(p);
 }
 for(const p of people)visit(p);
 for(const p of people){
  const q=p.queue[0];if(!q||!isPaired(q))continue;
  // Count only time blocked at the front, including interruptions by conversations.
  q.blockedSeconds=q.phase==='acting'?0:(q.blockedSeconds??0)+dt;
  const members=people.filter(n=>n.queue.some(a=>groupId(a)===groupId(q)));
  if(members.length!==2||members.some(n=>Math.min(n.needs.hunger,n.needs.energy)<12)||q.blockedSeconds>180){
   releaseGroup(people,q);p.ai.cooldown=5;p.ai.reason='协作未能会合，先处理自己的事情';
  }
 }
}
