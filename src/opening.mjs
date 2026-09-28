import { Pokemon, TYPE_CHART } from './vendor/calc.mjs';
import { activeIndices, clone, STAT_NAMES, OPENING_RULES_VERSION } from './model.mjs';

export const WEATHER_NAMES = { '': '无天气', Sun: '晴天', Rain: '雨天', Sand: '沙暴', Snow: '雪天' };
export const TERRAIN_NAMES = { '': '无场地', Electric: '电气场地', Grassy: '青草场地', Misty: '薄雾场地', Psychic: '精神场地' };
const WEATHER_ABILITIES = { Drought: 'Sun', Drizzle: 'Rain', 'Sand Stream': 'Sand', 'Snow Warning': 'Snow' };
const TERRAIN_ABILITIES = { 'Electric Surge': 'Electric', 'Grassy Surge': 'Grassy', 'Psychic Surge': 'Psychic' };
const abilityOf = (b) => b.currentAbility !== undefined ? b.currentAbility : b.ability;
const RECEIVER_UNCOPYABLE = new Set([
  'Receiver','Power of Alchemy','Trace','Forecast','Flower Gift','Multitype',
  'Illusion','Wonder Guard','Zen Mode','Imposter','Stance Change','Power Construct',
  'Schooling','Comatose','Shields Down','Disguise','RKS System','Battle Bond',
  'Wandering Spirit','As One','Zero to Hero','Commander','Gulp Missile','Ice Face',
]);
export const OPENING_RULES = OPENING_RULES_VERSION;
export function hasFriendGuard(scene,side) {
  return scene.mode==='double'&&scene.actors.some((b,i)=>(i<2)===(side==='attacker')&&b.present&&b.hp>0&&abilityOf(b)==='Friend Guard');
}
const speciesOf = (b,c) => c.pokemon.find(p=>p.id===b.species);
const abilityName = (ability,c) => c.abilities.find(a=>a.name===ability)?.zh||ability;
const partnerIndex = (index) => index < 2 ? 1-index : 5-index;
function triggerOpeningReceiver(state,faintedIndex,catalog) {
  if(state.scene.mode!=='double')return;
  const receiverIndex=partnerIndex(faintedIndex),receiver=state.scene.actors[receiverIndex];
  if(!receiver?.present||state.hp[receiverIndex]<=0||!['Receiver','Power of Alchemy'].includes(abilityOf(receiver)))return;
  const copied=abilityOf(state.scene.actors[faintedIndex]);
  if(!copied||RECEIVER_UNCOPYABLE.has(copied))return;
  const source=abilityName(abilityOf(receiver),catalog);
  receiver.currentAbility=copied;
  state.log.push(`${receiver.name} ${source}获得${abilityName(copied,catalog)}`);
}
function rawPokemon(b,c) {
  return new Pokemon(0,speciesOf(b,c).name,{nature:b.nature,evs:b.points,ability:abilityOf(b),item:b.item});
}
export function entrySpeed(b,c) {
  let speed=rawPokemon(b,c).rawStats.spe;
  if(b.item==='Choice Scarf') speed=Math.floor(speed*1.5);
  if(['Iron Ball','Macho Brace','Power Anklet','Power Band','Power Belt','Power Bracer','Power Lens','Power Weight'].includes(b.item)) speed=Math.floor(speed/2);
  if(b.species==='ditto'&&b.item==='Quick Powder') speed*=2;
  return speed;
}
export function changeBoost(b,changes) {
  const applied={};
  for(const [key,value] of Object.entries(changes||{})) {
    if(!(key in b.boosts)) {
      if(!['accuracy','evasion'].includes(key)) continue;
      b.boosts[key]=0;
    }
    const delta=abilityOf(b)==='Contrary'?-value:abilityOf(b)==='Simple'?value*2:value;
    const before=b.boosts[key];
    b.boosts[key]=Math.max(-6,Math.min(6,before+delta));
    if(b.boosts[key]!==before) applied[key]=b.boosts[key]-before;
  }
  return applied;
}
export function triggerOpportunist(state, boostedIndex, applied) {
  const gains=Object.fromEntries(Object.entries(applied||{}).filter(([,value])=>value>0));
  if(!Object.keys(gains).length)return;
  for(const i of activeIndices(state.scene)) {
    const b=state.scene.actors[i];
    if((i<2)===(boostedIndex<2)||!b.present||state.hp[i]<=0||abilityOf(b)!=='Opportunist')continue;
    const copied=changeBoost(b,gains);
    if(!Object.keys(copied).length)continue;
    state.log.push(`${b.name} 跟风：${Object.keys(copied).map(k=>`${STAT_NAMES[k]||k} ${b.boosts[k]>0?'+':''}${b.boosts[k]}`).join('、')}`);
  }
}
function triggerDropAbility(state,di,applied,opponent,guaranteed) {
  const d=state.scene.actors[di];
  if(opponent&&guaranteed&&!state.done.includes(di)&&Object.values(applied).some(v=>v<0)) {
    const key=abilityOf(d)==='Defiant'?'atk':abilityOf(d)==='Competitive'?'spa':null;
    if(key) {
      const raised=changeBoost(d,{[key]:2});
      state.log.push(`${d.name} ${key==='atk'?'不服输':'好胜'}：${STAT_NAMES[key]} ${d.boosts[key]>0?'+':''}${d.boosts[key]}`);
      triggerOpportunist(state,di,raised);
    }
  }
}
function blockedOpponentDrops(d,changes,label,ignoreAbility=false) {
  const allowed={...changes};
  for(const key of Object.keys(allowed)) {
    if(allowed[key]>=0) continue;
    const current=abilityOf(d);
    const all=(!ignoreAbility&&['Clear Body','White Smoke','Full Metal Body'].includes(current))||d.item==='Clear Amulet';
    const intimidation=!ignoreAbility&&label==='威吓'&&['Inner Focus','Own Tempo','Oblivious','Scrappy'].includes(current);
    const specific=!ignoreAbility&&((key==='atk'&&current==='Hyper Cutter')||(key==='def'&&current==='Big Pecks')||(key==='accuracy'&&['Keen Eye','Mind’s Eye','Illuminate'].includes(current)));
    if(all||intimidation||specific) delete allowed[key];
  }
  return allowed;
}
export function applyOpponentBoost(state,ai,di,changes,label,guaranteed=true,catalog=null) {
  const a=state.scene.actors[ai], d=state.scene.actors[di];
  if(!state.hp[di]) return;
  const opponent=(ai<2)!==(di<2),moldBreaker=abilityOf(a)==='Mold Breaker';
  if(opponent&&abilityOf(d)==='Mirror Armor'&&!moldBreaker&&Object.values(changes).some(v=>v<0)) {
    const reflected=Object.fromEntries(Object.entries(changes).filter(([,value])=>value<0));
    const retained=Object.fromEntries(Object.entries(changes).filter(([,value])=>value>=0));
    const ownApplied=changeBoost(d,retained);triggerOpportunist(state,di,ownApplied);
    const allowed=blockedOpponentDrops(a,reflected,label,false),applied=changeBoost(a,allowed);
    state.log.push(`${d.name} 镜甲反射 ${label} → ${a.name}${Object.keys(applied).length?`：${Object.keys(applied).map(k=>`${STAT_NAMES[k]||k} ${a.boosts[k]>0?'+':''}${a.boosts[k]}`).join('、')}`:'，但未造成能力变化'}`);
    triggerDropAbility(state,ai,applied,true,guaranteed);
    return;
  }
  const allowed=opponent?blockedOpponentDrops(d,changes,label,moldBreaker):{...changes};
  if(opponent&&!moldBreaker&&catalog&&catalog.pokemon.find(p=>p.id===d.species)?.types.includes('Grass')) {
    const flowerVeil=activeIndices(state.scene).some(i=>(i<2)===(di<2)&&state.scene.actors[i].present&&state.hp[i]>0&&abilityOf(state.scene.actors[i])==='Flower Veil');
    if(flowerVeil)for(const key of Object.keys(allowed))if(allowed[key]<0)delete allowed[key];
  }
  const applied=changeBoost(d,allowed);
  if(!Object.keys(applied).length) { state.log.push(`${d.name}：${label}未造成能力变化`); return; }
  const describe=()=>Object.keys(applied).map(k=>`${STAT_NAMES[k]||k} ${d.boosts[k]>0?'+':''}${d.boosts[k]}`).join('、');
  state.log.push(`${a.name} ${label} → ${d.name}：${describe()}`);
  triggerOpportunist(state,di,applied);
  // Calculator contract: only guaranteed opponent drops before this actor attacks.
  triggerDropAbility(state,di,applied,opponent,guaranteed);
}
function applyFieldDrop(state,di,changes,label) {
  const d=state.scene.actors[di];
  if(abilityOf(d)==='Mirror Armor') { state.log.push(`${d.name} 镜甲挡回${label}，但场景没有可识别的施放者`); return; }
  const allowed=blockedOpponentDrops(d,changes,label);
  const applied=changeBoost(d,allowed);
  if(!Object.keys(applied).length) { state.log.push(`${d.name}：${label}未造成能力变化`); return; }
  state.log.push(`${d.name} ${label}：${Object.keys(applied).map(k=>`${STAT_NAMES[k]||k} ${d.boosts[k]>0?'+':''}${d.boosts[k]}`).join('、')}`);
  triggerDropAbility(state,di,applied,true,true);
}
export function weatherCandidates(scene,catalog,indices=activeIndices(scene).filter(i=>scene.actors[i].present&&scene.actors[i].hp>0)) {
  if(scene.field.weatherMode==='manual'||(!scene.field.weatherMode&&scene.field.weather))
    return [{weather:scene.field.weather||'',p:1,source:'手动天气'}];
  const setters=indices.filter(i=>WEATHER_ABILITIES[abilityOf(scene.actors[i])]);
  if(!setters.length) return [{weather:'',p:1,source:'自动天气：没有开天气特性'}];
  const slowest=Math.min(...setters.map(i=>entrySpeed(scene.actors[i],catalog)));
  const tied=setters.filter(i=>entrySpeed(scene.actors[i],catalog)===slowest),groups=new Map();
  for(const i of tied) {
    const weather=WEATHER_ABILITIES[abilityOf(scene.actors[i])];
    const g=groups.get(weather)||{weather,p:0,source:''};
    g.p+=1/tied.length;g.source+=(g.source?'、':'')+scene.actors[i].name;groups.set(weather,g);
  }
  return [...groups.values()].map(g=>({...g,source:`自动天气：${g.source}${groups.size>1?'（同速天气分支）':''}`}));
}
export function terrainCandidates(scene,catalog,indices=activeIndices(scene).filter(i=>scene.actors[i].present&&scene.actors[i].hp>0)) {
  if(scene.field.terrainMode==='manual'||(!scene.field.terrainMode&&scene.field.terrain))
    return [{terrain:scene.field.terrain||'',p:1,source:'手动场地'}];
  const setters=indices.filter(i=>TERRAIN_ABILITIES[abilityOf(scene.actors[i])]);
  if(!setters.length)return [{terrain:'',p:1,source:'自动场地：没有开场场地特性'}];
  const slowest=Math.min(...setters.map(i=>entrySpeed(scene.actors[i],catalog)));
  const tied=setters.filter(i=>entrySpeed(scene.actors[i],catalog)===slowest),groups=new Map();
  for(const i of tied){const terrain=TERRAIN_ABILITIES[abilityOf(scene.actors[i])];const group=groups.get(terrain)||{terrain,p:0,source:''};group.p+=1/tied.length;group.source+=(group.source?'、':'')+scene.actors[i].name;groups.set(terrain,group);}
  return [...groups.values()].map(group=>({...group,source:`自动场地：${group.source}${groups.size>1?'（同速场地分支）':''}`}));
}
export function openingBranches(input,catalog) {
  const scene=clone(input),max=scene.actors.map(b=>rawPokemon(b,catalog).maxHP());
  const hp=scene.actors.map((b,i)=>Math.floor(max[i]*b.hp/100+1e-9));
  const state={scene,max,hp,dealt:[0,0,0,0],done:[],p:1,log:[],consumedItems:[]};
  for(const i of activeIndices(scene)) {
    const b=scene.actors[i];if(!b.present||hp[i]<=0)continue;
    const side=scene.field[i<2?'attacker':'defender'],types=speciesOf(b,catalog).types;
    const grounded=b.item==='Iron Ball'||scene.field.gravity||(!types.includes('Flying')&&!['Levitate','Eelevate'].includes(abilityOf(b))&&b.item!=='Air Balloon');
    const hazards=[];
    const ignoresDamage=abilityOf(b)==='Magic Guard'||b.item==='Heavy-Duty Boots';
    if(side.isSR&&!ignoresDamage)hazards.push(['隐形岩',Math.max(1,Math.floor(max[i]/8*types.reduce((n,t)=>n*TYPE_CHART[0].Rock[t],1)))]);
    const layers=Number(side.spikes||0);
    if(!Number.isInteger(layers)||layers<0||layers>3)throw new Error('撒菱层数必须是 0 至 3');
    if(layers&&grounded&&!ignoresDamage)hazards.push([`${layers} 层撒菱`,Math.max(1,Math.floor(max[i]*[0,1/8,1/6,1/4][layers]))]);
    for(const [name,amount] of hazards) {
      if(hp[i]<=0)break;
      const before=hp[i],loss=Math.min(hp[i],amount);hp[i]-=loss;
      state.log.push(`${b.name} ${name}损血 ${(loss/max[i]*100).toFixed(1)}%，剩余 ${(hp[i]/max[i]*100).toFixed(1)}%`);
      if(before>0&&hp[i]===0)triggerOpeningReceiver(state,i,catalog);
    }
    if(side.stickyWeb&&grounded&&b.item!=='Heavy-Duty Boots'&&hp[i]>0)
      applyFieldDrop(state,i,{spe:-1},'黏黏网');
    b.hp=hp[i]/max[i]*100;
  }
  let live=activeIndices(scene).filter(i=>scene.actors[i].present&&hp[i]>0);
  for(const i of live) {
    const user=scene.actors[i];
    if(abilityOf(user)!=='Imposter')continue;
    const ti=i<2?i+2:i-2,target=scene.actors[ti];
    if(!target?.present||hp[ti]<=0||target.transformed||abilityOf(target)==='Illusion')continue;
    const originalSpecies=user.species,originalHPPoints=user.points.hp;
    user.imposterOriginalSpecies=originalSpecies;
    user.transformed=true;
    user.species=target.species;
    user.currentAbility=abilityOf(target);
    user.nature=target.nature;
    user.points={...clone(target.points),hp:originalHPPoints};
    user.boosts=clone(target.boosts);
    user.moves=clone(target.moves);
    user.selected=target.selected;
    user.battleForm=target.battleForm;
    state.log.push(`${user.name} 变身者变成了 ${target.name}`);
  }
  let states=[state];
  for(const i of [...live].sort((a,b)=>entrySpeed(scene.actors[b],catalog)-entrySpeed(scene.actors[a],catalog))) {
    states=states.flatMap(current=>{
      const user=current.scene.actors[i];
      if(abilityOf(user)!=='Trace')return [current];
      const candidates=activeIndices(current.scene).filter(j=>(j<2)!==(i<2)&&current.scene.actors[j].present&&current.hp[j]>0&&!RECEIVER_UNCOPYABLE.has(abilityOf(current.scene.actors[j]))&&!['Trace','Imposter','Receiver','Power of Alchemy'].includes(abilityOf(current.scene.actors[j])));
      if(!candidates.length)return [current];
      return candidates.map(j=>{
        const next=clone(current),copied=abilityOf(next.scene.actors[j]);
        next.p/=candidates.length;next.scene.actors[i].currentAbility=copied;
        next.log.push(`${next.scene.actors[i].name} 复制获得${abilityName(copied,catalog)}`);
        return next;
      });
    });
  }
  return states.flatMap(current=>{
    const currentScene=current.scene,currentHP=current.hp;
    const currentLive=activeIndices(currentScene).filter(i=>currentScene.actors[i].present&&currentHP[i]>0);
    const weather=weatherCandidates(currentScene,catalog,currentLive);
    const terrain=terrainCandidates(currentScene,catalog,currentLive);
    for(const ai of [...currentLive].sort((a,b)=>entrySpeed(currentScene.actors[b],catalog)-entrySpeed(currentScene.actors[a],catalog))) {
      const ability=abilityOf(currentScene.actors[ai]);
      if(ability==='Screen Cleaner') {
        for(const side of ['attacker','defender']) {
          currentScene.field[side].isReflect=false;
          currentScene.field[side].isLightScreen=false;
          currentScene.field[side].isAuroraVeil=false;
        }
        current.log.push(`${currentScene.actors[ai].name} 除障清除了双方的墙`);
      }
      if(ability==='Curious Medicine'&&currentScene.mode==='double') {
        const pi=partnerIndex(ai),partner=currentScene.actors[pi];
        if(partner?.present&&currentHP[pi]>0) {
          for(const key of Object.keys(partner.boosts))partner.boosts[key]=0;
          current.log.push(`${currentScene.actors[ai].name} 怪药重置了 ${partner.name} 的能力变化`);
        }
      }
      if(ability==='Hospitality'&&currentScene.mode==='double') {
        const pi=partnerIndex(ai),partner=currentScene.actors[pi];
        if(partner?.present&&currentHP[pi]>0) {
          const before=currentHP[pi];currentHP[pi]=Math.min(max[pi],currentHP[pi]+Math.floor(max[pi]/4));
          partner.hp=currentHP[pi]/max[pi]*100;
          if(currentHP[pi]>before)current.log.push(`${currentScene.actors[ai].name} 款待使 ${partner.name} 回复最大 HP 的 1/4`);
        }
      }
      if(['Intimidate','Supersweet Syrup'].includes(ability)) {
        const changes=ability==='Intimidate'?{atk:-1}:{evasion:-1};
        const label=ability==='Intimidate'?'威吓':'甘露之蜜';
        for(const di of currentLive)if((ai<2)!==(di<2))applyOpponentBoost(current,ai,di,changes,label,true,catalog);
      }
    }
    return weather.flatMap(w=>terrain.map(t=>{
      const result=clone(current);result.p=current.p*w.p*t.p;result.scene.field.weather=w.weather;result.scene.field.terrain=t.terrain;
      result.scene.field.openingApplied=true;result.openingWeather=w.weather;
      result.log.unshift(`${t.source} → ${TERRAIN_NAMES[t.terrain]}`);
      result.log.unshift(`${w.source} → ${WEATHER_NAMES[w.weather]}`);
      result.openingLog=[...result.log];return result;
    }));
  });
}
