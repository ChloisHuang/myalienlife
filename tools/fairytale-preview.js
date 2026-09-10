import {createIcons,SunMoon,Focus,X,Armchair,Lamp,Flower2} from 'lucide';
import {createGame,ensureStarIsland,buyItem,enqueue,tick} from '../src/simulation.js';
import {createWorld} from '../src/world.js';

// Isolated in-memory acceptance scene: never reads or writes the user's save.
const game=createGame(),status=document.querySelector('#status'),container=document.querySelector('#world');
game.viewIsland='spore';game.civilization.discoveryPath=['home','spore'];game.civilization.visits.spore=1;
game.minute=720;game.money=5000;game.autonomy.enabled=false;
game.civilization.projects.spore.blueprint=300;game.civilization.projects.spore.construction=600;
for(const n of Object.values(game.npcs))n.ai.enabled=false;
ensureStarIsland(game,'spore');game.player.island='spore';game.player.x=0;game.player.z=4;
game.objects.push({id:'preview-back-gate',type:'gate',x:-7,z:3,rotation:0,side:'back',island:'spore'});
createIcons({icons:{SunMoon,Focus,X,Armchair,Lamp,Flower2}});
const world=await createWorld(container,()=>game,{
 onClick(target){if(target.kind==='ground'){const result=enqueue(game,'walk',null,target.point);status.textContent=result.ok?'':result.message;}},
 onHover(){},
 onPlace(type,x,z,rotation){const result=buyItem(game,type,x,z,rotation);status.textContent=result.ok?'已摆放':result.message;if(result.ok)world.setBuild(null);}
});
let previous=performance.now();
function frame(now){tick(game,Math.min((now-previous)/1000,.05));previous=now;world.render();requestAnimationFrame(frame);}
status.textContent='';container.dataset.ready='true';requestAnimationFrame(frame);
document.querySelectorAll('button[data-side]').forEach(button=>button.onclick=()=>{
 game.viewSide=button.dataset.side;game.player.side=game.viewSide;game.queue=[];world.setBuild(null);
 document.body.classList.toggle('back',game.viewSide==='back');
 document.querySelectorAll('button[data-side]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
});
document.querySelectorAll('[data-item]').forEach(button=>button.onclick=()=>world.setBuild(button.dataset.item));
document.querySelector('#day').onclick=()=>{game.minute=game.minute<1080?1320:720;};
document.querySelector('#reset').onclick=()=>world.resetCamera();
document.querySelector('#cancel').onclick=()=>world.setBuild(null);
document.querySelector('#progress').oninput=e=>{game.civilization.projects.spore.construction=Number(e.target.value)*6;document.querySelector('#progress-value').value=`${e.target.value}%`;};
window.addEventListener('keydown',e=>{if(e.key==='Escape')world.setBuild(null);if(e.key.toLowerCase()==='r')world.rotateBuild();});
