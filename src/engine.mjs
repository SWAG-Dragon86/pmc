import { Pokemon, Move, Field, calculate, TYPE_CHART } from "./vendor/calc.mjs";
import { openingBranches, changeBoost, applyOpponentBoost } from './opening.mjs';
import {
  validateBuild,
  activeIndices,
  clone,
  withMandatoryActions,
  duplicateSpeciesIssues,
} from "./model.mjs";

export const RESIST_BERRY_TYPES = {
  "Occa Berry": "Fire", "Passho Berry": "Water", "Wacan Berry": "Electric",
  "Rindo Berry": "Grass", "Yache Berry": "Ice", "Chople Berry": "Fighting",
  "Kebia Berry": "Poison", "Shuca Berry": "Ground", "Coba Berry": "Flying",
  "Payapa Berry": "Psychic", "Tanga Berry": "Bug", "Charti Berry": "Rock",
  "Kasib Berry": "Ghost", "Haban Berry": "Dragon", "Colbur Berry": "Dark",
  "Babiri Berry": "Steel", "Roseli Berry": "Fairy", "Chilan Berry": "Normal",
};

export function makePokemon(build, catalog) {
  const p = catalog.pokemon.find((p) => p.id === build.species);
  if (!p) throw new Error("形态不在当前数据包");
  const pokemon = new Pokemon(0, p.name, {
    nature: build.nature,
    evs: build.points,
    boosts: build.boosts,
    ability: build.ability,
    item: build.item,
    status: build.status,
    abilityOn: true,
  });
  // Internal turn HP stays an integer. Never round a percentage back down a second time.
  pokemon.originalCurHP = Math.floor((pokemon.maxHP() * build.hp) / 100 + 1e-9);
  return pokemon;
}
export const statsOf = (build, catalog) => makePokemon(build, catalog).rawStats;
function targets(scene, attackerIndex, move, catalog) {
  const ally = attackerIndex < 2;
  const live = activeIndices(scene).filter(
    (i) =>
      i !== attackerIndex && scene.actors[i].present && scene.actors[i].hp > 0,
  );
  if (move.target === "allAdjacent") return live;
  if (move.target === "allAdjacentFoes")
    return live.filter((i) => i < 2 !== ally);
  return [ally ? scene.target : scene.actors[attackerIndex].target || 0];
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
    ...validateBuild(attacker, catalog),
    ...validateBuild(defender, catalog),
  ];
  if (invalid.length) throw new Error(invalid[0]);
  const m = catalog.moves[moveId];
  if (!m) throw new Error("招式失效");
  const a = makePokemon(attacker, catalog),
    d = makePokemon(defender, catalog);
  if (moveId === "expandingforce")
    throw new Error("该招式的动态范围尚未完成适配，请先核对单独案例");
  // Entry stat drops are entered explicitly in the opening stages, not retriggered per hit.
  if (a.ability === "Intimidate") a.ability = "";
  if (d.ability === "Intimidate") d.ability = "";
  const ai = scene.actors.findIndex((x) => x.id === attacker.id),
    side = ai >= 2 ? "defender" : "attacker",
    other = side === "attacker" ? "defender" : "attacker";
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
  const move = new Move(0, m.name, {
    ability: a.ability,
    item: a.item,
    species: a.name,
    isCrit: attacker.crit,
    hits,
    overrides:
      !spread && ["allAdjacent", "allAdjacentFoes"].includes(m.target)
        ? { target: "normal" }
        : undefined,
  });
  const attackerSide = { ...scene.field[side] },
    defenderSide = { ...scene.field[other], isProtected: defender.protected };
  if (scene.mode === "double") {
    const di = scene.actors.findIndex((b) => b.id === defender.id);
    for (const i of activeIndices(scene)) {
      const partner = scene.actors[i];
      if (!partner.present || partner.hp <= 0) continue;
      if (i !== ai && i < 2 === ai < 2) {
        if (partner.ability === "Battery") attackerSide.isBattery = true;
        if (partner.ability === "Power Spot") attackerSide.isPowerSpot = true;
        if (partner.ability === "Steely Spirit")
          attackerSide.isSteelySpirit = true;
      }
      if (scene.field[other].friendGuardOverride !== false && i !== di && i < 2 === di < 2 && partner.ability === "Friend Guard")
        defenderSide.isFriendGuard = true;
    }
  }
  const field = new Field({
    gameType: scene.mode === "double" ? "Doubles" : "Singles",
    weather: scene.field.weather || undefined,
    terrain: scene.field.terrain || undefined,
    isGravity: !!scene.field.gravity,
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
  if (b.status === "par" && b.ability !== "Quick Feet")
    speed = Math.floor(speed / 2);
  if (b.status && b.ability === "Quick Feet") speed = Math.floor(speed * 1.5);
  const field = scene.field,
    indexSide = index < 2 ? "attacker" : "defender";
  if (field[indexSide].isTailwind) speed *= 2;
  if (
    (field.weather === "Sun" && b.ability === "Chlorophyll") ||
    (field.weather === "Rain" && b.ability === "Swift Swim") ||
    (field.weather === "Sand" && b.ability === "Sand Rush") ||
    (field.weather === "Snow" && b.ability === "Slush Rush") ||
    (field.terrain === "Electric" && b.ability === "Surge Surfer")
  )
    speed *= 2;
  if (b.item === "Choice Scarf") speed = Math.floor(speed * 1.5);
  return speed;
}
function priority(b, m) {
  return (
    m.priority +
    (m.category === "Status" && b.ability === "Prankster" ? 1 : 0) +
    (m.type === "Flying" && b.ability === "Gale Wings" && b.hp === 100
      ? 1
      : 0) +
    (m.heal && b.ability === "Triage" ? 3 : 0)
  );
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
  "Disguise",
  "Ice Face",
  "Stance Change",
  "Schooling",
  "Shields Down",
  "Zen Mode",
  "Battle Bond",
  "Power Construct",
  "Emergency Exit",
  "Wimp Out",
  "Gulp Missile",
  "Mummy",
  "Lingering Aroma",
  "Wandering Spirit",
  "Pickpocket",
  "Magician",
  "Symbiosis",
  "Dancer",
  "Receiver",
  "Power of Alchemy",
  "Anger Shell",
  "Berserk",
  "Color Change",
  "Cotton Down",
  "Seed Sower",
  "Sand Spit",
  "Toxic Debris",
  "Emergency Exit",
  "Aftermath",
  "Innards Out",
  "Parental Bond",
  "Opportunist",
  "Mirror Armor",
  "Cud Chew",
  "Ripen",
  "Cheek Pouch",
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
        "Lightning Rod",
        "Storm Drain",
        "Armor Tail",
        "Queenly Majesty",
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
    target = state.scene.actors[index < 2 ? state.scene.target : b.target || 0];
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
    if(m.target==='self') changeBoost(b,m.boosts);
    else {
      const recipients=m.target==='allAdjacentFoes'?activeIndices(state.scene).filter(i=>(i<2)!==(index<2)):[state.scene.actors.indexOf(target)];
      for(const di of recipients)if(state.scene.actors[di].present&&!state.scene.actors[di].protected)
        applyOpponentBoost(state,index,di,m.boosts,m.zh,true);
    }
  }
  else if (m.status && !target.protected && !target.status) {
    const types = catalog.pokemon.find((p) => p.id === target.species).types;
    if (
      !(m.status === "brn" && types.includes("Fire")) &&
      !(m.status === "par" && types.includes("Electric")) &&
      !(
        ["psn", "tox"].includes(m.status) &&
        (types.includes("Poison") || types.includes("Steel"))
      )
    )
      target.status = m.status;
  }
  log.push(`${b.name} 使用 ${m.zh}`);
  return state;
}
function afterHit(s, ai, di, m, amount, catalog) {
  const a = s.scene.actors[ai],
    d = s.scene.actors[di];
  let loss = Math.min(amount, s.hp[di]);
  if (
    amount >= s.hp[di] &&
    s.hp[di] === s.max[di] &&
    (d.item === "Focus Sash" ||
      (d.ability === "Sturdy" && a.ability !== "Mold Breaker"))
  ) {
    loss = Math.max(0, s.hp[di] - 1);
    if (d.item === "Focus Sash") {
      d.item = "";
      s.log.push(`${d.name} 气势披带触发`);
    }
  }
  s.hp[di] -= loss;
  s.dealt[di] += loss;
  d.hp = (s.hp[di] / s.max[di]) * 100;
  s.log.push(
    `${a.name} → ${d.name} · ${m.zh} ${((loss / s.max[di]) * 100).toFixed(1)}%${s.hp[di] === 0 ? " · 倒下" : ""}`,
  );
  const berryType=RESIST_BERRY_TYPES[d.item];
  if(loss>0&&berryType&&a.ability!=="Unnerve") {
    const types=catalog.pokemon.find((p)=>p.id===d.species).types;
    const effective=types.reduce((n,t)=>n*(TYPE_CHART[0][m.type]?.[t]??1),1);
    if((berryType===m.type&&effective>1)||(d.item==="Chilan Berry"&&m.type==="Normal")) {
      const berryName=catalog.items.find((item)=>item.name===d.item)?.zh||d.item;
      d.item="";
      s.log.push(`${d.name} ${berryName}触发，仅减半本次攻击的第一击`);
    }
  }
  if (loss > 0) {
    if((ai<2)===(di<2))s.log.push(`${a.name} 的 ${m.zh} 误伤队友 ${d.name}`);
    if (m.drain)
      s.hp[ai] = Math.min(
        s.max[ai],
        s.hp[ai] + Math.max(1, Math.floor((loss * m.drain[0]) / m.drain[1])),
      );
    if (m.recoil && !["Rock Head", "Magic Guard"].includes(a.ability))
      s.hp[ai] = Math.max(
        0,
        s.hp[ai] - Math.max(1, Math.round((loss * m.recoil[0]) / m.recoil[1])),
      );
    if(m.recoil&&!["Rock Head","Magic Guard"].includes(a.ability))s.log.push(`${a.name} 承受招式反伤`);
    if (
      ["Sitrus Berry", "Oran Berry"].includes(d.item) &&
      s.hp[di] > 0 &&
      s.hp[di] <= s.max[di] / 2
    ) {
      s.hp[di] = Math.min(
        s.max[di],
        s.hp[di] + (d.item === "Oran Berry" ? 10 : Math.floor(s.max[di] / 4)),
      );
      d.item = "";
      s.log.push(`${d.name} 文柚果回复`);
    }
    if (d.ability === "Stamina") changeBoost(d, { def: 1 });
    if (d.ability === "Weak Armor" && m.category === "Physical")
      changeBoost(d, { def: -1, spe: 2 });
    if (d.ability === "Water Compaction" && m.type === "Water")
      changeBoost(d, { def: 2 });
    if (
      m.flags.contact &&
      a.ability !== "Long Reach" &&
      a.item !== "Protective Pads"
    ) {
      if (["Rough Skin", "Iron Barbs"].includes(d.ability))
        s.hp[ai] = Math.max(0, s.hp[ai] - Math.floor(s.max[ai] / 8));
      if (d.item === "Rocky Helmet")
        s.hp[ai] = Math.max(0, s.hp[ai] - Math.floor(s.max[ai] / 6));
      if(['Rough Skin','Iron Barbs'].includes(d.ability)||d.item==='Rocky Helmet')s.log.push(`${a.name} 承受 ${d.name} 的接触反伤`);
    }
    if (
      m.secondary &&
      (m.secondary.chance === 100 || a.secondary) &&
      a.ability !== "Sheer Force" &&
      d.ability !== "Shield Dust"
    ) {
      if(m.secondary.boosts)applyOpponentBoost(s,ai,di,m.secondary.boosts,m.zh,m.secondary.chance===100);
      if (m.secondary.self) changeBoost(a, m.secondary.self.boosts);
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
    if (s.hp[di] === 0 && a.ability === "Moxie") changeBoost(a, { atk: 1 });
  }
  a.hp = (s.hp[ai] / s.max[ai]) * 100;
  d.hp = (s.hp[di] / s.max[di]) * 100;
}
function mergeStates(states) {
  const map = new Map();
  for (const s of states) {
    const key = JSON.stringify([
      s.hp,
      s.done,
      s.scene.field,
      s.scene.actors.map((a) => [a.boosts, a.status, a.item, a.protected]),
      s.dealt,
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
      types = catalog.pokemon.find((p) => p.id === b.species).types;
    let hp = state.hp[i];
    const weather = state.scene.field.weather;
    const hurt = (n) => {
      if (b.ability !== "Magic Guard")
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
      ].includes(b.ability)
    )
      hurt(1 / 16);
    if (hp > 0 && weather === "Sun" && b.ability === "Solar Power") hurt(1 / 8);
    if (hp > 0 && weather === "Rain" && b.ability === "Rain Dish") heal(1 / 16);
    if (hp > 0 && b.ability === "Dry Skin") {
      if (weather === "Rain") heal(1 / 8);
      if (weather === "Sun") hurt(1 / 8);
    }
    if (hp > 0 && weather === "Snow" && b.ability === "Ice Body") heal(1 / 16);
    if (
      hp > 0 &&
      state.scene.field.terrain === "Grassy" &&
      (state.scene.field.gravity ||
        (!types.includes("Flying") &&
          !["Levitate", "Eelevate"].includes(b.ability)))
    )
      heal(1 / 16);
    if (hp > 0 && b.item === "Leftovers") heal(1 / 16);
    if (
      hp > 0 &&
      b.ability === "Poison Heal" &&
      ["tox", "psn"].includes(b.status)
    )
      heal(1 / 8);
    else if (hp > 0) {
      if (b.status === "brn") hurt(b.ability === "Heatproof" ? 1 / 32 : 1 / 16);
      if (b.status === "psn") hurt(1 / 8);
      if (b.status === "tox") hurt(1 / 16);
    }
    state.hp[i] = hp;
    b.hp = (hp / max) * 100;
  }
  return state;
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
          speedOf(s.scene.actors[i], s.scene, catalog, i) *
            (s.scene.field.trickRoom ? -1 : 1),
        ];
        available.sort(
          (a, b) => rank(b)[0] - rank(a)[0] || rank(b)[1] - rank(a)[1],
        );
        const best = rank(available[0]),
          ties = available.filter(
            (i) => rank(i)[0] === best[0] && rank(i)[1] === best[1],
          );
        for (const ai of ties) {
          const state = clone(s);
          state.p /= ties.length;
          state.done.push(ai);
          const actor = state.scene.actors[ai],
            m = catalog.moves[actor.moves[actor.selected]];
          if (m.category === "Status") {
            const next=statusMove(state,ai,m,catalog);recordAction(s,next,ai,m,step);out.push(next);
            continue;
          }
          let branches = [state];
          state.didDamage = false;
          const affected = targets(state.scene, ai, m, catalog).filter(
            (i) => state.hp[i] > 0 && state.scene.actors[i].present,
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
              for(const hitDist of result.hitDists) {
                const hitExpanded=[];
                for(const hitBranch of hitBranches) {
                  if(hitBranch.hp[di]<=0) { hitExpanded.push(hitBranch); continue; }
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
              expanded.push(...hitBranches);
            }
            branches = mergeStates(expanded);
          }
          for (const branch of branches) {
            const a = branch.scene.actors[ai];
            if (branch.didDamage) changeBoost(a, m.self?.boosts);
            if (
              a.item === "Life Orb" &&
              a.ability !== "Magic Guard" &&
              !(a.ability === "Sheer Force" && m.secondary) &&
              branch.didDamage
            ) {
              branch.hp[ai] = Math.max(
                0,
                branch.hp[ai] - Math.floor(branch.max[ai] / 10),
              );
              a.hp = (branch.hp[ai] / branch.max[ai]) * 100;
              branch.log.push(`${a.name} 生命宝珠反伤`);
            }
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
    const representative = states.reduce((a, b) => (a.p > b.p ? a : b)).log;
    states = states.map((s) => endTurn(s, catalog));
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
