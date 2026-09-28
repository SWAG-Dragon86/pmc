import { TYPE_CHART } from "./vendor/calc.mjs";
import { createBuild, validateBuild, TYPES } from "./model.mjs";
import { statsOf } from "./engine.mjs";

const blocks = { Fire:"Flash Fire", Water:"Water Absorb", Electric:"Volt Absorb", Grass:"Sap Sipper", Ground:"Earth Eater" };
function multiplier(type, pokemon, catalog, actual=false) {
  const species=catalog.pokemon.find(entry=>entry.id===pokemon.species);
  if (!species) return 0;
  const factor=species.types.reduce((value,target)=>value*(TYPE_CHART[0][type]?.[target]??1),1);
  if (actual && ((blocks[type]===pokemon.ability) || (type==='Ground'&&(pokemon.ability==='Levitate'||pokemon.item==='Air Balloon')))) return 0;
  return factor;
}
function speed(build,catalog) {
  const raw=statsOf(build,catalog).spe;
  return build.item==='Choice Scarf'?Math.floor(raw*1.5):raw;
}
export function analyzeTeam(members,catalog) {
  if (!Array.isArray(members)||members.length!==6) throw new Error('队伍必须有六只宝可梦');
  for(const member of members){const problems=validateBuild(member,catalog);if(problems.length)throw new Error(`${member.name}：${problems[0]}`);}
  const numbers=members.map(member=>catalog.pokemon.find(entry=>entry.id===member.species).num);
  if(new Set(numbers).size!==6)throw new Error('队伍不能包含图鉴编号相同的宝可梦');
  const ownSpeeds=members.map(member=>speed(member,catalog));
  const threats=[];
  for(const opponent of catalog.pokemon) {
    const opposingBuild=createBuild(catalog,opponent.id),opponentStats=statsOf(opposingBuild,catalog);
    const moves=opponent.moves.map(id=>catalog.moves[id]).filter(move=>move&&move.power>=60&&move.category!=='Status');
    const pressure=[...new Set(moves.map(move=>move.type))].map(type=>({type,count:members.filter(member=>multiplier(type,member,catalog,true)>=2).length})).sort((a,b)=>b.count-a.count);
    const weak=pressure[0]||{type:'',count:0};
    const ownBest=members.map(member=>{
      const stats=statsOf(member,catalog);
      return member.moves.map(id=>catalog.moves[id]).filter(move=>move&&move.power>0&&move.category!=='Status')
        .reduce((best,move)=>Math.max(best,multiplier(move.type,opposingBuild,catalog)*move.power*(move.category==='Physical'?stats.atk/opponentStats.def:stats.spa/opponentStats.spd)),0);
    });
    const coverage=members.filter(member=>member.moves.some(id=>{const move=catalog.moves[id];return move&&move.power>0&&multiplier(move.type,opposingBuild,catalog)>=2;})).length;
    const faster=ownSpeeds.filter(value=>value>=opponentStats.spe).length;
    const score=weak.count*2+(coverage===0?4:coverage===1?2:0)+(faster<=2?2:0)+(Math.max(...ownBest)<70?2:0);
    if(score<6)continue;
    const reasons=[];
    if(weak.count>=2)reasons.push(`它可学的${TYPES[weak.type]||weak.type}属性招式可能克制 ${weak.count}/6 名队员`);
    if(coverage===0)reasons.push('六人已配置的攻击招式都没有属性克制');
    else if(coverage===1)reasons.push('仅一名队员配置了属性克制招式');
    if(faster<=2)reasons.push(`按中性性格、0 能力点的对手速度估计，仅 ${faster}/6 名队员不慢于它`);
    if(Math.max(...ownBest)<70)reasons.push('现有招式的属性、威力和攻防能力值组合偏弱');
    threats.push({id:opponent.id,name:opponent.zh,score,reasons});
  }
  return threats.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,24);
}
