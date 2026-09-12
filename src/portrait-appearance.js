import {appearance} from './characters.js';
import {isRadiant,isNether} from './prayer.js';
import {livingResident} from './living-state.js';
import {livingAppearance} from './living-adaptation.js';

// Portraits pose at time zero. Only antenna attachments from the living visual
// enter the portrait scene; its world-space shadow and aura are not attached.
export function portraitAppearanceKey(game,person,active){
 const living=livingResident(game,person),buds=livingAppearance(living).buds;
 return JSON.stringify([
  active,person.color,appearance(person,game.config.lifeStages),person.genome,
  isRadiant(person),isNether(person),person.prayer.mutations,
  buds,buds?Math.min(1,living.garden/40):0,buds?living.charge>0:false,
  ['roots','shade'].includes(living.imprint)?living.imprint:null
 ]);
}
