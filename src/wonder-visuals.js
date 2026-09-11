import * as THREE from 'three';

const colors={daily:0xb9d8ff,grow:0xc3ed96,party:0xf1a6df,sleep:0x96b8ff,insight:0xffd88c};
function glow(parent,geometry,color){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false}));parent.add(mesh);return mesh;}
export function createWonderVisual(group,type){
 if(!['polelight','glowlight','relic','crystal','lamp'].includes(type))return null;
 const effects=new THREE.Group();group.add(effects);const particles=[],glyphs=[];
 if(type==='glowlight')for(let i=0;i<18;i++)particles.push(glow(effects,new THREE.SphereGeometry(.035,6,4),0xb8ffe7));
 if(type==='relic'){
  for(let i=0;i<3;i++){const ring=glow(effects,new THREE.TorusGeometry(.5+i*.13,.017,4,32),[0x94dacd,0xc8b0ff,0xf8d79b][i]);ring.rotation.x=Math.PI/2;ring.position.y=.5+i*.38;glyphs.push(ring);}
  const archiveGlyph=new THREE.Group();effects.add(archiveGlyph);archiveGlyph.position.y=2;
  for(let i=0;i<7;i++){const h=.2+(i%3)*.15,tower=glow(archiveGlyph,new THREE.BoxGeometry(.1,h,.1),0xa7f6ea);tower.position.set(Math.cos(i)*.38,h/2,Math.sin(i)*.38);}
  glyphs.push(archiveGlyph);
 }
 const aura=['polelight','crystal'].includes(type)?glow(effects,new THREE.RingGeometry(.7,.76,48),0xb9d8ff):null;
 if(aura){aura.rotation.x=-Math.PI/2;aura.position.y=.015;}
 return {update(state,time,action){
  if(!state)return;
  if(type==='polelight'){const color=colors[state.mode];group.userData.areaLight.color.set(color);group.userData.lens.material.color.set(color);group.userData.lens.material.emissive.set(color);aura.material.color.set(color);aura.visible=state.mode!=='daily';aura.scale.setScalar(2);}
  if(type==='glowlight')for(const [i,p]of particles.entries()){const show=state.showUntil>time.minutes;p.visible=show||i<Math.floor(state.bugs)*3;const phase=time.seconds*(show?1.4:.65)+i*2.4,r=show?1.3+i*.06:.4+i%3*.12;p.position.set(Math.cos(phase)*r,.7+(show?i*.075:.2)+Math.sin(phase*1.3)*.18,Math.sin(phase)*r);}
  if(type==='relic'){glyphs.forEach((m,i)=>{m.visible=i<3?state.chapter>i:state.chapter===3;m.rotation.y=time.seconds*(i===3?.12:.25);});if(group.userData.orb)group.userData.orb.material.emissiveIntensity=.15+state.chapter*.4;}
  if(type==='crystal'){const color=colors[state.mode];for(const m of group.userData.crystalLight.facets){m.color.set(color);m.attenuationColor.set(color);m.emissive.set(color);m.bio.strength.value=.08+state.charge/100*(state.armed?1.8:.7);}aura.material.color.set(color);aura.visible=state.armed;aura.scale.setScalar(1.2+Math.sin(time.seconds*2)*.12);}
  if(type==='lamp'){const orb=group.userData.playOrb,t=action?.elapsed||0;orb.position.set(0,1.4+Math.sin(time.seconds*1.4)*.08,0);if(action?.phase==='acting'){if(action.type==='passOrb')orb.position.set(0,1.25+Math.abs(Math.cos(t*3))*.35,Math.sin(t*3));else if(action.type==='chaseOrb')orb.position.set(Math.sin(t*2)*.65,1.25+Math.sin(t*4)*.12,.5+Math.cos(t*2)*.25);else if(action.type==='sootheOrb')orb.position.set(Math.sin(t)*.25,.85+Math.sin(t*2)*.12,.5);}orb.material.emissiveIntensity=state.cooldown>time.minutes?.12:.7;}
 }};
}
