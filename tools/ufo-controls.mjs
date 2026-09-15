// Read-only controls: which single change makes the stranded fleet fly again?
import fs from 'node:fs';
import {restore, tick} from '../src/simulation.js';

const save = JSON.parse(fs.readFileSync('.data/orbit-life.json', 'utf8'));
const clone = () => restore(JSON.stringify(save.state));

function run(label, mutate, days = 2) {
  const g = clone();
  mutate(g);
  const counts = {};
  const seen = new Set();
  const step = 0.1, ticks = Math.round(days * 1440 / (step * 2));
  for (let i = 0; i < ticks; i++) {
    tick(g, step, Math.random);
    const rows = [...(g.player.alive ? [['player', g.queue, g.player]] : []), ...Object.entries(g.npcs).map(([id, n]) => [id, n.queue, n])];
    for (const [id, queue, pos] of rows) for (const q of queue) {
      const key = `${id}:${q.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (['voyage', 'starVoyage', 'boardUfo'].includes(q.type)) {
        counts[q.type] = (counts[q.type] ?? 0) + 1;
        console.log(`   ${label}: ${pos.name} ${q.type} -> ${q.destinationId}`);
      }
    }
  }
  console.log(`${label}: voyage=${counts.voyage ?? 0} starVoyage=${counts.starVoyage ?? 0} boardUfo=${counts.boardUfo ?? 0}; fleet=${g.space.ships.map(s => `${s.island}/${s.durability}`).join(',')}`);
  return counts;
}

console.log('A. baseline (fleet parked on ocean, as saved)');
run('A', () => {});

console.log('\nB. same save, fleet redistributed to home/spore (nothing else changed)');
run('B', g => {
  g.space.ships.forEach((s, i) => { s.island = ['spore', 'eva', 'spore'][i]; s.side = 'front'; });
});

console.log('\nC. baseline, but the three ocean residents are put into emergency (all needs = 5)');
run('C', g => {
  for (const id of ['resident-5191', 'resident-42662', 'resident-662418']) {
    const n = g.npcs[id];
    for (const k of Object.keys(n.needs)) n.needs[k] = 5;
  }
});

console.log('\nD. baseline, but an architect moves to ocean so the island can be developed (sanity: other AI still works)');
run('D', g => {
  g.npcs['resident-670882'].island = 'ocean';
  g.npcs['resident-670882'].side = 'front';
});
