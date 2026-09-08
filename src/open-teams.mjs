import { clone, createBuild, uid, validateBuild } from "./model.mjs";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function publicMemberBuild(team, memberIndex, catalog) {
  const member = team.members[memberIndex];
  if (!member?.points) throw new Error("这份公开阵容没有完整能力点，暂时不能载入计算器");
  const pokemon = catalog.pokemon.find((p) => p.id === member.species);
  if (!pokemon) throw new Error("该宝可梦不在当前版本数据中");
  const build = {
    ...createBuild(catalog, member.species),
    id: uid(),
    name: `${pokemon.zh} · ${team.player}`,
    nature: member.nature,
    ability: member.ability,
    item: member.item,
    points: clone(member.points),
    moves: clone(member.moves),
    publicSource: {
      teamId: team.id,
      memberIndex,
      label: `${team.event} · ${team.player}`,
    },
  };
  const issues = validateBuild(build, catalog);
  if (issues.length) throw new Error(issues[0]);
  return build;
}

export function publicBuildFingerprint(build) {
  const copy = clone(build);
  delete copy.id;
  delete copy.originId;
  return canonical(copy);
}

export function teamSaveability(team, catalog) {
  if (team.members.length !== 6) return { saveable: false, reason: "阵容不是完整六只" };
  try {
    team.members.forEach((_, index) => publicMemberBuild(team, index, catalog));
    return { saveable: true, reason: "" };
  } catch (error) {
    return { saveable: false, reason: team.limitation || error.message };
  }
}

export function savePublicMembers(existing, team, memberIndices, catalog) {
  const records = clone(existing);
  let added = 0, skipped = 0;
  for (const index of memberIndices) {
    const build = publicMemberBuild(team, index, catalog);
    const fingerprint = publicBuildFingerprint(build);
    if (records.some((record) => publicBuildFingerprint(record) === fingerprint)) skipped++;
    else { records.push(build); added++; }
  }
  return { records, added, skipped };
}
