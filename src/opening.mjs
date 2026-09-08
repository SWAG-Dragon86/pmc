import { Pokemon, TYPE_CHART } from './vendor/calc.mjs';
import { activeIndices, clone, STAT_NAMES, OPENING_RULES_VERSION } from './model.mjs';

export const WEATHER_NAMES = { '': '无天气', Sun: '晴天', Rain: '雨天', Sand: '沙暴', Snow: '雪天' };
const WEATHER_ABILITIES = { Drought: 'Sun', Drizzle: 'Rain', 'Sand Stream': 'Sand', 'Snow Warning': 'Snow' };
export const OPENING_RULES = OPENING_RULES_VERSION;
export function hasFriendGuard(scene,side) {
  return scene.mode==='double'&&scene.actors.some((b,i)=>(i<2)===(side==='attacker')&&b.present&&b.hp>0&&b.ability==='Friend Guard');
}
const speciesOf = (b,c) => c.pokemon.find(p=>p.id===b.species);
function rawPokemon(b,c) {
  return new Pokemon(0,speciesOf(b,c).name,{nature:b.nature,evs:b.points,ability:b.ability,item:b.item});
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
    const delta=b.ability==='Contrary'?-value:b.ability==='Simple'?value*2:value;
    const before=b.boosts[key];
    b.boosts[key]=Math.max(-6,Math.min(6,before+delta));
    if(b.boosts[key]!==before) applied[key]=b.boosts[key]-before;
  }
  return applied;
}
function triggerDropAbility(state,di,applied,opponent,guaranteed) {
  const d=state.scene.actors[di];
  if(opponent&&guaranteed&&!state.done.includes(di)&&Object.values(applied).some(v=>v<0)) {
    const key=d.ability==='Defiant'?'atk':d.ability==='Competitive'?'spa':null;
    if(key) {
      changeBoost(d,{[key]:2});
      state.log.push(`${d.name} ${key==='atk'?'不服输':'好胜'}：${STAT_NAMES[key]} ${d.boosts[key]>0?'+':''}${d.boosts[key]}`);
    }
  }
}
function blockedOpponentDrops(d,changes,label) {
  const allowed={...changes};
  for(const key of Object.keys(allowed)) {
    if(allowed[key]>=0) continue;
    const all=['Clear Body','White Smoke','Full Metal Body'].includes(d.ability)||d.item==='Clear Amulet';
    const intimidation=label==='威吓'&&['Inner Focus','Own Tempo','Oblivious','Scrappy'].includes(d.ability);
    const specific=(key==='atk'&&d.ability==='Hyper Cutter')||(key==='def'&&d.ability==='Big Pecks')||(key==='accuracy'&&['Keen Eye','Mind’s Eye'].includes(d.ability));
    if(all||intimidation||specific) delete allowed[key];
  }
  return allowed;
}
export function applyOpponentBoost(state,ai,di,changes,label,guaranteed=true) {
  const a=state.scene.actors[ai], d=state.scene.actors[di];
  if(!state.hp[di]) return;
  const opponent=(ai<2)!==(di<2), allowed=opponent?blockedOpponentDrops(d,changes,label):{...changes};
  const applied=changeBoost(d,allowed);
  if(!Object.keys(applied).length) { state.log.push(`${d.name}：${label}未造成能力变化`); return; }
  const describe=()=>Object.keys(applied).map(k=>`${STAT_NAMES[k]||k} ${d.boosts[k]>0?'+':''}${d.boosts[k]}`).join('、');
  state.log.push(`${a.name} ${label} → ${d.name}：${describe()}`);
  // Calculator contract: only guaranteed opponent drops before this actor attacks.
  triggerDropAbility(state,di,applied,opponent,guaranteed);
}
function applyFieldDrop(state,di,changes,label) {
  const d=state.scene.actors[di],allowed=blockedOpponentDrops(d,changes,label);
  const applied=changeBoost(d,allowed);
  if(!Object.keys(applied).length) { state.log.push(`${d.name}：${label}未造成能力变化`); return; }
  state.log.push(`${d.name} ${label}：${Object.keys(applied).map(k=>`${STAT_NAMES[k]||k} ${d.boosts[k]>0?'+':''}${d.boosts[k]}`).join('、')}`);
  triggerDropAbility(state,di,applied,true,true);
}
export function weatherCandidates(scene,catalog,indices=activeIndices(scene).filter(i=>scene.actors[i].present&&scene.actors[i].hp>0)) {
  if(scene.field.weatherMode==='manual'||(!scene.field.weatherMode&&scene.field.weather))
    return [{weather:scene.field.weather||'',p:1,source:'手动天气'}];
  const setters=indices.filter(i=>WEATHER_ABILITIES[scene.actors[i].ability]);
  if(!setters.length) return [{weather:'',p:1,source:'自动天气：没有开天气特性'}];
  const slowest=Math.min(...setters.map(i=>entrySpeed(scene.actors[i],catalog)));
  const tied=setters.filter(i=>entrySpeed(scene.actors[i],catalog)===slowest),groups=new Map();
  for(const i of tied) {
    const weather=WEATHER_ABILITIES[scene.actors[i].ability];
    const g=groups.get(weather)||{weather,p:0,source:''};
    g.p+=1/tied.length;g.source+=(g.source?'、':'')+scene.actors[i].name;groups.set(weather,g);
  }
  return [...groups.values()].map(g=>({...g,source:`自动天气：${g.source}${groups.size>1?'（同速天气分支）':''}`}));
}
export function openingBranches(input,catalog) {
  const scene=clone(input),max=scene.actors.map(b=>rawPokemon(b,catalog).maxHP());
  const hp=scene.actors.map((b,i)=>Math.floor(max[i]*b.hp/100+1e-9));
  const state={scene,max,hp,dealt:[0,0,0,0],done:[],p:1,log:[]};
  for(const i of activeIndices(scene)) {
    const b=scene.actors[i];if(!b.present||hp[i]<=0)continue;
    const side=scene.field[i<2?'attacker':'defender'],types=speciesOf(b,catalog).types;
    const grounded=b.item==='Iron Ball'||scene.field.gravity||(!types.includes('Flying')&&!['Levitate','Eelevate'].includes(b.ability)&&b.item!=='Air Balloon');
    const hazards=[];
    const ignoresDamage=b.ability==='Magic Guard'||b.item==='Heavy-Duty Boots';
    if(side.isSR&&!ignoresDamage)hazards.push(['隐形岩',Math.max(1,Math.floor(max[i]/8*types.reduce((n,t)=>n*TYPE_CHART[0].Rock[t],1)))]);
    const layers=Number(side.spikes||0);
    if(!Number.isInteger(layers)||layers<0||layers>3)throw new Error('撒菱层数必须是 0 至 3');
    if(layers&&grounded&&!ignoresDamage)hazards.push([`${layers} 层撒菱`,Math.max(1,Math.floor(max[i]*[0,1/8,1/6,1/4][layers]))]);
    for(const [name,amount] of hazards) {
      if(hp[i]<=0)break;
      const loss=Math.min(hp[i],amount);hp[i]-=loss;
      state.log.push(`${b.name} ${name}损血 ${(loss/max[i]*100).toFixed(1)}%，剩余 ${(hp[i]/max[i]*100).toFixed(1)}%`);
    }
    if(side.stickyWeb&&grounded&&b.item!=='Heavy-Duty Boots'&&hp[i]>0)
      applyFieldDrop(state,i,{spe:-1},'黏黏网');
    b.hp=hp[i]/max[i]*100;
  }
  const live=activeIndices(scene).filter(i=>scene.actors[i].present&&hp[i]>0);
  const weather=weatherCandidates(scene,catalog,live);
  for(const ai of [...live].sort((a,b)=>entrySpeed(scene.actors[b],catalog)-entrySpeed(scene.actors[a],catalog))) {
    const ability=scene.actors[ai].ability;
    if(!['Intimidate','Supersweet Syrup'].includes(ability))continue;
    const changes=ability==='Intimidate'?{atk:-1}:{evasion:-1};
    const label=ability==='Intimidate'?'威吓':'甘露之蜜';
    for(const di of live)if((ai<2)!==(di<2))applyOpponentBoost(state,ai,di,changes,label,true);
  }
  return weather.map(w=>{
    const result=clone(state);result.p=w.p;result.scene.field.weather=w.weather;
    result.scene.field.openingApplied=true;result.openingWeather=w.weather;
    result.log.unshift(`${w.source} → ${WEATHER_NAMES[w.weather]}`);
    result.openingLog=[...result.log];return result;
  });
}
