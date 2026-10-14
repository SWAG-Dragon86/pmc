import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import { createBuild, clone, validateBuild } from './model.mjs';
import { exportPayload, parseImport } from './storage.mjs';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const KINDS = { build: 'B', team: 'T', scene: 'S' };
const FIELDS = ['id', 'name', 'species', 'ability', 'item', 'nature', 'points', 'moves', 'selected'];

function checksum(bytes) {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
function base45(bytes) {
  let text = '';
  for (let index = 0; index < bytes.length; index += 2) {
    let value = bytes[index] * (index + 1 < bytes.length ? 256 : 1) + (bytes[index + 1] || 0);
    text += ALPHABET[value % 45]; value = Math.floor(value / 45);
    text += ALPHABET[value % 45];
    if (index + 1 < bytes.length) text += ALPHABET[Math.floor(value / 45)];
  }
  return text;
}
function unbase45(text) {
  if (text.length % 3 === 1) throw new Error('invalidCode');
  const bytes = [];
  for (let index = 0; index < text.length; index += 3) {
    const part = text.slice(index, index + 3), numbers = [...part].map(char => ALPHABET.indexOf(char));
    if (numbers.some(number => number < 0)) throw new Error('invalidCode');
    const value = numbers[0] + numbers[1] * 45 + (numbers[2] || 0) * 2025;
    if (value > (part.length === 3 ? 65535 : 255)) throw new Error('invalidCode');
    if (part.length === 3) bytes.push(value >> 8);
    bytes.push(value & 255);
  }
  return new Uint8Array(bytes);
}
function fixedBuild(build, catalog) {
  const issues = validateBuild(build, catalog);
  if (issues.length) throw new Error(issues.join('；'));
  return FIELDS.map(key => clone(build[key]));
}
function restoreBuild(values, catalog) {
  if (!Array.isArray(values) || values.length !== FIELDS.length || !catalog.pokemon.some(p => p.id === values[2]))
    throw new Error('invalidCode');
  const build = createBuild(catalog, values[2]);
  FIELDS.forEach((key, index) => { build[key] = values[index]; });
  return build;
}
function checkedPayload(kind, value, catalog) {
  const data = kind === 'build' ? exportPayload([value], []) :
    kind === 'team' ? exportPayload([], [], [value]) : exportPayload([], [value]);
  const parsed = parseImport(JSON.stringify(data));
  const builds = [...parsed.builds, ...parsed.teams.flatMap(team => team.members), ...parsed.scenes.flatMap(scene => scene.actors)];
  for (const build of builds) {
    const issues = validateBuild(build, catalog);
    if (issues.length) throw new Error(issues.join('；'));
  }
  return parsed;
}

export function encodeShare(kind, value, catalog) {
  if (!KINDS[kind]) throw new Error('invalidCode');
  checkedPayload(kind, value, catalog);
  const compact = kind === 'build' ? fixedBuild(value, catalog) : kind === 'team' ?
    [value.id, value.name, value.members.map(build => fixedBuild(build, catalog))] : clone(value);
  const bytes = strToU8(JSON.stringify(compact));
  const code = `PMC1:${KINDS[kind]}:${checksum(bytes)}:${base45(deflateSync(bytes, { level: 9 }))}:END`;
  if (code.length > 4000) throw new Error('tooLarge');
  return code;
}

export function decodeShare(input, catalog) {
  try {
    const text = String(input || '').trim();
    if (text.length > 4500) throw new Error('tooLarge');
    const match = text.match(/^PMC1:([BTS]):([0-9A-F]{8}):([\s\S]+):END$/);
    if (!match) throw new Error('invalidCode');
    // A fixed output buffer prevents a small compressed input from expanding without limit.
    const bytes = inflateSync(unbase45(match[3]), { out: new Uint8Array(65536) });
    if (checksum(bytes) !== match[2]) throw new Error('invalidCode');
    const compact = JSON.parse(strFromU8(bytes)), kind = Object.keys(KINDS).find(key => KINDS[key] === match[1]);
    let value;
    if (kind === 'build') value = restoreBuild(compact, catalog);
    else if (kind === 'team') {
      if (!Array.isArray(compact) || compact.length !== 3 || !Array.isArray(compact[2]) || compact[2].length !== 6)
        throw new Error('invalidCode');
      value = { id: compact[0], name: compact[1], members: compact[2].map(build => restoreBuild(build, catalog)) };
    } else value = compact;
    return { kind, value, data: checkedPayload(kind, value, catalog) };
  } catch (error) {
    throw new Error(error.message === 'tooLarge' ? 'tooLarge' : 'invalidCode');
  }
}
