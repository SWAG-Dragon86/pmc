import { Pokemon, Move, Field, calculate, TYPE_CHART } from "./vendor/calc.mjs";
import { openingBranches, changeBoost, applyOpponentBoost, triggerOpportunist } from './opening.mjs';
import {
  validateBuild,
  activeIndices,
  clone,
  withMandatoryActions,
  duplicateSpeciesIssues,
  faintedAlliesOf,
} from "./model.mjs";

export const RESIST_BERRY_TYPES = {
  "Occa Berry": "Fire", "Passho Berry": "Water", "Wacan Berry": "Electric",
  "Rindo Berry": "Grass", "Yache Berry": "Ice", "Chople Berry": "Fighting",
  "Kebia Berry": "Poison", "Shuca Berry": "Ground", "Coba Berry": "Flying",
  "Payapa Berry": "Psychic", "Tanga Berry": "Bug", "Charti Berry": "Rock",
  "Kasib Berry": "Ghost", "Haban Berry": "Dragon", "Colbur Berry": "Dark",
  "Babiri Berry": "Steel", "Roseli Berry": "Fairy", "Chilan Berry": "Normal",
};

export const abilityOf = (build) =>
  build.currentAbility !== undefined ? build.currentAbility : build.ability;

export function makePokemon(build, catalog) {
  const p = catalog.pokemon.find((p) => p.id === build.species);
  if (!p) throw new Error("形态不在当前数据包");
  const battleName =
    build.species === "aegislash" && build.battleForm === "blade"
      ? "Aegislash-Blade"
      : p.name;
  const overrides = {};
  if (build.imposterOriginalSpecies) {
    const original = catalog.pokemon.find(
      (entry) => entry.id === build.imposterOriginalSpecies,
    );
    overrides.baseStats = { ...p.stats, hp: original.stats.hp };
  }
  if (build.battleTypes) overrides.types = build.battleTypes;
  const runtimeAbility = abilityOf(build);
  const pokemon = new Pokemon(0, battleName, {
    nature: build.nature,
    evs: build.points,
    boosts: build.boosts,
    // Champions has no gender input here, so Rivalry is intentionally inert.
    ability: runtimeAbility === "Rivalry" ? "" : runtimeAbility,
    item: build.item,
    status: build.status,
    abilityOn: !!build.abilityOn,
    alliesFainted: faintedAlliesOf(build),
    overrides: Object.keys(overrides).length ? overrides : undefined,
  });
  // Internal turn HP stays an integer. Never round a percentage back down a second time.
  pokemon.originalCurHP = Math.floor((pokemon.maxHP() * build.hp) / 100 + 1e-9);
  return pokemon;
}
export const statsOf = (build, catalog) => makePokemon(build, catalog).rawStats;
function weatherOf(scene) {
  return activeIndices(scene).some(
    (i) =>
      scene.actors[i].present &&
      scene.actors[i].hp > 0 &&
      abilityOf(scene.actors[i]) === "Cloud Nine",
  )
    ? ""
    : scene.field.weather;
}
function targets(scene, attackerIndex, move, catalog) {
  const ally = attackerIndex < 2;
  const live = activeIndices(scene).filter(
    (i) =>
      i !== attackerIndex && scene.actors[i].present && scene.actors[i].hp > 0,
  );
  if (move.target === "allAdjacent") return live;
  if (move.target === "allAdjacentFoes")
    return live.filter((i) => i < 2 !== ally);
  const selected = ally ? scene.target : scene.actors[attackerIndex].target || 0;
  if (
    scene.mode === "double" &&
    move.type === "Electric" &&
    !["Mold Breaker", "Stalwart"].includes(abilityOf(scene.actors[attackerIndex]))
  ) {
    const rods = live.filter((i) => abilityOf(scene.actors[i]) === "Lightning Rod");
    if (rods.length) {
      rods.sort(
        (a, b) =>
          speedOf(scene.actors[b], scene, catalog, b) -
            speedOf(scene.actors[a], scene, catalog, a) || a - b,
      );
      return [rods[0]];
    }
  }
  return [selected];
}
export function summarize(values, maxHP, currentHP) {
  const d =
    typeof values[0] === "number"
      ? values.map((damage) => ({ damage, p: 1 / values.length }))
      : values;
  if (!d.length) return { min: 0, max: 0, mean: 0, ko: 0 };
  return {
    min: (Math.min(...d.map((x) => x.damage)) / maxHP) * 100,
    max: (Math.max(...d.map((x) => x.damage)) / maxHP) * 100,
    mean: (d.reduce((s, x) => s + x.damage * x.p, 0) / maxHP) * 100,
    ko: d.reduce((s, x) => s + (x.damage >= currentHP ? x.p : 0), 0) * 100,
  };
}
function distribution(damage) {
  if (typeof damage === "number") return [{ damage, p: 1 }];
  if (!Array.isArray(damage[0])) {
    const map = new Map();
    for (const d of damage) map.set(d, (map.get(d) || 0) + 1 / damage.length);
    return [...map].map(([damage, p]) => ({ damage, p }));
  }
  let result = [{ damage: 0, p: 1 }];
  for (const hit of damage) {
    const map = new Map();
    for (const a of result)
      for (const b of distribution(hit))
        map.set(
          a.damage + b.damage,
          (map.get(a.damage + b.damage) || 0) + a.p * b.p,
        );
    result = [...map].map(([damage, p]) => ({ damage, p }));
  }
  return result;
}
export function damageFor(attacker, defender, moveId, scene, catalog) {
  const invalid = [
    ...(attacker.transformed ? [] : validateBuild(attacker, catalog)),
    ...(defender.transformed ? [] : validateBuild(defender, catalog)),
  ];
  if (invalid.length) throw new Error(invalid[0]);
  const m = catalog.moves[moveId];
  if (!m) throw new Error("招式失效");
  const ai = scene.actors.findIndex((x) => x.id === attacker.id),
    di = scene.actors.findIndex((x) => x.id === defender.id);
  const side = ai >= 2 ? "defender" : "attacker",
    other = side === "attacker" ? "defender" : "attacker";
  const active = activeIndices(scene).filter(
    (i) => scene.actors[i].present && scene.actors[i].hp > 0,
  );
  let abilityOn = !!attacker.abilityOn;
  if (["Plus", "Minus"].includes(abilityOf(attacker)))
    abilityOn = active.some(
      (i) =>
        i !== ai &&
        i < 2 === ai < 2 &&
        ["Plus", "Minus"].includes(abilityOf(scene.actors[i])),
    );
  if (abilityOf(attacker) === "Analytic") {
    if (Array.isArray(scene.turnDone)) abilityOn = scene.turnDone.includes(di);
    else {
      const defenderMove = catalog.moves[defender.moves?.[defender.selected]];
      const attackerRank = [priority(attacker, m), speedOf(attacker, scene, catalog, ai)];
      const defenderRank = defenderMove
        ? [priority(defender, defenderMove), speedOf(defender, scene, catalog, di)]
        : [0, 0];
      abilityOn =
        attackerRank[0] < defenderRank[0] ||
        (attackerRank[0] === defenderRank[0] &&
          (scene.field.trickRoom
            ? attackerRank[1] > defenderRank[1]
            : attackerRank[1] < defenderRank[1]));
    }
  }
  const terrainType = {
    Electric: "Electric",
    Grassy: "Grass",
    Psychic: "Psychic",
    Misty: "Fairy",
  }[scene.field.terrain];
  const prepare = (build) =>
    abilityOf(build) === "Mimicry" && terrainType
      ? { ...build, battleTypes: [terrainType] }
      : build;
  let attackingBuild = prepare(
    attacker.species === "aegislash" &&
    abilityOf(attacker) === "Stance Change" &&
    !attacker.imposterOriginalSpecies &&
    m.category !== "Status"
      ? { ...attacker, battleForm: "blade", abilityOn }
      : { ...attacker, abilityOn },
  );
  if (abilityOf(attacker) === "Analytic" && !abilityOn)
    attackingBuild = { ...attackingBuild, currentAbility: "Inactive Analytic" };
  const defendingBuild = prepare(defender);
  const a = makePokemon(attackingBuild, catalog),
    d = makePokemon(defendingBuild, catalog);
  if (moveId === "expandingforce")
    throw new Error("该招式的动态范围尚未完成适配，请先核对单独案例");
  // Entry stat drops are entered explicitly in the opening stages, not retriggered per hit.
  if (a.ability === "Intimidate") a.ability = "";
  if (d.ability === "Intimidate") d.ability = "";
  const spread =
    scene.mode === "double" &&
    targets(scene, Math.max(0, ai), m, catalog).length > 1;
  let hits = typeof m.multihit === "number" ? m.multihit : attacker.hits;
  if (Array.isArray(m.multihit)) {
    if (a.ability === "Skill Link") hits = m.multihit[1];
    const minimum =
      a.item === "Loaded Dice" ? Math.max(4, m.multihit[0]) : m.multihit[0];
    if (!Number.isInteger(hits) || hits < minimum || hits > m.multihit[1])
      throw new Error(`此招式连续攻击次数需为 ${minimum}–${m.multihit[1]}`);
  }
  const moveOverrides = {};
  if (!spread && ["allAdjacent", "allAdjacentFoes"].includes(m.target))
    moveOverrides.target = "normal";
  if (moveId === "lastrespects")
    moveOverrides.basePower = m.power + 50 * faintedAlliesOf(attacker);
  const move = new Move(0, m.name, {
    ability: a.ability,
    item: a.item,
    species: a.name,
    isCrit: attacker.crit,
    hits,
    overrides: Object.keys(moveOverrides).length ? moveOverrides : undefined,
  });
  const attackerSide = { ...scene.field[side] },
    defenderSide = { ...scene.field[other], isProtected: defender.protected };
  if (scene.mode === "double") {
    const di = scene.actors.findIndex((b) => b.id === defender.id);
    for (const i of activeIndices(scene)) {
      const partner = scene.actors[i];
      if (!partner.present || partner.hp <= 0) continue;
      if (i !== ai && i < 2 === ai < 2) {
        if (abilityOf(partner) === "Battery") attackerSide.isBattery = true;
        if (abilityOf(partner) === "Power Spot") attackerSide.isPowerSpot = true;
        if (abilityOf(partner) === "Steely Spirit")
          attackerSide.isSteelySpirit = true;
      }
      if (scene.field[other].friendGuardOverride !== false && i !== di && i < 2 === di < 2 && abilityOf(partner) === "Friend Guard")
        defenderSide.isFriendGuard = true;
    }
  }
  const weatherSuppressed = active.some(
    (i) => abilityOf(scene.actors[i]) === "Cloud Nine",
  );
  const field = new Field({
    gameType: scene.mode === "double" ? "Doubles" : "Singles",
    weather: weatherSuppressed ? undefined : scene.field.weather || undefined,
    terrain: scene.field.terrain || undefined,
    isGravity: !!scene.field.gravity,
    isFairyAura: active.some(
      (i) => abilityOf(scene.actors[i]) === "Fairy Aura",
    ),
    attackerSide,
    defenderSide,
  });
  const result = calculate(0, a, d, move, field);
  const dist = distribution(
    Array.isArray(result.damage) &&
      result.damage.length === 2 &&
      typeof result.damage[0] === "number"
      ? [[result.damage[0]], [result.damage[1]]]
      : result.damage,
  );
  const rolls =
    typeof result.damage === "number"
      ? Array(16).fill(result.damage)
      : Array.isArray(result.damage[0])
        ? dist.map((d) => d.damage)
        : result.damage;
  return {
    rolls,
    dist,
    ...summarize(dist, d.maxHP(), d.curHP()),
    spread,
    type: move.type,
    category: move.category,
    hitDists: Array.isArray(result.damage?.[0])
      ? result.damage.map((hit) => distribution(hit))
      : [dist],
  };
}
// Card previews include opening effects, but never apply them again inside a turn.
export function previewDamage(attacker, defender, moveId, scene, catalog) {
  const ai=scene.actors.findIndex(b=>b.id===attacker.id),di=scene.actors.findIndex(b=>b.id===defender.id);
  const openings=openingBranches(scene,catalog);
  const variants=openings.map(s=>{
    const r=damageFor(s.scene.actors[ai],s.scene.actors[di],moveId,s.scene,catalog);
    if(s.hp[ai]<=0||s.hp[di]<=0) return {weather:s.openingWeather,p:s.p,result:{...r,dist:[{damage:0,p:1}],min:0,max:0,mean:0,ko:s.hp[di]<=0?100:0}};
    return {weather:s.openingWeather,p:s.p,result:r};
  });
  const dist=variants.flatMap(v=>v.result.dist.map(d=>({...d,p:d.p*v.p})));
  const result={...variants[0].result,...summarize(dist,openings[0].max[di],openings[0].hp[di]),dist,variants};
  result.ko=variants.reduce((n,v)=>n+v.p*v.result.ko,0);
  return result;
}
export function speedOf(b, scene, catalog, index) {
  const raw = statsOf(b, catalog).spe;
  const stage = b.boosts.spe;
  let speed = Math.floor(
    raw * (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)),
  );
  if (b.status === "par" && abilityOf(b) !== "Quick Feet")
    speed = Math.floor(speed / 2);
  if (b.status && abilityOf(b) === "Quick Feet") speed = Math.floor(speed * 1.5);
  const field = scene.field,
    weather = weatherOf(scene),
    indexSide = index < 2 ? "attacker" : "defender";
  if (field[indexSide].isTailwind) speed *= 2;
  if (
    (weather === "Sun" && abilityOf(b) === "Chlorophyll") ||
    (weather === "Rain" && abilityOf(b) === "Swift Swim") ||
    (weather === "Sand" && abilityOf(b) === "Sand Rush") ||
    (weather === "Snow" && abilityOf(b) === "Slush Rush") ||
    (field.terrain === "Electric" && abilityOf(b) === "Surge Surfer")
  )
    speed *= 2;
  if (abilityOf(b) === "Unburden" && b.abilityOn) speed *= 2;
  else if (abilityOf(b) !== "Klutz") {
    if (b.item === "Choice Scarf") speed = Math.floor(speed * 1.5);
    if (
      [
        "Iron Ball",
        "Macho Brace",
        "Power Anklet",
        "Power Band",
        "Power Belt",
        "Power Bracer",
        "Power Lens",
        "Power Weight",
      ].includes(b.item)
    )
      speed = Math.floor(speed / 2);
    if (b.species === "ditto" && b.item === "Quick Powder") speed *= 2;
  }
  return speed;
}
function priority(b, m) {
  return (
    m.priority +
    (m.category === "Status" && abilityOf(b) === "Prankster" ? 1 : 0) +
    (m.type === "Flying" && abilityOf(b) === "Gale Wings" && b.hp === 100
      ? 1
      : 0) +
    (m.heal && abilityOf(b) === "Triage" ? 3 : 0)
  );
}
function priorityBlocker(scene, attackerIndex, move, catalog) {
  const attacker = scene.actors[attackerIndex];
  if (
    abilityOf(attacker) === "Mold Breaker" ||
    priority(attacker, move) <= 0 ||
    [
      "self",
      "adjacentAlly",
      "adjacentAllyOrSelf",
      "allies",
      "allySide",
      "allyTeam",
      "foeSide",
      "all",
      "allAdjacent",
    ].includes(move.target)
  )
    return "";
  const targetIsAttackerSide = attackerIndex >= 2;
  const blocker = activeIndices(scene).find(
    (i) =>
      i < 2 === targetIsAttackerSide &&
      scene.actors[i].present &&
      scene.actors[i].hp > 0 &&
      ["Armor Tail", "Queenly Majesty", "Dazzling"].includes(
        abilityOf(scene.actors[i]),
      ),
  );
  return blocker === undefined
    ? ""
    : abilityName(abilityOf(scene.actors[blocker]), catalog);
}
const SIMPLE_STATUS = new Set([
  "protect",
  "detect",
  "swordsdance",
  "nastyplot",
  "calmmind",
  "dragondance",
  "irondefense",
  "agility",
  "tailwind",
  "reflect",
  "lightscreen",
  "auroraveil",
  "trickroom",
  "recover",
  "roost",
  "slackoff",
  "softboiled",
  "synthesis",
  "moonlight",
  "morningsun",
  "lifedew",
  "thunderwave",
  "willowisp",
  "toxic",
  "screech",
  "faketears",
  "leer",
  "growl",
  "scaryface",
  "sunnyday",
  "raindance",
  "sandstorm",
  "snowscape",
  "helpinghand",
  "charm",
]);
const COMPLEX_MOVES = new Set([
  "counter",
  "mirrorcoat",
  "metalburst",
  "bide",
  "beatup",
  "painsplit",
  "endeavor",
  "superfang",
  "naturesmadness",
  "finalgambit",
  "fling",
  "naturalgift",
  "present",
  "magnitude",
  "fissure",
  "sheercold",
  "guillotine",
  "horndrill",
  "focuspunch",
  "shelltrap",
  "upperhand",
  "pursuit",
  "explosion",
  "selfdestruct",
  "mistyexplosion",
  "mindblown",
  "steelbeam",
  "chloroblast",
  "glaiverush",
  "skullbash",
  "meteorbeam",
  "electroshot",
  "fly",
  "dig",
  "dive",
  "bounce",
  "phantomforce",
  "shadowforce",
  "skyattack",
  "solarbeam",
  "solarblade",
  "razorwind",
  "geomancy",
  "knockoff",
  "incinerate",
  "thief",
  "covet",
  "smackdown",
  "thousandarrows",
  "psychicfangs",
  "ragingbull",
  "icespinner",
  "feint",
  "hyperspacefury",
  "hyperspacehole",
  "phantomforce",
  "saltcure",
  "firespin",
  "whirlpool",
  "infestation",
  "bind",
  "wrap",
  "sandtomb",
  "magmastorm",
  "snaptrap",
  "thundercage",
]);
const EVENT_ABILITIES = new Set([
  "Ice Face",
  "Schooling",
  "Shields Down",
  "Zen Mode",
  "Power Construct",
  "Emergency Exit",
  "Wimp Out",
  "Gulp Missile",
  "Lingering Aroma",
  "Dancer",
  "Power of Alchemy",
  "Anger Shell",
  "Color Change",
  "Cotton Down",
  "Seed Sower",
  "Emergency Exit",
  "Poison Puppeteer",
]);
export function turnLimits(scene, catalog) {
  const reasons = [...duplicateSpeciesIssues(scene,catalog)];
  for (const i of activeIndices(scene)) {
    const b = scene.actors[i];
    if (!b.present) continue;
    if (
      scene.mode === "double" &&
      [
        "Storm Drain",
        "Dazzling",
      ].includes(b.ability)
    )
      reasons.push("该场景涉及队友引招或优先招式阻挡，完整回合适配待完成");
    if (
      (b.item.endsWith("Berry") &&
        !["Sitrus Berry", "Oran Berry", ...Object.keys(RESIST_BERRY_TYPES)].includes(b.item)) ||
      ["White Herb", "Focus Band", "Mental Herb"].includes(b.item)
    )
      reasons.push("该道具的回合内触发/消耗尚未完整适配，单招结果仅供试算");
    reasons.push(...validateBuild(b, catalog));
    if (EVENT_ABILITIES.has(b.ability))
      reasons.push(
        `尚未接入回合触发特性：${catalog.abilities.find((a) => a.name === b.ability)?.zh || b.ability}`,
      );
    if (i === 3 || !b.active) continue;
    if (b.ability === "Imposter") {
      const opposite=i<2?i+2:i-2;
      if (scene.actors[opposite]?.present && scene.actors[opposite].hp>0) continue;
      reasons.push("变身者对面没有可变身目标；未变身时的变身招式暂不进入完整回合");
    }
    const m = catalog.moves[b.moves[b.selected]];
    if (!m) {
      reasons.push("行动者选中的招式栏为空");
      continue;
    }
    if (
      (m.multihit && m.id!=="twinbeam") ||
      COMPLEX_MOVES.has(m.id) ||
      (m.category === "Status" && !SIMPLE_STATUS.has(m.id)) ||
      m.forceSwitch ||
      m.selfSwitch ||
      m.secondaries
    )
      reasons.push(`回合模拟尚未覆盖「${m.zh}」的完整机制，仍可查看单招试算`);
  }
  return [...new Set(reasons)];
}
function statusMove(state, index, m, catalog) {
  const b = state.scene.actors[index],
    side = index < 2 ? "attacker" : "defender",
    targetIndex = index < 2 ? state.scene.target : b.target || 0,
    target = state.scene.actors[targetIndex];
  const log = state.log;
  if (["protect", "detect"].includes(m.id)) b.protected = true;
  else if (m.id === "trickroom")
    state.scene.field.trickRoom = !state.scene.field.trickRoom;
  else if (
    [
      "reflect",
      "lightscreen",
      "auroraveil",
      "tailwind",
      "helpinghand",
    ].includes(m.id)
  )
    state.scene.field[side][
      {
        reflect: "isReflect",
        lightscreen: "isLightScreen",
        auroraveil: "isAuroraVeil",
        tailwind: "isTailwind",
        helpinghand: "isHelpingHand",
      }[m.id]
    ] = true;
  else if (m.weather)
    state.scene.field.weather =
      {
        sunnyday: "Sun",
        raindance: "Rain",
        sandstorm: "Sand",
        snowscape: "Snow",
      }[m.weather] || "";
  else if (m.heal) {
    const max = state.max[index];
    const heal = Math.floor((max * m.heal[0]) / m.heal[1]);
    state.hp[index] = Math.min(max, state.hp[index] + heal);
    b.hp = (state.hp[index] / max) * 100;
  } else if (m.boosts) {
    if(m.target==='self') {
      const raised=changeBoost(b,m.boosts);triggerOpportunist(state,index,raised);
    }
    else {
      const recipients=m.target==='allAdjacentFoes'?activeIndices(state.scene).filter(i=>(i<2)!==(index<2)):[targetIndex];
      for(const di of recipients) {
        const defender=state.scene.actors[di];
        if(!defender.present||defender.protected)continue;
        const opponent=(di<2)!==(index<2),ignored=abilityOf(b)==='Mold Breaker';
        if(opponent&&abilityOf(b)==='Prankster'&&battleTypesOf(defender,state.scene,catalog).includes('Dark')) {
          log.push(`${defender.name} 不受恶作剧之心强化的变化招式影响`);continue;
        }
        if(opponent&&!ignored&&abilityOf(defender)==='Good as Gold') {
          log.push(`${defender.name} 黄金之躯挡下 ${m.zh}`);continue;
        }
        if(opponent&&!ignored&&m.flags?.sound&&abilityOf(defender)==='Soundproof') {
          log.push(`${defender.name} 隔音挡下 ${m.zh}`);continue;
        }
        if(opponent&&!ignored&&abilityOf(defender)==='Magic Bounce') {
          log.push(`${defender.name} 魔法镜反弹 ${m.zh}`);
          applyOpponentBoost(state,di,index,m.boosts,m.zh,true,catalog);
        } else applyOpponentBoost(state,index,di,m.boosts,m.zh,true,catalog);
      }
    }
  }
  else if (m.status && !target.protected && !target.status) {
    const opponent=(targetIndex<2)!==(index<2),ignored=abilityOf(b)==='Mold Breaker';
    if(opponent&&abilityOf(b)==='Prankster'&&battleTypesOf(target,state.scene,catalog).includes('Dark'))
      log.push(`${target.name} 不受恶作剧之心强化的变化招式影响`);
    else if(opponent&&!ignored&&abilityOf(target)==='Good as Gold')
      log.push(`${target.name} 黄金之躯挡下 ${m.zh}`);
    else if(opponent&&!ignored&&m.flags?.sound&&abilityOf(target)==='Soundproof')
      log.push(`${target.name} 隔音挡下 ${m.zh}`);
    else {
      let recipientIndex=targetIndex,sourceIndex=index;
      if(opponent&&!ignored&&abilityOf(target)==='Magic Bounce') {
        recipientIndex=index;sourceIndex=targetIndex;
        log.push(`${target.name} 魔法镜反弹 ${m.zh}`);
      }
      const recipient=state.scene.actors[recipientIndex];
      if(!recipient.status&&canReceiveStatus(state,recipientIndex,m.status,catalog,abilityOf(state.scene.actors[sourceIndex]))) {
        recipient.status=m.status;
        if(['brn','par','psn','tox'].includes(m.status)&&abilityOf(recipient)==='Synchronize') {
          const source=state.scene.actors[sourceIndex];
          if(!source.status&&canReceiveStatus(state,sourceIndex,m.status,catalog,abilityOf(recipient)))source.status=m.status;
        }
      }
    }
  }
  log.push(`${b.name} 使用 ${m.zh}`);
  return state;
}
function applyCheekPouch(state, index, pokemon) {
  if (abilityOf(pokemon) !== "Cheek Pouch" || state.hp[index] <= 0) return;
  const before = state.hp[index];
  state.hp[index] = Math.min(
    state.max[index],
    state.hp[index] + Math.floor(state.max[index] / 3),
  );
  if (state.hp[index] > before) state.log.push(`${pokemon.name} 颊囊回复`);
}
function recordConsumedItem(state, index, item) {
  if (!item) return;
  state.consumedItems = (state.consumedItems || []).filter(
    (entry) => entry.index !== index,
  );
  state.consumedItems.push({ index, item });
}
function recoverConsumedItem(state, entry) {
  const position = (state.consumedItems || []).findIndex(
    (candidate) =>
      candidate.index === entry.index && candidate.item === entry.item,
  );
  if (position >= 0) state.consumedItems.splice(position, 1);
}
const MUMMY_IMMUNE = new Set([
  "As One", "Battle Bond", "Comatose", "Commander", "Disguise",
  "Gulp Missile", "Ice Face", "Lingering Aroma", "Multitype",
  "Power Construct", "RKS System", "Schooling", "Shields Down",
  "Stance Change", "Zen Mode", "Zero to Hero", "Mummy",
]);
const WANDERING_IMMUNE = new Set([
  "As One", "Battle Bond", "Comatose", "Commander", "Disguise",
  "Flower Gift", "Forecast", "Hunger Switch", "Ice Face", "Illusion",
  "Imposter", "Multitype", "Neutralizing Gas", "Power of Alchemy",
  "Receiver", "RKS System", "Schooling", "Shields Down", "Stance Change",
  "Wonder Guard", "Zen Mode", "Zero to Hero",
]);
const RECEIVER_IMMUNE = new Set([
  "Receiver", "Power of Alchemy", "Trace", "Forecast", "Flower Gift",
  "Multitype", "Illusion", "Wonder Guard", "Zen Mode", "Imposter",
  "Stance Change", "Power Construct", "Schooling", "Comatose",
  "Shields Down", "Disguise", "RKS System", "Battle Bond",
  "Wandering Spirit", "As One", "Zero to Hero", "Commander",
  "Gulp Missile", "Ice Face",
]);
function abilityName(ability, catalog) {
  return catalog.abilities.find((entry) => entry.name === ability)?.zh || ability;
}
function itemName(item, catalog) {
  return catalog.items.find((entry) => entry.name === item)?.zh || item;
}
function updateUnburden(pokemon) {
  if (abilityOf(pokemon) === "Unburden") pokemon.abilityOn = !pokemon.item;
}
function opposingUnnerve(state, index) {
  return activeIndices(state.scene).some(
    (i) =>
      (i < 2) !== (index < 2) &&
      state.scene.actors[i].present &&
      state.hp[i] > 0 &&
      abilityOf(state.scene.actors[i]) === "Unnerve",
  );
}
function battleTypesOf(build, scene, catalog) {
  if (build.battleTypes) return build.battleTypes;
  if (abilityOf(build) === "Mimicry") {
    const type = {
      Electric: "Electric",
      Grassy: "Grass",
      Psychic: "Psychic",
      Misty: "Fairy",
    }[scene.field.terrain];
    if (type) return [type];
  }
  return catalog.pokemon.find((entry) => entry.id === build.species)?.types || [];
}
function canReceiveStatus(state, index, status, catalog, sourceAbility = "") {
  const pokemon = state.scene.actors[index], ability = abilityOf(pokemon);
  const types = battleTypesOf(pokemon, state.scene, catalog);
  if (ability === "Purifying Salt") return false;
  if (state.scene.field.weather === "Sun" && ability === "Leaf Guard") return false;
  if (
    types.includes("Grass") &&
    activeIndices(state.scene).some(
      (i) =>
        i < 2 === index < 2 &&
        state.scene.actors[i].present &&
        state.hp[i] > 0 &&
        abilityOf(state.scene.actors[i]) === "Flower Veil",
    )
  )
    return false;
  if (status === "brn")
    return !types.includes("Fire") && !["Water Bubble"].includes(ability);
  if (status === "par")
    return !types.includes("Electric") && ability !== "Limber";
  if (["psn", "tox"].includes(status))
    return (
      (sourceAbility === "Corrosion" ||
        (!types.includes("Poison") && !types.includes("Steel"))) &&
      ability !== "Immunity"
    );
  if (status === "slp")
    return !["Insomnia", "Vital Spirit"].includes(ability) &&
      !activeIndices(state.scene).some(i=>i<2===index<2&&state.scene.actors[i].present&&state.hp[i]>0&&abilityOf(state.scene.actors[i])==='Sweet Veil');
  return true;
}
function partnerIndex(index) {
  return index < 2 ? 1 - index : 5 - index;
}
function applySymbiosis(state, consumerIndex, catalog) {
  if (state.scene.mode !== "double" || state.scene.actors[consumerIndex].item) return;
  const donorIndex = partnerIndex(consumerIndex), donor = state.scene.actors[donorIndex];
  if (!donor?.present || state.hp[donorIndex] <= 0 || abilityOf(donor) !== "Symbiosis" || !donor.item) return;
  const consumer = state.scene.actors[consumerIndex], item = donor.item;
  donor.item = ""; consumer.item = item;
  updateUnburden(consumer);
  state.log.push(`${donor.name} 共生把${itemName(item, catalog)}交给 ${consumer.name}`);
}
function triggerReceiver(state, faintedIndex, catalog) {
  if (state.scene.mode !== "double") return;
  const receiverIndex = partnerIndex(faintedIndex), receiver = state.scene.actors[receiverIndex];
  if (!receiver?.present || state.hp[receiverIndex] <= 0 || !["Receiver", "Power of Alchemy"].includes(abilityOf(receiver))) return;
  const copied = abilityOf(state.scene.actors[faintedIndex]);
  if (!copied || RECEIVER_IMMUNE.has(copied)) return;
  const sourceName = abilityName(abilityOf(receiver), catalog);
  receiver.currentAbility = copied;
  state.log.push(`${receiver.name} ${sourceName}获得${abilityName(copied, catalog)}`);
}
function contactMade(attacker, move) {
  return !!move.flags.contact && abilityOf(attacker) !== "Long Reach" && attacker.item !== "Protective Pads";
}
function applyContactAbility(state, attackerIndex, defenderIndex, move, catalog) {
  const attacker = state.scene.actors[attackerIndex], defender = state.scene.actors[defenderIndex];
  if (!contactMade(attacker, move)) return;
  const attackingAbility = abilityOf(attacker), defendingAbility = abilityOf(defender);
  if (defendingAbility === "Mummy" && !MUMMY_IMMUNE.has(attackingAbility)) {
    attacker.currentAbility = "Mummy";
    state.log.push(`${attacker.name} 的${abilityName(attackingAbility, catalog)}变为木乃伊`);
  } else if (
    defendingAbility === "Wandering Spirit" &&
    !WANDERING_IMMUNE.has(attackingAbility) &&
    !WANDERING_IMMUNE.has(defendingAbility)
  ) {
    attacker.currentAbility = defendingAbility;
    defender.currentAbility = attackingAbility;
    state.log.push(`${defender.name} 游魂与 ${attacker.name} 交换特性：${abilityName(attackingAbility, catalog)} ↔ 游魂`);
  }
}
function transferableItem(state, sourceIndex, item, catalog) {
  if (!item) return false;
  const source = state.scene.actors[sourceIndex];
  if (abilityOf(source) === "Sticky Hold" && state.hp[sourceIndex] > 0) return false;
  const species = catalog.pokemon.find((entry) => entry.id === source.species);
  return species?.requiredItem !== item;
}
function applyPostMoveItemAbilities(state, attackerIndex, defenderIndices, move, catalog) {
  const attacker = state.scene.actors[attackerIndex];
  for (const defenderIndex of defenderIndices) {
    const defender = state.scene.actors[defenderIndex];
    if (
      state.hp[attackerIndex] > 0 &&
      abilityOf(attacker) === "Magician" &&
      !attacker.item &&
      state.dealtThisMove?.[defenderIndex] > 0 &&
      transferableItem(state, defenderIndex, defender.item, catalog)
    ) {
      const item = defender.item; defender.item = ""; attacker.item = item;
      updateUnburden(defender); updateUnburden(attacker);
      state.log.push(`${attacker.name} 魔术师夺走 ${defender.name} 的${itemName(item, catalog)}`);
    }
    if (
      state.hp[defenderIndex] > 0 &&
      abilityOf(defender) === "Pickpocket" &&
      !defender.item &&
      contactMade(attacker, move) &&
      transferableItem(state, attackerIndex, attacker.item, catalog)
    ) {
      const item = attacker.item; attacker.item = ""; defender.item = item;
      updateUnburden(attacker); updateUnburden(defender);
      state.log.push(`${defender.name} 顺手牵羊偷走 ${attacker.name} 的${itemName(item, catalog)}`);
    }
  }
}
function afterHit(s, ai, di, m, amount, catalog) {
  const a = s.scene.actors[ai],
    d = s.scene.actors[di];
  const defenderBefore = s.hp[di], attackerBefore = s.hp[ai];
  const telepathyBlocked =
    amount > 0 &&
    (ai < 2) === (di < 2) &&
    abilityOf(d) === "Telepathy" &&
    s.actionAbility !== "Mold Breaker";
  const disguiseBroke =
    amount > 0 && abilityOf(d) === "Disguise" && abilityOf(a) !== "Mold Breaker";
  let loss = disguiseBroke || telepathyBlocked ? 0 : Math.min(amount, s.hp[di]);
  if (
    amount >= s.hp[di] &&
    s.hp[di] === s.max[di] &&
    (d.item === "Focus Sash" ||
      (abilityOf(d) === "Sturdy" && abilityOf(a) !== "Mold Breaker"))
  ) {
    loss = Math.max(0, s.hp[di] - 1);
    if (d.item === "Focus Sash") {
      recordConsumedItem(s, di, d.item);
      d.item = "";
      s.log.push(`${d.name} 气势披带触发`);
      applySymbiosis(s, di, catalog);
      updateUnburden(d);
    }
  }
  s.hp[di] -= loss;
  s.dealt[di] += loss;
  s.dealtThisMove[di] += loss;
  d.hp = (s.hp[di] / s.max[di]) * 100;
  s.log.push(
    `${a.name} → ${d.name} · ${m.zh} ${((loss / s.max[di]) * 100).toFixed(1)}%${s.hp[di] === 0 ? " · 倒下" : ""}`,
  );
  if (telepathyBlocked) s.log.push(`${d.name} 心灵感应避开队友的攻击`);
  const ignoredDefenderAbility = s.actionAbility === "Mold Breaker";
  if (!d.protected && !ignoredDefenderAbility) {
    const ability = abilityOf(d), type = m.type;
    const healAbility =
      (type === "Water" && ["Water Absorb", "Dry Skin"].includes(ability)) ||
      (type === "Electric" && ability === "Volt Absorb") ||
      (type === "Ground" && ability === "Earth Eater");
    if (healAbility) {
      const before = s.hp[di];
      s.hp[di] = Math.min(s.max[di], s.hp[di] + Math.floor(s.max[di] / 4));
      d.hp = (s.hp[di] / s.max[di]) * 100;
      s.log.push(`${d.name} ${abilityName(ability, catalog)}吸收招式${s.hp[di] > before ? "并回复最大 HP 的 1/4" : ""}`);
    }
    if (type === "Fire" && ability === "Flash Fire") {
      d.abilityOn = true;
      s.log.push(`${d.name} 引火被激活`);
    }
    if (type === "Grass" && ability === "Sap Sipper") {
      const raised = changeBoost(d, { atk: 1 }); triggerOpportunist(s, di, raised);
      s.log.push(`${d.name} 食草吸收招式：攻击 +${d.boosts.atk}`);
    }
    if (type === "Electric" && ability === "Motor Drive") {
      const raised = changeBoost(d, { spe: 1 }); triggerOpportunist(s, di, raised);
      s.log.push(`${d.name} 电气引擎吸收招式：速度 +${d.boosts.spe}`);
    }
  }
  const lightningRodToken = `${ai}:${di}`;
  if (
    m.type === "Electric" &&
    abilityOf(d) === "Lightning Rod" &&
    !d.protected &&
    s.actionAbility !== "Mold Breaker" &&
    !s.lightningRodTriggers.includes(lightningRodToken)
  ) {
    s.lightningRodTriggers.push(lightningRodToken);
    const raised = changeBoost(d, { spa: 1 });
    triggerOpportunist(s, di, raised);
    s.log.push(`${d.name} 避雷针吸收电属性招式：特攻 +${d.boosts.spa}`);
  }
  if (disguiseBroke) {
    const disguiseLoss = Math.min(
      s.hp[di],
      Math.max(1, Math.floor(s.max[di] / 8)),
    );
    s.hp[di] -= disguiseLoss;
    d.currentAbility = "";
    d.hp = (s.hp[di] / s.max[di]) * 100;
    s.log.push(`${d.name} 画皮挡下第一击，随后损失最大 HP 的 1/8`);
  }
  const berryType=RESIST_BERRY_TYPES[d.item];
  if(loss>0&&berryType&&!opposingUnnerve(s,di)) {
    const types=catalog.pokemon.find((p)=>p.id===d.species).types;
    const effective=types.reduce((n,t)=>n*(TYPE_CHART[0][m.type]?.[t]??1),1);
    if((berryType===m.type&&effective>1)||(d.item==="Chilan Berry"&&m.type==="Normal")) {
      const berryName=catalog.items.find((item)=>item.name===d.item)?.zh||d.item;
      d.consumedBerry=d.item;
      recordConsumedItem(s,di,d.item);
      d.item="";
      s.log.push(`${d.name} ${berryName}触发，${abilityOf(d) === "Ripen" ? "熟成后本次第一击降至四分之一" : "仅减半本次攻击的第一击"}`);
      applySymbiosis(s, di, catalog);
      updateUnburden(d);
      applyCheekPouch(s, di, d);
    }
  }
  if (loss > 0) {
    if((ai<2)===(di<2))s.log.push(`${a.name} 的 ${m.zh} 误伤队友 ${d.name}`);
    if (
      abilityOf(d) === "Berserk" &&
      defenderBefore > s.max[di] / 2 &&
      s.hp[di] > 0 &&
      s.hp[di] <= s.max[di] / 2 &&
      !(s.actionAbility === "Sheer Force" && m.secondary)
    ) d.berserkPending = true;
    if (abilityOf(d) === "Sand Spit" && s.scene.field.weather !== "Sand") {
      s.scene.field.weather = "Sand";
      s.openingWeather = "Sand";
      s.log.push(`${d.name} 吐沙发动 → 沙暴`);
    }
    applyContactAbility(s, ai, di, m, catalog);
    if (m.drain)
      s.hp[ai] = Math.min(
        s.max[ai],
        s.hp[ai] + Math.max(1, Math.floor((loss * m.drain[0]) / m.drain[1])),
      );
    if (m.recoil && !["Rock Head", "Magic Guard"].includes(abilityOf(a)))
      s.hp[ai] = Math.max(
        0,
        s.hp[ai] - Math.max(1, Math.round((loss * m.recoil[0]) / m.recoil[1])),
      );
    if(m.recoil&&!["Rock Head","Magic Guard"].includes(abilityOf(a)))s.log.push(`${a.name} 承受招式反伤`);
    if (
      ["Sitrus Berry", "Oran Berry"].includes(d.item) &&
      !opposingUnnerve(s,di) &&
      s.hp[di] > 0 &&
      s.hp[di] <= s.max[di] / 2
    ) {
      const berry = d.item;
      d.consumedBerry=berry;
      recordConsumedItem(s,di,berry);
      const baseHeal = berry === "Oran Berry" ? 10 : Math.floor(s.max[di] / 4);
      s.hp[di] = Math.min(
        s.max[di],
        s.hp[di] + baseHeal * (abilityOf(d) === "Ripen" ? 2 : 1),
      );
      d.item = "";
      s.log.push(`${d.name} ${berry === "Oran Berry" ? "橙橙果" : "文柚果"}回复${abilityOf(d) === "Ripen" ? "（熟成加倍）" : ""}`);
      applySymbiosis(s, di, catalog);
      applyCheekPouch(s, di, d);
    }
    if (abilityOf(d) === "Stamina") {
      const raised=changeBoost(d, { def: 1 });triggerOpportunist(s,di,raised);
    }
    if (abilityOf(d) === "Weak Armor" && m.category === "Physical") {
      const raised=changeBoost(d, { def: -1, spe: 2 });triggerOpportunist(s,di,raised);
    }
    if (abilityOf(d) === "Water Compaction" && m.type === "Water") {
      const raised=changeBoost(d, { def: 2 });triggerOpportunist(s,di,raised);
    }
    if (abilityOf(d) === "Justified" && m.type === "Dark" && !ignoredDefenderAbility) {
      const raised=changeBoost(d,{atk:1});triggerOpportunist(s,di,raised);
      s.log.push(`${d.name} 正义之心：攻击 +${d.boosts.atk}`);
    }
    if (abilityOf(d) === "Anger Point" && (a.crit || m.willCrit) && !ignoredDefenderAbility) {
      const before=d.boosts.atk;d.boosts.atk=6;
      const raised={atk:6-before};triggerOpportunist(s,di,raised);
      s.log.push(`${d.name} 愤怒穴位：攻击提升至 +6`);
    }
    if (abilityOf(d) === "Electromorphosis" && !ignoredDefenderAbility) {
      d.abilityOn=true;
      s.log.push(`${d.name} 电力转换进入充电状态`);
    }
    if (abilityOf(d) === "Spicy Spray" && !ignoredDefenderAbility && !a.status && canReceiveStatus(s,ai,"brn",catalog)) {
      a.status="brn";
      s.log.push(`${d.name} 辣椒喷发使 ${a.name} 陷入灼伤`);
    }
    if (contactMade(a, m)) {
      if (["Rough Skin", "Iron Barbs"].includes(abilityOf(d)))
        s.hp[ai] = Math.max(0, s.hp[ai] - Math.floor(s.max[ai] / 8));
      if (d.item === "Rocky Helmet")
        s.hp[ai] = Math.max(0, s.hp[ai] - Math.floor(s.max[ai] / 6));
      if(['Rough Skin','Iron Barbs'].includes(abilityOf(d))||d.item==='Rocky Helmet')s.log.push(`${a.name} 承受 ${d.name} 的接触反伤`);
    }
    if (
      m.secondary &&
      (m.secondary.chance === 100 || a.secondary) &&
      s.actionAbility !== "Sheer Force" &&
      abilityOf(d) !== "Shield Dust"
    ) {
      if(m.secondary.boosts)applyOpponentBoost(s,ai,di,m.secondary.boosts,m.zh,m.secondary.chance===100,catalog);
      if (m.secondary.self) {
        const raised=changeBoost(a, m.secondary.self.boosts);triggerOpportunist(s,ai,raised);
      }
      if (m.secondary.status && !d.status) {
        const t = catalog.pokemon.find((p) => p.id === d.species).types;
        if (
          !(m.secondary.status === "brn" && t.includes("Fire")) &&
          !(m.secondary.status === "par" && t.includes("Electric")) &&
          !(
            ["psn", "tox"].includes(m.secondary.status) &&
            (t.includes("Poison") || t.includes("Steel"))
          )
        )
          d.status = m.secondary.status;
      }
    }
    if (s.hp[di] === 0 && abilityOf(a) === "Moxie") {
      const raised=changeBoost(a, { atk: 1 });triggerOpportunist(s,ai,raised);
    }
  }
  if (attackerBefore > 0 && s.hp[ai] === 0) triggerReceiver(s, ai, catalog);
  a.hp = (s.hp[ai] / s.max[ai]) * 100;
  d.hp = (s.hp[di] / s.max[di]) * 100;
}
function finishTarget(state, attackerIndex, defenderIndex, move, hitCount, catalog) {
  const attacker=state.scene.actors[attackerIndex],defender=state.scene.actors[defenderIndex];
  if(defender.berserkPending) {
    if(hitCount===1||state.hp[defenderIndex]<=state.max[defenderIndex]/2) {
      const raised=changeBoost(defender,{spa:1});triggerOpportunist(state,defenderIndex,raised);
      state.log.push(`${defender.name} 怒火冲天：特攻 +${defender.boosts.spa}`);
    }
    delete defender.berserkPending;
  }
  if(state.hp[defenderIndex]===0) {
    const ability=abilityOf(defender),magicGuard=abilityOf(attacker)==='Magic Guard';
    if(ability==='Aftermath'&&contactMade(attacker,move)&&!magicGuard) {
      const damp=activeIndices(state.scene).some((i)=>state.scene.actors[i].present&&state.hp[i]>0&&abilityOf(state.scene.actors[i])==='Damp');
      if(!damp||abilityOf(attacker)==='Mold Breaker') {
        state.hp[attackerIndex]=Math.max(0,state.hp[attackerIndex]-Math.floor(state.max[attackerIndex]/4));
        state.log.push(`${defender.name} 诱爆造成 ${attacker.name} 最大 HP 的 1/4 伤害`);
      }
    }
    if(ability==='Innards Out'&&!magicGuard&&state.dealtThisMove[defenderIndex]>0) {
      const reflected=Math.min(state.hp[attackerIndex],state.dealtThisMove[defenderIndex]);
      state.hp[attackerIndex]-=reflected;
      state.log.push(`${defender.name} 飞出的内在物对 ${attacker.name} 造成等同本次招式损血的伤害`);
    }
    triggerReceiver(state,defenderIndex,catalog);
  }
  attacker.hp=state.hp[attackerIndex]/state.max[attackerIndex]*100;
  defender.hp=state.hp[defenderIndex]/state.max[defenderIndex]*100;
}
function mergeStates(states) {
  const map = new Map();
  for (const s of states) {
    const key = JSON.stringify([
      s.hp,
      s.done,
      s.scene.field,
      s.scene.actors.map((a) => [
        a.boosts,
        a.status,
        a.item,
        a.consumedBerry,
        a.ability,
        a.currentAbility,
        a.abilityOn,
        a.battleTypes,
        a.battleForm,
        a.berserkPending,
        a.protected,
      ]),
      s.dealt,
      s.dealtThisMove,
      s.actionAbility,
      s.lightningRodTriggers,
      s.consumedItems,
      s.quickDraw,
      s.openingWeather,
      s.didDamage,
    ]);
    const found = map.get(key);
    if (found) found.p += s.p;
    else map.set(key, s);
  }
  if (map.size > 18000)
    throw new Error(
      "此场景的精确分支过多；请减少范围目标或行动数量。没有用抽样值替代精确结果。",
    );
  return [...map.values()];
}
function endTurn(state, catalog) {
  // Weather, terrain/recovery, then major-status damage. Stop processing a fainted slot.
  for (const i of activeIndices(state.scene)) {
    const b = state.scene.actors[i];
    if (!b.present || state.hp[i] <= 0) continue;
    const max = state.max[i],
      types = battleTypesOf(b,state.scene,catalog);
    let hp = state.hp[i];
    const beforeTurnEnd = hp;
    const weather = weatherOf(state.scene);
    const hurt = (n) => {
      if (abilityOf(b) !== "Magic Guard")
        hp = Math.max(0, hp - Math.max(1, Math.floor(max * n)));
    };
    const heal = (n) => {
      if (hp > 0) hp = Math.min(max, hp + Math.max(1, Math.floor(max * n)));
    };
    if (
      weather === "Sand" &&
      !types.some((t) => ["Rock", "Steel", "Ground"].includes(t)) &&
      ![
        "Magic Guard",
        "Overcoat",
        "Sand Rush",
        "Sand Force",
        "Sand Veil",
      ].includes(abilityOf(b))
    )
      hurt(1 / 16);
    if (hp > 0 && weather === "Sun" && abilityOf(b) === "Solar Power") hurt(1 / 8);
    if (hp > 0 && weather === "Rain" && abilityOf(b) === "Rain Dish") heal(1 / 16);
    if (hp > 0 && abilityOf(b) === "Dry Skin") {
      if (weather === "Rain") heal(1 / 8);
      if (weather === "Sun") hurt(1 / 8);
    }
    if (hp > 0 && weather === "Snow" && abilityOf(b) === "Ice Body") heal(1 / 16);
    if (hp > 0 && weather === "Rain" && abilityOf(b) === "Hydration" && b.status) {
      b.status = "";
      state.log.push(`${b.name} 湿润之躯治愈了异常状态`);
    }
    if (
      hp > 0 &&
      state.scene.field.terrain === "Grassy" &&
      (state.scene.field.gravity ||
        (!types.includes("Flying") &&
          !["Levitate", "Eelevate"].includes(abilityOf(b))))
    )
      heal(1 / 16);
    if (hp > 0 && b.item === "Leftovers") heal(1 / 16);
    if (
      hp > 0 &&
      abilityOf(b) === "Poison Heal" &&
      ["tox", "psn"].includes(b.status)
    )
      heal(1 / 8);
    else if (hp > 0) {
      if (b.status === "brn") hurt(abilityOf(b) === "Heatproof" ? 1 / 32 : 1 / 16);
      if (b.status === "psn") hurt(1 / 8);
      if (b.status === "tox") hurt(1 / 16);
    }
    state.hp[i] = hp;
    b.hp = (hp / max) * 100;
    if(beforeTurnEnd>0&&hp===0)triggerReceiver(state,i,catalog);
  }
  return state;
}
function endTurnAbilityBranches(input) {
  let branches=[input];
  for(const i of activeIndices(input.scene)) {
    branches=branches.flatMap(state=>{
      const pokemon=state.scene.actors[i];
      if(!pokemon.present||state.hp[i]<=0)return [state];
      const candidates=[];
      if(abilityOf(pokemon)==='Shed Skin'&&pokemon.status)candidates.push(i);
      if(abilityOf(pokemon)==='Healer'&&state.scene.mode==='double') {
        const pi=partnerIndex(i),partner=state.scene.actors[pi];
        if(partner?.present&&state.hp[pi]>0&&partner.status)candidates.push(pi);
      }
      if(!candidates.length)return [state];
      const cured=clone(state),notCured=clone(state);
      cured.p*=0.3;notCured.p*=0.7;
      for(const ci of candidates)cured.scene.actors[ci].status='';
      cured.log.push(`${pokemon.name} ${abilityOf(pokemon)==='Shed Skin'?'蜕皮':'治愈之心'}治愈了异常状态`);
      return [cured,notCured];
    });
  }
  return branches;
}
function activateRecoveredBerry(state,index,catalog) {
  const holder=state.scene.actors[index];
  if(
    opposingUnnerve(state,index)||
    !['Sitrus Berry','Oran Berry'].includes(holder.item)||
    state.hp[index]>state.max[index]/2
  )return;
  const berry=holder.item,base=berry==='Oran Berry'?10:Math.floor(state.max[index]/4);
  holder.consumedBerry=berry;
  recordConsumedItem(state,index,berry);
  state.hp[index]=Math.min(
    state.max[index],
    state.hp[index]+base*(abilityOf(holder)==='Ripen'?2:1),
  );
  holder.item='';holder.hp=state.hp[index]/state.max[index]*100;
  state.log.push(`${holder.name} 立即吃掉${itemName(berry,catalog)}并回复${abilityOf(holder)==='Ripen'?'（熟成加倍）':''}`);
  applyCheekPouch(state,index,holder);
}
function itemRecoveryBranches(input,catalog,processed=[]) {
  const available=activeIndices(input.scene).filter(i=>{
    const holder=input.scene.actors[i],ability=abilityOf(holder);
    return !processed.includes(i)&&holder.present&&input.hp[i]>0&&
      ['Harvest','Pickup'].includes(ability);
  });
  if(!available.length)return [input];
  const fastest=Math.max(...available.map(i=>speedOf(input.scene.actors[i],input.scene,catalog,i)));
  const tied=available.filter(i=>speedOf(input.scene.actors[i],input.scene,catalog,i)===fastest);
  return tied.flatMap(i=>{
    const state=clone(input),holder=state.scene.actors[i],nextProcessed=[...processed,i];
    state.p/=tied.length;
    if(holder.item)return itemRecoveryBranches(state,catalog,nextProcessed);
    const consumed=state.consumedItems||[];
    if(abilityOf(holder)==='Pickup') {
      const entry=[...consumed].reverse().find(candidate=>
        candidate.index!==i&&state.scene.actors[candidate.index]?.present&&state.hp[candidate.index]>0
      );
      if(!entry)return itemRecoveryBranches(state,catalog,nextProcessed);
      holder.item=entry.item;recoverConsumedItem(state,entry);
      state.log.push(`${holder.name} 捡拾获得${itemName(entry.item,catalog)}`);
      activateRecoveredBerry(state,i,catalog);
      return itemRecoveryBranches(state,catalog,nextProcessed);
    }
    const own=[...consumed].reverse().find(candidate=>
      candidate.index===i&&candidate.item.endsWith('Berry')
    );
    if(!own)return itemRecoveryBranches(state,catalog,nextProcessed);
    const chance=weatherOf(state.scene)==='Sun'?1:0.5;
    const restored=clone(state);
    restored.scene.actors[i].item=own.item;recoverConsumedItem(restored,own);
    restored.log.push(`${holder.name} 收获重新获得${itemName(own.item,catalog)}`);
    activateRecoveredBerry(restored,i,catalog);
    const success=itemRecoveryBranches(restored,catalog,nextProcessed);
    if(chance===1)return success;
    for(const branch of success)branch.p*=chance;
    const missed=clone(state);missed.p*=1-chance;
    return [...success,...itemRecoveryBranches(missed,catalog,nextProcessed)];
  });
}
export function simulateTurn(scene, catalog) {
  try {
    scene = withMandatoryActions(scene);
    const limits = turnLimits(scene, catalog);
    if (limits.length) return { error: limits.join("；") };
    let states=openingBranches(scene,catalog);
    const max=states[0].max,hp=states[0].hp;
    const opening=states.map(s=>({weather:s.openingWeather,probability:s.p*100,log:s.openingLog,remaining:s.hp.map((v,i)=>v/max[i]*100),boosts:s.scene.actors.map(b=>clone(b.boosts))}));
    states.forEach(s=>{s.log=[];});
    for (const i of activeIndices(scene)) {
      if (!scene.actors[i].present || !scene.actors[i].active || abilityOf(scene.actors[i]) !== "Quick Draw") continue;
      states=states.flatMap(s=>{
        const active=clone(s),inactive=clone(s);
        active.p*=0.3;inactive.p*=0.7;
        active.quickDraw=[...(active.quickDraw||[]),i];
        inactive.quickDraw=[...(inactive.quickDraw||[])];
        active.log.push(`${active.scene.actors[i].name} 速击发动`);
        return [active,inactive];
      });
    }
    const timelineMap=new Map();
    function recordAction(before,after,ai,m,step) {
      const key=JSON.stringify([after.openingWeather,after.done]);
      const target=scene.target,damage=(after.dealt[target]-before.dealt[target])/max[target]*100,remaining=after.hp[target]/max[target]*100;
      const row=timelineMap.get(key)||{key,step,actor:ai,move:m.id,weather:after.openingWeather,order:[...after.done],p:0,damage:{min:Infinity,max:-Infinity,mean:0},remaining:{min:Infinity,max:-Infinity,mean:0},notes:new Set()};
      row.p+=after.p;
      for(const [name,value] of [['damage',damage],['remaining',remaining]]){
        row[name].min=Math.min(row[name].min,value);row[name].max=Math.max(row[name].max,value);row[name].mean+=value*after.p;
      }
      for(const text of after.log.slice(before.log.length))if(!text.startsWith(`${after.scene.actors[ai].name} →`)&&!text.endsWith(`使用 ${m.zh}`))row.notes.add(text);
      if(after.hp[ai]===0)row.notes.add(`${after.scene.actors[ai].name} 倒下，不能再行动`);
      if(after.hp[target]===0)row.notes.add('集火目标倒下，后续单体攻击不再造成伤害');
      timelineMap.set(key,row);
    }
    const acting = activeIndices(scene).filter(
      (i) => i !== 3 && scene.actors[i].active && scene.actors[i].present,
    );
    for (let step = 0; step < acting.length; step++) {
      let out = [];
      for (const s of states) {
        const available = acting.filter(
          (i) => !s.done.includes(i) && s.hp[i] > 0,
        );
        if (!available.length) {
          out.push(s);
          continue;
        }
        const rank = (i) => [
          priority(
            s.scene.actors[i],
            catalog.moves[s.scene.actors[i].moves[s.scene.actors[i].selected]],
          ),
          s.quickDraw?.includes(i)
            ? 1
            : abilityOf(s.scene.actors[i]) === "Stall"
              ? -1
              : 0,
          speedOf(s.scene.actors[i], s.scene, catalog, i) *
            (s.scene.field.trickRoom ? -1 : 1),
        ];
        available.sort(
          (a, b) =>
            rank(b)[0] - rank(a)[0] ||
            rank(b)[1] - rank(a)[1] ||
            rank(b)[2] - rank(a)[2],
        );
        const best = rank(available[0]),
          ties = available.filter(
            (i) =>
              rank(i)[0] === best[0] &&
              rank(i)[1] === best[1] &&
              rank(i)[2] === best[2],
          );
        for (const ai of ties) {
          const state = clone(s);
          state.p /= ties.length;
          state.done.push(ai);
          const actor = state.scene.actors[ai],
            m = catalog.moves[actor.moves[actor.selected]];
          state.dealtThisMove = [0, 0, 0, 0];
          state.lightningRodTriggers = [];
          state.actionAbility = abilityOf(actor);
          state.scene.turnDone = [...state.done];
          const blockedBy = priorityBlocker(state.scene, ai, m, catalog);
          if (blockedBy) {
            state.log.push(`${blockedBy}拦下 ${actor.name} 的${m.zh}`);
            recordAction(s, state, ai, m, step);
            out.push(state);
            continue;
          }
          if (
            m.category !== "Status" &&
            actor.species === "aegislash" &&
            abilityOf(actor) === "Stance Change" &&
            !actor.imposterOriginalSpecies &&
            actor.battleForm !== "blade"
          ) {
            actor.battleForm = "blade";
            state.log.push(`${actor.name} 战斗切换为刀剑形态`);
          }
          if (m.category === "Status") {
            const next=statusMove(state,ai,m,catalog);recordAction(s,next,ai,m,step);out.push(next);
            continue;
          }
          let branches = [state];
          state.didDamage = false;
          const affected = targets(state.scene, ai, m, catalog).filter(
            (i) => state.hp[i] > 0 && state.scene.actors[i].present,
          );
          const selectedTarget = ai < 2 ? state.scene.target : actor.target || 0;
          if (
            m.type === "Electric" &&
            affected.length === 1 &&
            affected[0] !== selectedTarget &&
            abilityOf(state.scene.actors[affected[0]]) === "Lightning Rod"
          )
            state.log.push(
              `${state.scene.actors[affected[0]].name} 避雷针改变攻击目标`,
            );
          if(m.id==='brickbreak')for(const di of affected){
            const d=state.scene.actors[di];
            if(d.protected)continue;
            const test=damageFor(actor,d,m.id,state.scene,catalog);
            if(test.max<=0)continue;
            const side=state.scene.field[di<2?'attacker':'defender'];
            if(side.isReflect||side.isLightScreen||side.isAuroraVeil)state.log.push(`${actor.name} 劈瓦破除${di<2?'我方':'对方'}反射壁、光墙及极光幕`);
            side.isReflect=false;side.isLightScreen=false;side.isAuroraVeil=false;
          }
          // Capture spread targeting before any recipient faints within this move.
          const spreadScene = clone(state.scene);
          for (const di of affected) {
            const expanded = [];
            for (const branch of branches) {
              const result = damageFor(
                spreadScene.actors[ai],
                spreadScene.actors[di],
                m.id,
                spreadScene,
                catalog,
              );
              let hitBranches=[branch];
              for(let hitIndex=0;hitIndex<result.hitDists.length;hitIndex++) {
                const hitExpanded=[];
                for(const hitBranch of hitBranches) {
                  if(hitBranch.hp[di]<=0) { hitExpanded.push(hitBranch); continue; }
                  let hitDist=result.hitDists[hitIndex];
                  if(hitIndex>0) {
                    const dynamicAttacker=hitBranch.actionAbility==='Parental Bond'
                      ? {...hitBranch.scene.actors[ai],currentAbility:'Parental Bond'}
                      : hitBranch.scene.actors[ai];
                    const refreshed=damageFor(dynamicAttacker,hitBranch.scene.actors[di],m.id,hitBranch.scene,catalog);
                    hitDist=refreshed.hitDists[Math.min(hitIndex,refreshed.hitDists.length-1)];
                  }
                  for(const roll of hitDist) {
                    const next=clone(hitBranch);
                    next.p*=roll.p;
                    if(roll.damage>0)next.didDamage=true;
                    afterHit(next,ai,di,m,roll.damage,catalog);
                    hitExpanded.push(next);
                  }
                }
                hitBranches=mergeStates(hitExpanded);
              }
              for (const hitBranch of hitBranches)
                finishTarget(
                  hitBranch,
                  ai,
                  di,
                  m,
                  result.hitDists.length,
                  catalog,
                );
              expanded.push(...hitBranches);
            }
            branches = mergeStates(expanded);
          }
          for (const branch of branches) {
            const a = branch.scene.actors[ai];
            if (branch.didDamage) {
              const raised = changeBoost(a, m.self?.boosts);
              triggerOpportunist(branch, ai, raised);
            }
            const beforeLifeOrb = branch.hp[ai];
            if (
              a.item === "Life Orb" &&
              abilityOf(a) !== "Magic Guard" &&
              !(branch.actionAbility === "Sheer Force" && m.secondary) &&
              branch.didDamage
            ) {
              branch.hp[ai] = Math.max(
                0,
                branch.hp[ai] - Math.floor(branch.max[ai] / 10),
              );
              a.hp = (branch.hp[ai] / branch.max[ai]) * 100;
              branch.log.push(`${a.name} 生命宝珠反伤`);
            }
            if (beforeLifeOrb > 0 && branch.hp[ai] === 0)
              triggerReceiver(branch, ai, catalog);
            applyPostMoveItemAbilities(branch, ai, affected, m, catalog);
            if (branch.actionAbility === "Electromorphosis" && m.type === "Electric")
              a.abilityOn = false;
            recordAction(s,branch,ai,m,step);
          }
          out.push(...branches);
        }
      }
      states = mergeStates(out);
    }
    const target = scene.target,
      total = states.reduce((s, x) => s + x.p, 0);
    const damage = summarize(
      states.map((s) => ({ damage: s.dealt[target], p: s.p / total })),
      max[target],
      hp[target],
    );
    damage.ko =
      (states.reduce((s, x) => s + (x.hp[target] === 0 ? x.p : 0), 0) / total) *
      100;
    const afterAction = scene.actors.map((_, i) => ({
      min: (Math.min(...states.map((s) => s.hp[i])) / max[i]) * 100,
      max: (Math.max(...states.map((s) => s.hp[i])) / max[i]) * 100,
      mean:
        (states.reduce((sum, s) => sum + s.hp[i] * s.p, 0) / total / max[i]) *
        100,
    }));
    states = mergeStates(
      states
        .flatMap(endTurnAbilityBranches)
        .map((s) => endTurn(s, catalog))
        .flatMap((s) => itemRecoveryBranches(s,catalog)),
    );
    const representative = states.reduce((a, b) => (a.p > b.p ? a : b)).log;
    const afterEnd = scene.actors.map((_, i) => ({
      min: (Math.min(...states.map((s) => s.hp[i])) / max[i]) * 100,
      max: (Math.max(...states.map((s) => s.hp[i])) / max[i]) * 100,
      mean:
        (states.reduce((sum, s) => sum + s.hp[i] * s.p, 0) / total / max[i]) *
        100,
    }));
    return {
      damage,
      afterAction,
      afterEnd,
      remaining: afterEnd[target],
      endKO:
        (states.reduce((s, x) => s + (x.hp[target] === 0 ? x.p : 0), 0) /
          total) *
        100,
      branches: states.length,
      log: representative,
      opening,
      timeline:[...timelineMap.values()].map(r=>({...r,probability:r.p*100/total,damage:{...r.damage,mean:r.damage.mean/r.p},remaining:{...r.remaining,mean:r.remaining.mean/r.p},notes:[...r.notes]})).sort((a,b)=>a.step-b.step||a.actor-b.actor),
      weatherResults:[...new Set(states.map(s=>s.openingWeather))].map(weather=>{
        const subset=states.filter(s=>s.openingWeather===weather),p=subset.reduce((n,s)=>n+s.p,0);
        return {weather,probability:p/total*100,remaining:{min:Math.min(...subset.map(s=>s.hp[target]))/max[target]*100,max:Math.max(...subset.map(s=>s.hp[target]))/max[target]*100,mean:subset.reduce((n,s)=>n+s.hp[target]*s.p,0)/p/max[target]*100},ko:subset.reduce((n,s)=>n+(s.hp[target]===0?s.p:0),0)/p*100};
      }),
      note: "社区规则试算；概率汇总全部已展开分支，单一路径仅供示例。开局自动天气、威吓、甘露之蜜及入场钉子已计入。突袭按成功出招试算；不服输/好胜仅响应出招前的必定降能力。剧毒按首回合处理；未列机制仍需核验。",
    };
  } catch (e) {
    return { error: e.message };
  }
}
