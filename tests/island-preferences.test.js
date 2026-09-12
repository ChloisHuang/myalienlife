import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,restore,serialize,autonomousCandidates} from '../src/simulation.js';
import {PROJECT_WORK} from '../src/settlements.js';
import {autonomyBonus} from '../src/autonomy.js';
import {environmentProfile,environmentFit,migrationPreference,migrationCooldownRemaining,MIGRATION_COOLDOWN_MINUTES,MIGRATION_MIN_ADVANTAGE} from '../src/island-preferences.js';

const run=(g,n)=>{for(let i=0;i<n*10;i++)tick(g,.1,()=>0);};
function remoteGame(){
 const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;
 g.civilization.discoveryPath=['home','spore'];g.civilization.visits.spore=1;Object.assign(g.civilization.projects.spore,PROJECT_WORK);
 g.player.island=g.viewIsland='spore';g.player.homeIsland='home';g.player.x=0;g.player.z=2;g.config.time.gameMinutesPerRealSecond=2;
 g.objects.push({id:'spore-terminal',type:'constructionTerminal',island:'spore',side:'front',x:3,z:2,rotation:0});
 return g;
}

test('a construction terminal offers the same settlement action on the home island',()=>{
 const g=createGame();g.civilization.discoveryPath=['home','spore'];g.civilization.visits.spore=1;g.player.homeIsland='spore';
 g.objects.push({id:'home-terminal',type:'constructionTerminal',island:'home',side:'front',x:3,z:2,rotation:0});
 assert.equal(enqueue(g,'settleIsland','home-terminal').ok,true);
 run(g,8);
 assert.equal(g.player.homeIsland,'home');
 assert.ok(g.player.migrationCooldownUntil-((g.day-1)*1440+g.minute)>MIGRATION_COOLDOWN_MINUTES-20);
});

test('migration preference differs by resident and only a meaningful advantage creates an autonomous candidate',()=>{
 const g=remoteGame();
 const natureLover=g.player;
 natureLover.environmentPreferences={nature:100,community:0,discovery:100,calm:0};
 const quietResident=g.npcs.zig;
 quietResident.island='spore';quietResident.homeIsland='home';quietResident.environmentPreferences={nature:10,community:10,discovery:20,calm:100};
 const nature=migrationPreference(natureLover,'spore',environmentProfile('spore'), 'home',environmentProfile('home'));
 const quiet=migrationPreference(quietResident,'spore',environmentProfile('spore'), 'home',environmentProfile('home'));
 assert.ok(nature.advantage>=MIGRATION_MIN_ADVANTAGE);
 assert.ok(quiet.advantage<MIGRATION_MIN_ADVANTAGE);
 const candidates=autonomousCandidates(g,'player').filter(c=>c.type==='settleIsland');
 assert.equal(candidates.length,1);
});

test('experience nudges environmental fit and migration is cooled down after moving',()=>{
 const g=remoteGame();
 g.player.environmentPreferences={nature:100,community:10,discovery:90,calm:20};
 const before=environmentFit(g.player,environmentProfile('spore'));
 g.player.environmentExperience={nature:60,community:0,discovery:30,calm:-20};
 const after=environmentFit(g.player,environmentProfile('spore'));
 assert.ok(after>before);
 g.player.migrationCooldownUntil=(g.day-1)*1440+g.minute+MIGRATION_COOLDOWN_MINUTES;
 const person={id:'player',position:g.player,needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy};
 assert.equal(migrationCooldownRemaining(g.player,(g.day-1)*1440+g.minute),MIGRATION_COOLDOWN_MINUTES);
 assert.equal(autonomyBonus(g,person,{type:'settleIsland',targetId:'spore-terminal'},[person]),null);
 g.player.island='home';g.objects.push({id:'home-terminal',type:'constructionTerminal',island:'home',side:'front',x:-3,z:2,rotation:0});
 assert.equal(enqueue(g,'settleIsland','home-terminal').ok,false);
});

test('environment preferences, experience, birthplace and migration cooldown survive reload',()=>{
 const g=remoteGame();g.player.environmentPreferences.nature=91;g.player.environmentExperience.discovery=-12;g.player.lastEnvironmentExperienceDay=4;g.player.migrationCooldownUntil=9000;g.player.homeIsland='spore';
 const loaded=restore(serialize(g));
 assert.equal(loaded.player.environmentPreferences.nature,91);
 assert.equal(loaded.player.environmentExperience.discovery,-12);
 assert.equal(loaded.player.lastEnvironmentExperienceDay,4);
 assert.equal(loaded.player.migrationCooldownUntil,9000);
 const baby=loaded.npcs.nova;
 assert.equal(baby.homeIsland,'home');
});
