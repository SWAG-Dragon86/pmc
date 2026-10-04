import { createBuild, validateBuild } from './model.mjs';
import { localizedName } from './localization.mjs';

export const IMAGE_LANGUAGES = [
  ['zhHans', 'chi_sim'], ['zhHant', 'chi_tra'], ['ja', 'jpn'], ['ko', 'kor'], ['en', 'eng'],
];
export const TEAM_CARD_ORIGINS = [
  [449, 263], [1337, 263], [449, 505], [1337, 505], [449, 749], [1337, 749],
];
export const SCREENSHOT_WIDTH = 2622;
export const SCREENSHOT_HEIGHT = 1206;
export const POINT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export function normalizedOcr(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}\d_]/gu, '');
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + Number(a[i - 1] !== b[j - 1]));
      diagonal = old;
    }
  }
  return row[b.length];
}

export function localizedImageName(kind, entry, language) {
  if (!entry) return '';
  if (language === 'zhHans') return entry.zh || entry.name || '';
  if (language === 'en') return entry.name || '';
  const id = entry.id || entry.name;
  return localizedName(kind, id, language) || entry.zh || entry.name || '';
}

export function chooseOcrEntry(text, options, kind, language, minimum = 0.6) {
  const raw = normalizedOcr(text);
  if (!raw) return null;
  const scored = options.map(entry => {
    const candidate = normalizedOcr(localizedImageName(kind, entry, language));
    if (!candidate) return { entry, score: 0 };
    const score = raw.includes(candidate) ? 1 : 1 - distance(raw, candidate) / Math.max(raw.length, candidate.length);
    return { entry, score };
  }).sort((a, b) => b.score - a.score);
  if (!scored[0] || scored[0].score < minimum) return null;
  if (scored[1] && scored[0].score - scored[1].score < 0.08) return null;
  return scored[0];
}

export function chooseOcrEntryInBlock(text, options, kind, language, minimum = 0.66) {
  const lines=String(text||'').split(/\r?\n/).map(normalizedOcr).filter(Boolean);
  if (!lines.length) return null;
  const scored=options.map(entry=>{
    const candidate=normalizedOcr(localizedImageName(kind,entry,language));
    if (!candidate || candidate.length < 3) return {entry,score:0};
    let score=0;
    for (const line of lines) {
      const lengths=[candidate.length-1,candidate.length,candidate.length+1].filter(length=>length>0);
      for (const length of lengths) for(let start=0;start<=Math.max(0,line.length-length);start++){
        const window=line.slice(start,start+length);
        score=Math.max(score,1-distance(window,candidate)/Math.max(window.length,candidate.length));
      }
    }
    return {entry,score};
  }).sort((a,b)=>b.score-a.score);
  if (!scored[0] || scored[0].score<minimum) return null;
  if(scored[1]&&scored[0].score-scored[1].score<0.08)return null;
  return scored[0];
}

export function natureFromArrows(plus, minus, catalog) {
  if (!plus && !minus) return 'Serious';
  if (!plus || !minus || plus === minus) return null;
  return catalog.natures.find(nature => nature.plus === plus && nature.minus === minus)?.name || null;
}

export function mergeTeamScreenshots(scans, catalog) {
  if (scans.length < 1 || scans.length > 2) throw new Error('请导入一张或两张队伍截图');
  const kinds = scans.map(scan => scan.kind);
  if (kinds.some(kind => !['ability', 'status'].includes(kind))) throw new Error('请先确认每张截图属于“能力”或“状态”页');
  if (new Set(kinds).size !== kinds.length) throw new Error('两张截图必须分别是“能力”和“状态”页');
  for (const scan of scans) {
    if (scan.members?.length !== 6 || scan.members.some(member => !member.species))
      throw new Error('截图中无法确认完整的六只宝可梦；当前队伍未被覆盖');
    if (new Set(scan.members.map(member => member.species)).size !== 6)
      throw new Error('截图含有重复或无法区分的宝可梦；当前队伍未被覆盖');
  }
  if (scans.length === 2) {
    const first = scans[0].members.map(member => member.species).sort().join('|');
    const second = scans[1].members.map(member => member.species).sort().join('|');
    if (first !== second) throw new Error('两张截图不是完全相同的六人队伍；当前队伍未被覆盖');
  }
  const ordered = scans[0].members.map(member => member.species);
  const byKind = Object.fromEntries(scans.map(scan => [scan.kind, new Map(scan.members.map(member => [member.species, member]))]));
  return ordered.map(species => {
    const build = createBuild(catalog, species);
    const review = [];
    const ability = byKind.ability?.get(species);
    if (ability) {
      if (ability.inferredFromAbility) review.push('species');
      build.ability = ability.ability || '';
      build.item = ability.item ?? '';
      build.moves = Array.from({ length: 4 }, (_, index) => ability.moves?.[index] || '');
      if (!ability.ability) review.push('ability');
      if (ability.item == null) review.push('item');
      build.moves.forEach((move, index) => { if (!move) review.push(`move${index}`); });
    }
    const status = byKind.status?.get(species);
    if (status) {
      build.nature = status.nature || 'Serious';
      if (!status.nature) review.push('nature');
      for (const key of POINT_KEYS) {
        const value = status.points?.[key];
        build.points[key] = Number.isInteger(value) && value >= 0 && value <= 32 ? value : 0;
        if (value === null || value === undefined || value < 0 || value > 32) review.push(key);
      }
      if (POINT_KEYS.reduce((sum, key) => sum + build.points[key], 0) !== 66) review.push('pointsTotal');
    }
    return { build, review, issues: validateBuild(build, catalog) };
  });
}
