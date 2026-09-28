export const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];
export const OPENING_RULES_VERSION = 3;
export const STAT_NAMES = {
  hp: "HP",
  atk: "攻击",
  def: "防御",
  spa: "特攻",
  spd: "特防",
  spe: "速度",
  accuracy: "命中率",
  evasion: "闪避率",
};
export const TYPES = {
  Normal: "一般",
  Fire: "火",
  Water: "水",
  Electric: "电",
  Grass: "草",
  Ice: "冰",
  Fighting: "格斗",
  Poison: "毒",
  Ground: "地面",
  Flying: "飞行",
  Psychic: "超能力",
  Bug: "虫",
  Rock: "岩石",
  Ghost: "幽灵",
  Dragon: "龙",
  Dark: "恶",
  Steel: "钢",
  Fairy: "妖精",
};
export function uid() {
  if (typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  // LAN HTTP lacks randomUUID, but getRandomValues remains available.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export const clone = (x) => structuredClone(x);
export function validatePoints(points) {
  if (
    !points ||
    STAT_KEYS.some(
      (k) => !Number.isInteger(points[k]) || points[k] < 0 || points[k] > 32,
    )
  )
    return "每项能力点需为 0–32 的整数";
  return STAT_KEYS.reduce((s, k) => s + points[k], 0) > 66
    ? "能力点总和不能超过 66"
    : "";
}
export function faintedAlliesOf(build) {
  return Number.isInteger(build?.faintedAllies)
    ? Math.min(5, Math.max(0, build.faintedAllies))
    : 0;
}
export function needsFaintedAlliesInput(build) {
  return (
    build?.ability === "Supreme Overlord" ||
    build?.moves?.[build.selected] === "lastrespects"
  );
}
export function createBuild(catalog, species = "charizard") {
  const p = catalog.pokemon.find((p) => p.id === species) || catalog.pokemon[0];
  const preferred =
    p.id === "pikachu"
      ? ["thunderbolt", "voltswitch", "quickattack", "protect"]
      : p.types.includes("Fire")
        ? ["flamethrower", "heatwave", "airslash", "protect"]
        : p.types.includes("Ground")
          ? ["earthquake", "dragonclaw", "rockslide", "protect"]
          : ["moonblast", "icebeam", "surf", "protect"];
  const moves = [
    ...new Set([
      ...preferred.filter((x) => p.moves.includes(x)),
      ...p.moves.filter((x) => catalog.moves[x].category !== "Status"),
      ...p.moves,
    ]),
  ].slice(0, 4);
  while (moves.length < 4) moves.push("");
  return {
    id: uid(),
    name: p.zh,
    species: p.id,
    nature: "Serious",
    ability: p.abilities[0],
    item: p.requiredItem || "",
    points: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    boosts: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, evasion: 0 },
    moves,
    selected: 0,
    hp: 100,
    status: "",
    protected: false,
    present: true,
    active: true,
    crit: false,
    hits: 2,
    secondary: false,
    faintedAllies: 0,
    target: 0,
  };
}
export function defaultScene(catalog) {
  const a = createBuild(catalog),
    b = createBuild(catalog, "garchomp"),
    c = createBuild(catalog, "pikachu"),
    d = createBuild(catalog, "eevee");
  c.moves = ["", "", "", ""];
  d.moves = ["", "", "", ""];
  c.active = true;
  d.active = false;
  return {
    id: uid(),
    name: "未命名场景",
    mode: "single",
    openingRules: OPENING_RULES_VERSION,
    actors: [a, b, c, d],
    field: {
      weather: "",
      weatherMode: "auto",
      terrain: "",
      terrainMode: "auto",
      trickRoom: false,
      gravity: false,
      attacker: {},
      defender: {},
    },
    target: 2,
  };
}
export function resetBattleState(scene, catalog) {
  const persistent = ["id", "originId", "publicSource", "name", "species", "nature", "ability", "item", "points", "moves", "present"];
  return {
    ...scene,
    actors: scene.actors.map((old) => {
      const fresh = createBuild(catalog, old.species);
      for (const key of persistent) if (old[key] !== undefined) fresh[key] = clone(old[key]);
      return fresh;
    }),
    field: defaultScene(catalog).field,
    target: 2,
  };
}
export function activeIndices(scene) {
  return scene.mode === "double" ? [0, 1, 2, 3] : [0, 2];
}
export function hasSameDexPartner(scene, index, candidate, catalog) {
  if (scene.mode !== "double" || !candidate?.present) return false;
  const partnerIndex = index < 2 ? 1 - index : 5 - index;
  const partner = scene.actors[partnerIndex];
  if (!partner?.present) return false;
  const numberOf = (build) => catalog.pokemon.find((p) => p.id === build.species)?.num;
  const number = numberOf(candidate);
  return number !== undefined && number === numberOf(partner);
}
export function duplicateSpeciesIssues(scene, catalog) {
  if (scene.mode !== "double") return [];
  const issues = [];
  for (const [a, b, side] of [[0, 1, "我方"], [2, 3, "对方"]]) {
    if (!scene.actors[a].present || !scene.actors[b].present) continue;
    const pa = catalog.pokemon.find((p) => p.id === scene.actors[a].species);
    const pb = catalog.pokemon.find((p) => p.id === scene.actors[b].species);
    if (pa?.num !== undefined && pa.num === pb?.num)
      issues.push(`${side}不能同时使用图鉴编号相同的宝可梦`);
  }
  return issues;
}
// Keep the legacy field for backup compatibility, but selectable actors always act.
// Slot 4 remains the existing passive doubles slot used for spread/ally conditions.
export function withMandatoryActions(scene) {
  const next = clone(scene);
  next.actors.forEach((actor, index) => {
    actor.active = index !== 3 && (index !== 2 || !!actor.moves[actor.selected]);
  });
  return next;
}
export function validateBuild(b, catalog) {
  if (!b || typeof b !== "object") return ["配置格式错误"];
  const p = catalog.pokemon.find((p) => p.id === b.species),
    issues = [];
  if (!p) return ["宝可梦或形态不在当前数据包中"];
  const points = validatePoints(b.points);
  if (points) issues.push(points);
  if (!p.abilities.includes(b.ability))
    issues.push("特性不在该宝可梦当前特性列表中");
  if (!catalog.items.some((i) => i.name === b.item))
    issues.push("道具不在当前数据包中");
  if (p.requiredItem && b.item !== p.requiredItem)
    issues.push(`此形态需携带对应进化道具`);
  if (!catalog.natures.some((n) => n.name === b.nature))
    issues.push("性格失效");
  if (
    !Array.isArray(b.moves) ||
    b.moves.length !== 4 ||
    b.moves.some((m) => m && !p.moves.includes(m)) ||
    new Set(b.moves.filter(Boolean)).size !== b.moves.filter(Boolean).length
  )
    issues.push("招式不在该宝可梦当前招式池中");
  if (!Number.isInteger(b.selected) || b.selected < 0 || b.selected > 3)
    issues.push("选定招式无效");
  if (!Number.isFinite(b.hp) || b.hp < 0 || b.hp > 100)
    issues.push("剩余血量应为 0–100%");
  if (
    b.faintedAllies !== undefined &&
    (!Number.isInteger(b.faintedAllies) ||
      b.faintedAllies < 0 ||
      b.faintedAllies > 5)
  )
    issues.push("已倒下队友数量应为 0–5 的整数");
  if (
    !b.boosts ||
    STAT_KEYS.some(
      (k) =>
        !Number.isInteger(b.boosts[k]) || b.boosts[k] < -6 || b.boosts[k] > 6,
    )
  )
    issues.push("能力阶段应为 -6 至 +6");
  if (!["", "brn", "par", "psn", "tox", "slp", "frz"].includes(b.status))
    issues.push("异常状态无效");
  return issues;
}
