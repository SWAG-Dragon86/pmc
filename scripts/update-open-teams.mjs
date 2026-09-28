import { readFileSync, writeFileSync } from "node:fs";
import { teamSaveability } from "../src/open-teams.mjs";

const SHEET_ID = "1axlwmzPA49rYkqXh7zHvAtSP-TKbM0ijGYBPRflLSWw";
const SHEET_NAME = "Champions M-C";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
const REPOSITORY_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/`;
const MUNCHSTATS_URL = "https://munchstats.com/teams/";
const OUTPUT_PATH = new URL("../src/data/open-teams.json", import.meta.url);
const CATALOG_PATH = new URL("../src/data/catalog.json", import.meta.url);
const OFFICIAL_LIMIT = Number(process.env.PMC_OFFICIAL_TEAM_LIMIT || 32);
const COMMUNITY_LIMIT = Number(process.env.PMC_COMMUNITY_TEAM_LIMIT || 96);
const CONCURRENCY = 12;
const STAT_KEYS = { hp: "hp", atk: "atk", def: "def", spa: "spa", spd: "spd", spe: "spe" };

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
const current = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
const toId = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseDate(value) {
  const match = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return String(value).trim();
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const month = months[match[2].slice(0, 3).toLowerCase()];
  return month ? `${match[3]}-${String(month).padStart(2,"0")}-${match[1].padStart(2,"0")}` : String(value).trim();
}

function clean(value) {
  value = String(value || "").trim();
  return value === "-" || value === "None" ? "" : value;
}

function parseRepositoryRow(row) {
  if (row.length < 43 || !clean(row[0])) return null;
  const pokemon = [37,38,39,40,41,42].map(index => clean(row[index])).filter(Boolean);
  if (pokemon.length !== 6) return null;
  return {
    teamId: clean(row[0]), description: clean(row[1]), player: clean(row[3]),
    items: [7,10,13,16,19,22].map(index => clean(row[index])),
    pokepaste: clean(row[24]), hasPoints: clean(row[25]).toLowerCase() === "yes",
    rentalCode: clean(row[28]), date: parseDate(row[29]), event: clean(row[30]),
    rank: clean(row[31]), sourceUrl: clean(row[32]), reportUrl: clean(row[33]),
    owner: clean(row[35]), pokemon,
  };
}

function isOfficialEvent(row) {
  return /(worlds?|world championship|international championship|regional championship|special championship|japan championships|pjcs)/i.test(`${row.event} ${row.description}`);
}

function exactCatalogValue(list, value, label) {
  const found = list.find(entry => toId(entry.name) === toId(value));
  if (!found) throw new Error(`${label}不在当前游戏目录：${value}`);
  return found.name;
}

function resolvePokemon(headerName, item, rosterName) {
  const mega = catalog.pokemon.find(pokemon => pokemon.requiredItem && toId(pokemon.requiredItem) === toId(item));
  if (mega) return mega;
  // Poképaste 的排列顺序可能和资料表中的六只顺序不同，标题才是当前配置的准确信息。
  const candidates = [headerName, rosterName]
    .map(name => toId(name).replace(/male$|female$/, ""))
    .filter(Boolean);
  const aliases = { floetteeternalmega: "floettemega", basculegionmale: "basculegion", basculegionfemale: "basculegionf" };
  for (let candidate of candidates) {
    candidate = aliases[candidate] || candidate;
    const found = catalog.pokemon.find(pokemon => pokemon.id === candidate || toId(pokemon.name) === candidate);
    if (found) return found;
  }
  throw new Error(`宝可梦不在当前游戏目录：${rosterName || headerName}`);
}

function parsePoints(line) {
  const points = { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 };
  for (const part of line.replace(/^EVs:\s*/i, "").split("/")) {
    const match = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
    if (!match) continue;
    const key = STAT_KEYS[match[2].toLowerCase()];
    if (key) points[key] = Number(match[1]);
  }
  if (Object.values(points).reduce((sum, value) => sum + value, 0) !== 66) throw new Error("能力点合计不是66");
  if (Object.values(points).some(value => value > 32)) throw new Error("单项能力点超过32");
  return points;
}

function parsePaste(text, row) {
  const blocks = text.trim().split(/\r?\n\s*\r?\n/).filter(Boolean);
  if (blocks.length !== 6) throw new Error(`Poképaste 不是六只（${blocks.length}）`);
  return blocks.map((block, index) => {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const header = lines[0].match(/^(.+?)(?:\s+\([MF]\))?\s+@\s+(.+)$/);
    if (!header) throw new Error(`无法识别配置标题：${lines[0]}`);
    const item = exactCatalogValue(catalog.items, header[2], "道具");
    const pokemon = resolvePokemon(header[1], item, row.pokemon[index]);
    const abilityLine = lines.find(line => /^Ability:/i.test(line));
    const natureLine = lines.find(line => / Nature$/i.test(line));
    const pointsLine = lines.find(line => /^EVs:/i.test(line));
    if (!abilityLine || !natureLine || !pointsLine) throw new Error("配置缺少特性、性格或能力点");
    const pastedAbility = abilityLine.replace(/^Ability:\s*/i, "");
    const ability = pokemon.mega ? pokemon.abilities[0] : exactCatalogValue(catalog.abilities, pastedAbility, "特性");
    if (!pokemon.abilities.includes(ability)) throw new Error(`${pokemon.name}不能使用特性${ability}`);
    const nature = exactCatalogValue(catalog.natures, natureLine.replace(/ Nature$/i, ""), "性格");
    const moves = lines.filter(line => line.startsWith("- ")).map(line => toId(line.slice(2)));
    if (moves.length !== 4 || moves.some(move => !catalog.moves[move])) throw new Error(`${pokemon.name}的招式不完整或不在目录中`);
    return { species:pokemon.id, item, ability, nature, points:parsePoints(pointsLine), moves };
  });
}

async function fetchText(url) {
  const response = await fetch(url, { headers:{ "User-Agent":"PMC Calculator data snapshot" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function mapConcurrent(rows, worker) {
  const result = [];
  let cursor = 0;
  async function run() {
    while (cursor < rows.length) {
      const index = cursor++;
      result[index] = await worker(rows[index]);
    }
  }
  await Promise.all(Array.from({ length:Math.min(CONCURRENCY, rows.length) }, run));
  return result;
}

function toTeam(row, members) {
  const player = row.player || row.owner || "未署名玩家";
  return {
    id:`vgcpastes-${row.teamId.toLowerCase()}`, managedBy:"vgcpastes-snapshot",
    section:isOfficialEvent(row) ? "official" : "community",
    player, handle:row.owner && row.owner !== player ? row.owner : "",
    event:row.event || row.description || "公开队伍",
    date:row.date || "2026-01-01", placing:row.rank || "未公开", record:"未公开", format:"M-C",
    rentalCode:row.rentalCode, sourceLabel:"VGCPastes 公开队伍库",
    sourceUrl:row.sourceUrl || row.pokepaste || REPOSITORY_URL,
    pasteUrl:row.pokepaste, reportUrl:row.reportUrl, description:row.description,
    members,
  };
}

const csv = await fetchText(SHEET_URL);
const rows = parseCsv(csv).slice(3).map(parseRepositoryRow).filter(Boolean)
  .filter(row => row.hasPoints && /^https:\/\/pokepast\.es\//i.test(row.pokepaste))
  .sort((a,b) => b.date.localeCompare(a.date));
const officialCandidates = rows.filter(isOfficialEvent).slice(0, Math.max(OFFICIAL_LIMIT * 3, 80));
const communityCandidates = rows.filter(row => !isOfficialEvent(row)).slice(0, Math.max(COMMUNITY_LIMIT * 3, 240));
const failures = [];

async function hydrate(row) {
  try {
    const rawUrl = `${row.pokepaste.replace(/\/$/, "")}/raw`;
    const members = parsePaste(await fetchText(rawUrl), row);
    const team = toTeam(row, members);
    const status = teamSaveability(team, catalog);
    if (!status.saveable) throw new Error(status.reason);
    return team;
  } catch (error) {
    failures.push(`${row.teamId}: ${error.message}`);
    return null;
  }
}

const [officialHydrated, communityHydrated] = await Promise.all([
  mapConcurrent(officialCandidates, hydrate), mapConcurrent(communityCandidates, hydrate),
]);
const generated = [
  ...officialHydrated.filter(Boolean).slice(0, OFFICIAL_LIMIT),
  ...communityHydrated.filter(Boolean).slice(0, COMMUNITY_LIMIT),
];
if (!generated.length) throw new Error("M-C 公开队伍源没有返回可用的完整阵容；保留上次已发布的数据");
const existing = current.teams.filter(team => !generated.some(fresh => fresh.id === team.id));
const existingCodes = new Set(existing.map(team => team.rentalCode).filter(Boolean));
const teams = [...generated.filter(team => !team.rentalCode || !existingCodes.has(team.rentalCode)), ...existing]
  .sort((a,b) => b.date.localeCompare(a.date));

const output = {
  meta: {
    updatedAt:new Date().toISOString().slice(0,10),
    policy:"只内置可追溯且能通过当前《宝可梦冠军》目录校验的阵容；完整66点配置可保存和载入。",
    snapshot:{ repository:SHEET_NAME, totalRows:rows.length, embeddedTeams:teams.length, generatedTeams:generated.length },
    sources:[
      { name:"MunchStats", url:MUNCHSTATS_URL, role:"赛事、使用率与队伍检索入口" },
      { name:"VGCPastes Repository", url:REPOSITORY_URL, role:"公开六人阵容、Poképaste 与租借码" },
      { name:"Limitless VGC", url:"https://limitlessvgc.com/", role:"线上赛事、名次与公开队表" },
      { name:"RK9.gg", url:"https://rk9.gg/", role:"官方赛事配对、名单与成绩" },
      { name:"Champions Companion", url:"https://championscompanion.app/team-codes/", role:"社区租借码交叉核对" },
    ],
  },
  teams,
};
writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`OPEN_TEAMS_UPDATED official=${teams.filter(team=>team.section==="official").length} community=${teams.filter(team=>team.section==="community").length} total=${teams.length}`);
console.log(`CANDIDATES=${rows.length} FAILURES=${failures.length}`);
if (failures.length) console.log(failures.slice(0, 20).join("\n"));
