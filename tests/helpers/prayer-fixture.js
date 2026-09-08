import {createGame,buyItem,enqueue,tick} from '../../src/simulation.js';

export function prayerFixture(side,{success=false}={}){
 const state=createGame();state.viewSide=side;state.player.side=side;state.player.x=0;state.player.z=5.6;
 for(const npc of Object.values(state.npcs))npc.ai.enabled=false;
 if(side==='back'){state.player.prayer.nether=9;state.player.prayer.mutations=['spines','freckles','eyes'];}
 const tree=buyItem(state,'spiritTree',0,4).object;enqueue(state,'pray',tree.id);
 const random=Math.random;
 try{
  Math.random=()=>0;
  for(let i=0;i<500;i++){
   tick(state,.1);const action=state.queue[0];
   if(success?action?.phase==='celebrating'&&action.elapsed>=1:action?.phase==='acting'&&action.elapsed>=2){state.speed=0;return state;}
  }
 }finally{Math.random=random;}
 throw new Error('Prayer fixture did not reach the requested animation');
}
