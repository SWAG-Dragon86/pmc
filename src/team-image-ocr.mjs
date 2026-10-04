import { createWorker, PSM } from 'tesseract.js';
import {
  IMAGE_LANGUAGES, POINT_KEYS, SCREENSHOT_HEIGHT, SCREENSHOT_WIDTH,
  TEAM_CARD_ORIGINS, chooseOcrEntry, chooseOcrEntryInBlock, localizedImageName,
  normalizedOcr, natureFromArrows,
} from './team-image-import.mjs';

const LANG_CODE = Object.fromEntries(IMAGE_LANGUAGES);
const FIELD_ROWS = [57, 101, 145];
const GENDER_FORM_PAIRS = [
  ['indeedee', 'indeedeef'], ['meowstic', 'meowsticf'],
  ['meowsticmmega', 'meowsticfmega'],
];

function crop(source, x, y, width, height, threshold = null) {
  const result = document.createElement('canvas');
  const scale = threshold === null ? 1 : 3;
  result.width = width * scale;
  result.height = height * scale;
  const context = result.getContext('2d', { willReadFrequently: true });
  if (threshold === null) {
    context.drawImage(source, x, y, width, height, 0, 0, width, height);
  } else {
    const pixels = source.getContext('2d').getImageData(x, y, width, height);
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      const light = (pixels.data[offset] * 299 + pixels.data[offset + 1] * 587 + pixels.data[offset + 2] * 114) / 1000;
      const value = light >= threshold ? 0 : 255;
      pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = value;
      pixels.data[offset + 3] = 255;
    }
    const small = document.createElement('canvas');
    small.width = width; small.height = height;
    small.getContext('2d').putImageData(pixels, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(small, 0, 0, result.width, result.height);
  }
  return result;
}

function locateSelector(context) {
  const greenRows = x => {
    const rows = [];
    for (let y = 140; y < 340; y++) {
      const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
      if (green - blue > 55 && green - red > 15) rows.push(y);
    }
    return rows.length >= 30 ? rows : [];
  };
  // Sample away from the tab labels: their dark outlines made a single pixel unreliable.
  const ability = greenRows(950), status = greenRows(1400);
  if (Boolean(ability.length) === Boolean(status.length)) return null;
  return ability.length ? { kind: 'ability', top: ability[0] } : { kind: 'status', top: status[0] };
}

function arrowAt(context, x, y) {
  const pixels = context.getImageData(x, y, 38, 33).data;
  let red = 0, cyan = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
    if (r > 170 && r - g > 20 && r - b > 20) red++;
    if (b - r > 25 && g - r > 20 && g > 170) cyan++;
  }
  return red > 40 ? 'up' : cyan > 40 ? 'down' : null;
}

function arrowsForCard(context, x, y) {
  const directions = {};
  for (const [side, left, keys] of [
    ['left', 145, ['hp', 'atk', 'def']],
    ['right', 545, ['spa', 'spd', 'spe']],
  ]) {
    keys.forEach((key, row) => {
      directions[key] = arrowAt(context, x + left, y + 62 + row * 44);
    });
  }
  return {
    plus: POINT_KEYS.find(key => directions[key] === 'up') || null,
    minus: POINT_KEYS.find(key => directions[key] === 'down') || null,
  };
}

function genderForCard(context, x, y) {
  // The badge sits between the name and type icons on every team card.
  const pixels = context.getImageData(x + 345, y + 5, 45, 55).data;
  let female = 0, male = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const red = pixels[offset], green = pixels[offset + 1], blue = pixels[offset + 2];
    if (red > 150 && red > green * 1.5 && red > blue * 1.4) female++;
    if (red < 100 && green < 180 && blue > 175 && blue > red * 1.6) male++;
  }
  if (female > 150) return 'female';
  if (male > 400) return 'male';
  return null;
}

function genderedNameMatch(text, catalog, language, gender) {
  if (!gender) return null;
  const aliases = GENDER_FORM_PAIRS.map(([male, female]) => {
    const first = catalog.pokemon.find(entry => entry.id === male);
    const second = catalog.pokemon.find(entry => entry.id === female);
    if (!first || !second) return null;
    const a = normalizedOcr(localizedImageName('pokemon', first, language));
    const b = normalizedOcr(localizedImageName('pokemon', second, language));
    let length = 0;
    while (length < a.length && length < b.length && a[length] === b[length]) length++;
    return length >= 3 ? { id: gender === 'female' ? female : male, name: a.slice(0, length) } : null;
  }).filter(Boolean);
  return chooseOcrEntry(text, aliases, 'pokemon', 'en', 0.63);
}

function parsePoint(value) {
  const text = String(value || '').trim();
  if (!/^\d{1,2}$/.test(text)) return null;
  const point = Number(text);
  return point <= 32 ? point : null;
}

async function recognizeLine(worker, source, rectangle, threshold = null) {
  const { data } = await worker.recognize(crop(source, ...rectangle, threshold));
  return data.text.trim();
}

async function recognizeEntry(worker, source, rectangle, entries, kind, language, minimum = 0.6) {
  const candidates = [];
  for (const threshold of [null, 195, 180]) {
    const reading = await recognizeLine(worker, source, rectangle, threshold);
    const choice = chooseOcrEntry(reading, entries, kind, language, minimum);
    if (choice) candidates.push(choice);
    if (choice?.score === 1) break;
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 1 && candidates[0].entry !== candidates[1].entry && candidates[0].score - candidates[1].score < 0.08) return null;
  return candidates[0]?.entry || null;
}

async function newWorker(language) {
  const root = new URL('ocr/', document.baseURI).href;
  const worker = await createWorker(LANG_CODE[language], 1, {
    workerPath: `${root}worker.min.js`, corePath: root, langPath: root.slice(0, -1), gzip: true,
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  return worker;
}

async function readNames(worker, source, catalog, language, kind) {
  const members = [];
  const context = source.getContext('2d', { willReadFrequently: true });
  for (const [x, y] of TEAM_CARD_ORIGINS) {
    const gender = genderForCard(context, x, y);
    const candidates = [];
    const readings = [];
    for (const width of [260, 330]) {
      for (const threshold of [null, 195, 180]) {
        const text = await recognizeLine(worker, source, [x + 80, y + 4, width, 55], threshold);
        if (text) readings.push(text);
        const ordinary = chooseOcrEntry(text, catalog.pokemon, 'pokemon', language, 0.63);
        const gendered = genderedNameMatch(text, catalog, language, gender);
        const match = gendered && (!ordinary || gendered.score > ordinary.score + 0.08) ?
          { ...gendered, entry: catalog.pokemon.find(entry => entry.id === gendered.entry.id) } : ordinary;
        if (match) candidates.push({ ...match, text });
        if (match?.score === 1) break;
      }
      if (candidates.some(candidate => candidate.score >= 0.9)) break;
    }
    candidates.sort((a, b) => b.score - a.score);
    const match = candidates[0];
    const ambiguous = candidates[1] && match.entry !== candidates[1].entry && match.score - candidates[1].score < 0.08;
    let species = ambiguous ? null : match?.entry.id || null;
    let inferredFromAbility = false;
    if (!species && kind === 'ability') {
      // A team card may show a nickname instead of the species name.
      const abilityRectangle = [x + 80, y + 52, 310, 45];
      for (const threshold of [null, 195, 180]) {
        const text = await recognizeLine(worker, source, abilityRectangle, threshold);
        const ability = chooseOcrEntry(text, catalog.abilities, 'abilities', language, 0.85);
        if (!ability) continue;
        const possible = catalog.pokemon.filter(pokemon => pokemon.abilities.includes(ability.entry.name));
        if (possible.length === 1) {
          species = possible[0].id;
          inferredFromAbility = true;
          break;
        }
        const narrowed = readings.map(reading => chooseOcrEntry(reading, possible, 'pokemon', language, 0.63))
          .filter(Boolean).sort((a, b) => b.score - a.score);
        if (narrowed[0]) {
          species = narrowed[0].entry.id;
          inferredFromAbility = true;
          break;
        }
      }
    }
    const pair = GENDER_FORM_PAIRS.find(forms => forms.includes(species));
    if (pair) species = gender === 'female' ? pair[1] : gender === 'male' ? pair[0] : null;
    members.push({ species, rawName: match?.text || '', score: ambiguous ? 0 : match?.score || 0, inferredFromAbility });
  }
  return members;
}

async function readPoint(worker, source, rectangle) {
  const readings = [];
  for (const threshold of [null, 195, 180]) {
    const value = parsePoint(await recognizeLine(worker, source, rectangle, threshold));
    if (value !== null) readings.push(value);
  }
  if (!readings.length) return null;
  const counts = new Map();
  for (const value of readings) counts.set(value, (counts.get(value) || 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  return sorted[0][1] >= 2 && (sorted.length === 1 || sorted[0][1] > sorted[1][1]) ? sorted[0][0] : null;
}

export async function scanTeamImage(file, catalog, { forcedKind = null, preferredLanguage = 'zhHans', onProgress = () => {} } = {}) {
  if (!file?.type.startsWith('image/')) throw new Error('请选择 PNG、JPG 或其他常见图片格式');
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = bitmap.width / bitmap.height;
    if (ratio < 1.7 || ratio > 2.35)
      throw new Error('截图比例与游戏六人队伍界面不符；请使用完整游戏截图');
    const source = document.createElement('canvas');
    source.width = SCREENSHOT_WIDTH; source.height = SCREENSHOT_HEIGHT;
    const context = source.getContext('2d', { willReadFrequently: true });
    const scale = Math.min(source.width / bitmap.width, source.height / bitmap.height);
    const width = bitmap.width * scale, height = bitmap.height * scale;
    context.drawImage(bitmap, (source.width - width) / 2, (source.height - height) / 2, width, height);
    const selector = locateSelector(context);
    const kind = forcedKind || selector?.kind;
    if (!kind) throw new Error('无法确定这张图是“能力”还是“状态”页；请手动指定类型后重试');
    const aligned = document.createElement('canvas');
    aligned.width = source.width; aligned.height = source.height;
    const alignedContext = aligned.getContext('2d', { willReadFrequently: true });
    alignedContext.drawImage(source, 0, selector ? 182 - selector.top : 0);
    const languages = [preferredLanguage, ...IMAGE_LANGUAGES.map(([language]) => language)].filter((language, index, all) => all.indexOf(language) === index && LANG_CODE[language]);
    let worker = null, language = null, members = null;
    for (const candidate of languages) {
      onProgress(`正在识别六只宝可梦：${candidate}`);
      const current = await newWorker(candidate);
      try {
        const found = await readNames(current, aligned, catalog, candidate, kind);
        if (found.every(member => member.species) && new Set(found.map(member => member.species)).size === 6) {
          worker = current; language = candidate; members = found; break;
        }
      } finally { if (current !== worker) await current.terminate(); }
    }
    if (!worker) throw new Error('无法可靠识别完整六人队伍；当前队伍未被覆盖');
    try {
      if (kind === 'ability') {
        for (let index = 0; index < 6; index++) {
          onProgress(`正在读取第 ${index + 1} 只的招式、特性和道具`);
          const [x, y] = TEAM_CARD_ORIGINS[index];
          const pokemon = catalog.pokemon.find(entry => entry.id === members[index].species);
          const abilities = catalog.abilities.filter(entry => pokemon.abilities.includes(entry.name));
          const moves = pokemon.moves.map(id => catalog.moves[id]);
          const ability = await recognizeEntry(worker, aligned, [x + 80, y + 52, 310, 45], abilities, 'abilities', language, 0.55);
          let item = await recognizeEntry(worker, aligned, [x + 80, y + 95, 310, 46], catalog.items, 'items', language, 0.62);
          if (!item) {
            await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
            try {
              const reading=await recognizeLine(worker,aligned,[x+31,y+12,350,175],180);
              item=chooseOcrEntryInBlock(reading,catalog.items,'items',language)?.entry||null;
            } finally { await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE }); }
          }
          members[index].ability = ability?.name || null;
          members[index].item = item?.name ?? null;
          members[index].moves = [];
          for (let move = 0; move < 4; move++) {
            const found = await recognizeEntry(worker, aligned, [x + 540, y + 6 + move * 50, 280, 43], moves, 'moves', language, 0.55);
            members[index].moves.push(found?.id || null);
          }
        }
      } else {
        const numeric = language === 'en' ? worker : await newWorker('en');
        try {
          await numeric.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789' });
          for (let index = 0; index < 6; index++) {
            onProgress(`正在读取第 ${index + 1} 只的性格和能力点`);
            const [x, y] = TEAM_CARD_ORIGINS[index];
            const arrows = arrowsForCard(alignedContext, x, y);
            members[index].nature = natureFromArrows(arrows.plus, arrows.minus, catalog);
            members[index].points = {};
            for (const [column, offset, keys] of [[0, 326, POINT_KEYS.slice(0, 3)], [1, 711, POINT_KEYS.slice(3)]]) {
              for (let row = 0; row < 3; row++)
                members[index].points[keys[row]] = await readPoint(numeric, aligned, [x + offset, y + FIELD_ROWS[row], 110, 42]);
            }
          }
        } finally { if (numeric !== worker) await numeric.terminate(); }
      }
      return { kind, language, members, fileName: file.name };
    } finally { await worker.terminate(); }
  } finally { bitmap.close?.(); }
}
