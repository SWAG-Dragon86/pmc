import {activeIndices,STAT_KEYS,STAT_NAMES} from './model.mjs';
import {natureLabel} from './natures.mjs';
import {WEATHER_NAMES} from './opening.mjs';
export const percent=n=>`${Math.max(0,n).toFixed(1)}%`;
export const hpRange=r=>Math.abs(r.max-r.min)<.00001?percent(r.min):`${percent(r.min)} - ${percent(r.max)}`;
const slot=i=>`${i<2?'我方':'对方'} ${i%2?'B':'A'}`;
const named=(list,name)=>list.find(x=>x.name===name)?.zh||name||'无道具';
export function summaryTimeline(rows) {
  const groups=new Map();
  for(const r of rows||[]) {
    const key=JSON.stringify([r.step,r.actor,r.move,r.weather]);
    const g=groups.get(key)||{...r,probability:0,damage:{min:Infinity,max:-Infinity,mean:0},remaining:{min:Infinity,max:-Infinity,mean:0},notes:[]};
    g.probability+=r.probability;
    for(const k of ['damage','remaining']){
      g[k].min=Math.min(g[k].min,r[k].min);g[k].max=Math.max(g[k].max,r[k].max);g[k].mean+=r[k].mean*r.probability;
    }
    g.notes=[...new Set([...g.notes,...r.notes])];groups.set(key,g);
  }
  return [...groups.values()].map(r=>({...r,damage:{...r.damage,mean:r.damage.mean/r.probability},remaining:{...r.remaining,mean:r.remaining.mean/r.probability}}));
}
export function buildReport(scene,result,catalog,{details=false}={}) {
  if(!result||result.error)throw new Error(result?.error||'尚无计算结果');
  const rows=[],target=scene.actors[scene.target];
  const add=(text,kind='body')=>rows.push({text,kind});
  add('PMC / 宝可梦冠军','brand');
  add(`${scene.mode==='double'?'双打集火':'单打'} · ${scene.name||'当前场景'}`,'muted');
  add(`${slot(scene.target)} ${target.name} · 回合末剩余血量`,'heading');
  add(hpRange(result.remaining),'result');
  add(`击倒概率 ${percent(result.endKO)}    平均剩余 ${percent(result.remaining.mean)}`,'heading');
  if(Math.abs(result.damage.ko-result.endKO)>.00001)add(`攻击结束时击倒 ${percent(result.damage.ko)}，回合末效果另计`,'muted');
  if(result.weatherResults?.length>1)for(const v of result.weatherResults)add(`${WEATHER_NAMES[v.weather]}（${percent(v.probability)}）：剩余 ${hpRange(v.remaining)}，击倒 ${percent(v.ko)}`);
  add('开局','section');
  for(const o of result.opening||[]){
    if(result.opening.length>1)add(`${WEATHER_NAMES[o.weather]}分支`,'heading');
    for(const text of o.log)add(text,'muted');
    add(`${target.name} 入场后剩余 ${percent(o.remaining[scene.target])}`);
  }
  add(details?'行动分支详情':'集火过程','section');
  add('每步区间来自对应分支；上下限不能跨步骤相减或相加。','muted');
  const timeline=details?result.timeline:summaryTimeline(result.timeline);
  let step=-1;
  for(const t of timeline||[]) {
    if(step!==t.step){step=t.step;add(`第 ${step+1} 次行动`,'heading');}
    const a=scene.actors[t.actor],m=catalog.moves[t.move];
    const scope=details?`路径 ${t.order.map(slot).join(' → ')}；`:'';
    const weather=result.weatherResults?.length>1?`${WEATHER_NAMES[t.weather]}；`:'';
    const probability=t.probability<99.999?`出现概率 ${percent(t.probability)}；`:'';
    const recipient=m?.category==='Status'?'':m?.target==='allAdjacentFoes'?' → 对方全体':m?.target==='allAdjacent'?' → 周围全部宝可梦':` → ${slot(t.actor<2?scene.target:a.target||0)} ${scene.actors[t.actor<2?scene.target:a.target||0].name}`;
    add(`${scope}${weather}${probability}${slot(t.actor)} ${a.name} 使用 ${m?.zh||t.move}${recipient}`);
    if(t.damage.max>0)add(`对集火目标损血 ${hpRange(t.damage)}；目标剩余 ${hpRange(t.remaining)}`,'accent');
    else add(`${t.actor>=2&&m?.category!=='Status'?'对方反击，见下方我方剩余血量':'本次未对集火目标造成伤害'}；目标剩余 ${hpRange(t.remaining)}`,'muted');
    for(const note of t.notes)add(`分支提示：${note}`,'muted');
  }
  if(!timeline?.length)add('没有可行动的宝可梦。');
  add(`回合末结算：${target.name} 剩余 ${hpRange(result.remaining)}`,'heading');
  add('其它宝可梦 · 回合末剩余','section');
  for(const i of activeIndices(scene).filter(i=>i!==scene.target&&scene.actors[i].present))add(`${slot(i)} ${scene.actors[i].name}：${hpRange(result.afterEnd[i])}`);
  add('本次配置','section');
  for(const i of activeIndices(scene).filter(i=>scene.actors[i].present)) {
    const b=scene.actors[i],species=catalog.pokemon.find(p=>p.id===b.species);
    add(`${slot(i)} ${b.name}${b.name!==species?.zh?`（${species?.zh||b.species}）`:''} · 初始 ${percent(b.hp)}`,'heading');
    add(`${natureLabel(catalog.natures.find(n=>n.name===b.nature))} / ${named(catalog.abilities,b.ability)} / ${named(catalog.items,b.item)}`,'muted');
    add(`能力点 HP/攻/防/特攻/特防/速：${STAT_KEYS.map(k=>b.points[k]).join('/')}；${i===3?'被动席位':`招式：${catalog.moves[b.moves[b.selected]]?.zh||'空'}`}${b.ability==='Supreme Overlord'||b.moves[b.selected]==='lastrespects'?`；已倒下队友：${b.faintedAllies??0}`:''}`,'muted');
    const flags=Object.entries(b.boosts).filter(([k,v])=>k!=='hp'&&v!==0).map(([k,v])=>`${STAT_NAMES[k]} ${v>0?'+':''}${v}`);
    if(b.protected)flags.push('守住');if(b.crit)flags.push('要害');
    if(b.status)flags.push({brn:'灼伤',par:'麻痹',psn:'中毒',tox:'剧毒首回合',slp:'睡眠（仍出招）',frz:'冰冻（仍出招）'}[b.status]);
    if(b.secondary)flags.push('启用概率追加效果（不触发不服输/好胜）');
    const move=catalog.moves[b.moves[b.selected]];if(move?.multihit)flags.push(`连击 ${typeof move.multihit==='number'?move.multihit:b.ability==='Skill Link'?move.multihit[1]:b.hits}`);
    if(flags.length)add(flags.join('；'),'muted');
  }
  const terrain={'':'无',Electric:'电气',Grassy:'青草',Misty:'薄雾',Psychic:'精神'};
  const field=[`天气：${scene.field.weatherMode==='manual'||(!scene.field.weatherMode&&scene.field.weather)?'手动':'自动'} ${[...new Set((result.opening||[]).map(o=>WEATHER_NAMES[o.weather]))].join('/')}`,`场地：${terrain[scene.field.terrain]||'无'}`];
  if(scene.field.trickRoom)field.push('戏法空间');if(scene.field.gravity)field.push('重力');add(field.join('；'),'muted');
  const labels={isSR:'隐形岩',stickyWeb:'黏黏网',isReflect:'反射壁',isLightScreen:'光墙',isAuroraVeil:'极光幕',isTailwind:'顺风',isHelpingHand:'帮助',isFriendGuard:'友情防守（手动）',isBattery:'蓄电池',isPowerSpot:'能量点',isSteelySpirit:'钢之意志'};
  for(const [side,label] of [['attacker','我方'],['defender','对方']]){
    const f=scene.field[side],active=Object.keys(labels).filter(k=>f[k]).map(k=>labels[k]);if(f.spikes)active.push(`撒菱 ${f.spikes} 层`);
    if(f.friendGuardOverride===false)active.push('友情防守：手动关闭');
    else if(!f.isFriendGuard&&scene.mode==='double'&&scene.actors.some((b,i)=>(i<2)===(side==='attacker')&&b.present&&b.hp>0&&b.ability==='Friend Guard'))active.push('友情防守：队友特性自动生效');
    if(active.length)add(`${label}条件：${active.join('、')}`,'muted');
  }
  add('计算边界：只计算当前一回合；不继承上一回合状态，也不模拟下一回合触发。','footer');
  add('计算假设：命中；突袭满足成功条件；不计状态性无法行动。','footer');
  add('不服输/好胜仅响应出招前的必定降能力；未适配机制仍需核验。','footer');
  add(`PMC 1.2.0 · Champions ${catalog.meta.gameVersion} / ${catalog.meta.regulation} · 非官方工具 · 数据 ${catalog.meta.source.showdown.commit.slice(0,8)}`,'footer');
  return rows;
}
