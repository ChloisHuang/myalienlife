// Read-only audit: why is the UFO fleet parked on the third island and unused?
import fs from 'node:fs';
import {restore, autonomousCandidates, NEEDS} from '../src/simulation.js';
import {islandOf, sideOf} from '../src/island.js';
import {islandCatalog, islandDefinition, voyageError, spaceLevel, discovered} from '../src/civilization.js';
import {availableUfo, ufoDefinition, hasLocalChef, flightFoodAvailable, fleetLimit} from '../src/space-logistics.js';
import {autonomyBonus} from '../src/autonomy.js';
import {projectComplete} from '../src/settlements.js';

const save = JSON.parse(fs.readFileSync(process.argv[2] ?? '.data/orbit-life.json', 'utf8'));
const g = restore(JSON.stringify(save.state));

console.log('day', g.day, 'minute', g.minute.toFixed(0), 'spaceLevel', spaceLevel(g),
  'projects', Object.fromEntries(Object.entries(g.civilization.projects).map(([k, p]) => [k, `${p.blueprint}/${p.construction}${projectComplete(g, k) ? ' (complete)' : ''}`])));
console.log('fleet', g.space.ships.map(s => `${s.id} t${s.tier} ${s.island}/${s.side} food=${s.food} dur=${s.durability}`).join(' | '));
console.log('provisions', g.space.provisions, 'fleetLimit', fleetLimit(g));
console.log('localsChef', Object.keys(islandCatalog(g)).map(id => `${id}:${hasLocalChef(g, id)}`).join(' '));

const actor = id => id === 'player'
  ? {id, position: g.player, needs: g.needs, skills: g.skills, queue: g.queue, ai: g.autonomy}
  : {...g.npcs[id], id, position: g.npcs[id]};

const people = [...(g.player.alive ? [actor('player')] : []), ...Object.keys(g.npcs).map(actor)];

console.log('\n=== per-resident voyage options ===');
for (const p of people) {
  const from = islandOf(p.position);
  const ships = g.space.ships.filter(s => s.island === from && s.side === sideOf(p.position));
  const cands = autonomousCandidates(g, p.id).filter(c => c.type === 'voyage' || c.type === 'starVoyage');
  const perDest = Object.keys(islandCatalog(g)).map(dest => {
    if (dest === from) return null;
    const err = voyageError(g, p.position, p.skills, dest);
    const ship = availableUfo(g, p.position, islandDefinition(g, dest).level, 1);
    return `${islandDefinition(g, dest).name}[lvl${islandDefinition(g, dest).level}]${ship ? 'OK' : 'NO-SHIP'}`;
  }).filter(Boolean);
  console.log(`${(p.position.name ?? p.id).padEnd(6)} ${String(p.id).padEnd(15)} at ${from}/${sideOf(p.position)} home=${p.position.settlementIsland ?? 'eva'} low=${Math.min(...Object.values(p.needs)).toFixed(1)} localShips=${ships.length} voyageCandidates=${cands.map(c => c.destinationId).join(',') || 'none'}`);
  console.log(`        dests: ${perDest.join('  ')}`);
}

console.log('\n=== autonomyBonus on the return-home voyage for each remote resident ===');
for (const p of people) {
  const from = islandOf(p.position), home = p.position.settlementIsland ?? 'eva';
  if (from === home) continue;
  const portal = g.objects.find(o => o.type === 'portal' && islandOf(o) === from);
  if (!portal) { console.log(`${p.position.name}: no portal on ${from}`); continue; }
  const c = {type: 'voyage', targetId: portal.id, destinationId: home};
  const bonus = autonomyBonus(g, p, c, people);
  const ess = ['food', 'pod', 'shower'].every(t => g.objects.some(o => o.type === t && islandOf(o) === from && sideOf(o) === sideOf(p.position)));
  console.log(`${p.position.name.padEnd(6)} ${from} -> ${home} (home) completeHere=${projectComplete(g, from)} essentials=${ess} lowestNeed=${Math.min(...Object.values(p.needs)).toFixed(1)} bonus=${bonus}`);
}
