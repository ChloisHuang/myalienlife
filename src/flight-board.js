import {getLanguage,translateText} from './i18n.js';

// A flight is a boarding pass: a tear-off stub, a perforated card, and the leg printed on it. The
// stub is the boarding itself — it leaves with the passengers, so the card closes up the moment the
// beam finishes. world.js owns the flight data; this module owns how it is read.
const STUB='登机中';

// One ticket per ship, built once and then updated in place: syncUfos runs on every frame of a
// flight, and rebuilding the markup would restart the tear animation on every one of them.
export function createFlightBoard(container){
 const board=document.createElement('div');
 board.className='ufo-flight-board';
 board.setAttribute('aria-label','UFO 航行动态');
 container.append(board);
 const tickets=new Map();
 return {
  update(flights){
   const rows=flights.filter(flight=>flight?.id&&flight?.from&&flight?.to),live=new Set();
   for(const flight of rows){
    live.add(flight.id);
    let ticket=tickets.get(flight.id);
    if(!ticket){ticket=createTicket();tickets.set(flight.id,ticket);board.append(ticket.root);}
    syncTicket(ticket,flight);
   }
   for(const [id,ticket] of tickets)if(!live.has(id)){ticket.root.remove();tickets.delete(id);}
   board.hidden=!rows.length;
  }
 };
}

function createTicket(){
 const root=document.createElement('div');
 root.className='ufo-ticket';
 // No whitespace between tags: every reader of this board — player, screen reader or test — should
 // see the route as one run, not as fragments split by layout.
 root.innerHTML='<div class="ufo-stub"><div class="ufo-stub-tab"><b class="ufo-stub-label"></b></div></div>'
  +'<div class="ufo-card"><div class="ufo-body"><div class="ufo-route"></div><div class="ufo-meta"><div class="ufo-stage"></div></div></div><span class="ufo-track"><i></i></span><div class="ufo-stamp"><b></b><i>%</i></div></div>';
 const ticket={root,boarded:undefined,percent:null,width:null};
 for(const [key,selector] of [['label','.ufo-stub-label'],['route','.ufo-route'],['stage','.ufo-stage'],['value','.ufo-stamp b'],['track','.ufo-track i']])ticket[key]=root.querySelector(selector);
 return ticket;
}

function syncTicket(ticket,flight){
 const label=translateText(STUB,getLanguage());
 if(ticket.label.textContent!==label)ticket.label.textContent=label;
 const route=`${flight.from} → ${flight.to}`;
 if(ticket.route.textContent!==route)ticket.route.textContent=route;
 const stage=translateText(flight.stage,getLanguage());
 if(ticket.stage.textContent!==stage)ticket.stage.textContent=stage;
 const percent=Math.round(flight.progress*100),text=String(percent);
 if(ticket.percent!==text){ticket.percent=text;ticket.value.textContent=text;}
 if(ticket.width!==percent){ticket.width=percent;ticket.track.style.width=`${percent}%`;}
 // The stub tears exactly once, when boarding completes. A pass that loads already boarded simply
 // arrives without its stub rather than replaying the tear.
 if(ticket.boarded!==flight.boarded){
  const tearing=ticket.boarded===false&&flight.boarded;
  ticket.boarded=flight.boarded;
  ticket.root.toggleAttribute('data-boarded',flight.boarded);
  if(tearing)ticket.root.setAttribute('data-tearing','');
 }
}
