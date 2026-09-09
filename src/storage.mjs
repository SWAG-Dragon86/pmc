import { uid, clone, STAT_KEYS } from "./model.mjs";
import { saveBlob } from "./platform.mjs";
export const STORAGE_KEY = "pmc.workspace.v1";
export function exportPayload(builds, scenes) {
  return {
    format: "PMC",
    schema: 1,
    exportedAt: new Date().toISOString(),
    builds: clone(builds),
    scenes: clone(scenes),
  };
}
function safeObject(value) {
  if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw new Error("文件含不安全字段");
      safeObject(v);
    }
}
function shapeBuild(b) {
  return (
    b &&
    typeof b.id === "string" &&
    b.id.length <= 100 &&
    typeof b.name === "string" &&
    b.name.length <= 100 &&
    typeof b.species === "string" &&
    Array.isArray(b.moves) &&
    b.moves.length === 4 &&
    b.moves.every((m) => typeof m === "string") &&
    b.points &&
    typeof b.points === "object" &&
    !Array.isArray(b.points) &&
    STAT_KEYS.every(
      (k) => typeof b.points[k] === "number" && Number.isFinite(b.points[k]),
    ) &&
    b.boosts &&
    typeof b.boosts === "object" &&
    !Array.isArray(b.boosts) &&
    STAT_KEYS.every(
      (k) => typeof b.boosts[k] === "number" && Number.isFinite(b.boosts[k]),
    ) &&
    typeof b.nature === "string" &&
    typeof b.ability === "string" &&
    typeof b.item === "string" &&
    typeof b.hp === "number" &&
    typeof b.selected === "number" &&
    typeof b.status === "string" &&
    (b.faintedAllies === undefined ||
      (Number.isInteger(b.faintedAllies) &&
        b.faintedAllies >= 0 &&
        b.faintedAllies <= 5)) &&
    Number.isInteger(b.hits) &&
    b.hits >= 1 &&
    b.hits <= 10 &&
    [0, 1].includes(b.target) &&
    ["present", "active", "protected", "crit", "secondary"].every(
      (k) => typeof b[k] === "boolean",
    )
  );
}
export function parseImport(text) {
  if (text.length > 10 * 1024 * 1024) throw new Error("导入文件不能超过 10 MB");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("不是有效的 JSON 文件");
  }
  safeObject(data);
  if(!data||typeof data!=='object')throw new Error('不是支持的 PMC 备份版本');
  if(Array.isArray(data.scenes))for(const s of data.scenes) {
    if(!s||typeof s!=='object')throw new Error('场景字段不完整');
    if(s.field?.weatherMode!==undefined&&!['auto','manual'].includes(s.field.weatherMode))throw new Error('天气模式无效');
    for(const side of ['attacker','defender']){
      const f=s.field?.[side];if(!f)continue;
      if(f.spikes!==undefined&&(!Number.isInteger(f.spikes)||f.spikes<0||f.spikes>3))throw new Error('撒菱层数必须是 0 至 3');
      for(const k of ['isSR','stickyWeb','friendGuardOverride'])if(f[k]!==undefined&&typeof f[k]!=='boolean')throw new Error('场地开关格式无效');
    }
  }
  if (data.format !== "PMC" || data.schema !== 1)
    throw new Error("不是支持的 PMC 备份版本");
  if (
    !Array.isArray(data.builds) ||
    !Array.isArray(data.scenes) ||
    data.builds.length + data.scenes.length > 10000
  )
    throw new Error("备份记录格式或数量无效");
  if (!data.builds.every(shapeBuild)) throw new Error("宝可梦配置字段不完整");
  if (
    !data.scenes.every(
      (s) =>
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        s.name.length <= 100 &&
        Array.isArray(s.actors) &&
        s.actors.length === 4 &&
        s.actors.every(shapeBuild) &&
        new Set(s.actors.map((b) => b.id)).size === 4 &&
        [2, 3].includes(s.target) &&
        (s.mode === "double" || s.target === 2) &&
        ["single", "double", "compare"].includes(s.mode) &&
        s.field &&
        s.field.attacker &&
        s.field.defender &&
        typeof s.field.attacker === "object" &&
        typeof s.field.defender === "object",
    )
  )
    throw new Error("场景字段不完整");
  for (const build of data.builds) build.faintedAllies ??= 0;
  for (const scene of data.scenes)
    for (const build of scene.actors) build.faintedAllies ??= 0;
  return data;
}
export function mergeRecords(existing, incoming, policy = "ask") {
  const records = clone(existing),
    conflicts = [];
  let skipped = 0;
  for (const value of incoming) {
    const index = records.findIndex((x) => x.id === value.id);
    if (index < 0) {
      records.push(clone(value));
      continue;
    }
    if (canonical(records[index]) === canonical(value)) {
      skipped++;
      continue;
    }
    if (policy === "copy") records.push({ ...clone(value), id: uid() });
    else if (policy === "overwrite") records[index] = clone(value);
    else conflicts.push(value);
  }
  return { records, conflicts, skipped };
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function readWorkspace() {
  const text = localStorage.getItem(STORAGE_KEY);
  if (!text) return null;
  try {
    const d = JSON.parse(text);
    safeObject(d);
    const records = parseImport(
      JSON.stringify(exportPayload(d.builds || [], d.scenes || [])),
    );
    d.builds = records.builds;
    d.scenes = records.scenes;
    if (d.scene)
      d.scene = parseImport(JSON.stringify(exportPayload([], [d.scene]))).scenes[0];
    return d;
  } catch {
    throw new Error("本地记录无法读取，原始数据未删除。请先导出原始备份。");
  }
}
export function writeWorkspace(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return "";
  } catch {
    return "本地存储空间不足或被浏览器禁用，请立即导出备份。";
  }
}
export function downloadFile(content, name, type = "application/json") {
  return saveBlob(new Blob([content], { type }), name).catch((error) => {
    globalThis.alert?.(`导出失败：${error.message}`);
  });
}
