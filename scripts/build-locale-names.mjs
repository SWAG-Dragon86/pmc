// Refresh the bundled, offline display names from PokéAPI's public CSV data.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import catalog from '../src/data/catalog.json' with { type: 'json' };

const root = new URL('../output/locale-source/', import.meta.url);
const source = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const files = ['pokemon_species_names', 'moves', 'move_names', 'abilities', 'ability_names', 'items', 'item_names', 'natures', 'nature_names'];
function parseCsv(content) {
  const rows=[];let row=[],value='',quoted=false;
  for (let i=0;i<content.length;i++) {
    const char=content[i];
    if (char==='"') { if (quoted&&content[i+1]==='"') {value+='"';i++;} else quoted=!quoted; }
    else if (char===','&&!quoted) {row.push(value);value='';}
    else if ((char==='\n'||char==='\r')&&!quoted) {if(char==='\r'&&content[i+1]==='\n')i++;row.push(value);if(row.some(Boolean))rows.push(row);row=[];value='';}
    else value+=char;
  }
  if(value||row.length){row.push(value);rows.push(row);}
  const headers=rows.shift();return rows.map(cells=>Object.fromEntries(headers.map((key,index)=>[key,cells[index]||''])));
}
const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
await mkdir(root,{recursive:true});
const tables={};
for(const name of files){
  const file=new URL(`${name}.csv`,root);
  let csv;
  try {csv=await readFile(file,'utf8');}
  catch {const response=await fetch(`${source}${name}.csv`);if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);csv=await response.text();await writeFile(file,csv);}
  tables[name]=parseCsv(csv);
}
const langs={zhHant:'4',ja:'11',ko:'3'};
const result={source:'https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv',languages:{}};
function indexed(table,idKey){const map=new Map();for(const row of table){if(!Object.values(langs).includes(row.local_language_id))continue;const key=row[idKey];if(!map.has(key))map.set(key,{});map.get(key)[Object.keys(langs).find(lang=>langs[lang]===row.local_language_id)]=row.name;}return map;}
function names(kind,items){const singular={abilities:'ability',items:'item',natures:'nature'}[kind];const ids=new Map();for(const row of tables[kind]){const key=norm(row.identifier);if(!ids.has(key))ids.set(key,row.id);}const translated=indexed(tables[`${singular}_names`],`${singular}_id`);return Object.fromEntries(items.map(entry=>[entry.id,translated.get(ids.get(norm(entry.id==='leek'?'stick':entry.name||entry.id)))||{}]));}
const pokemonNames=indexed(tables.pokemon_species_names,'pokemon_species_id');
const suffix={zhHant:{mega:'超級',alola:'阿羅拉',galar:'伽勒爾',hisui:'洗翠',paldea:'帕底亞'},ja:{mega:'メガ',alola:'アローラ',galar:'ガラル',hisui:'ヒスイ',paldea:'パルデア'},ko:{mega:'메가',alola:'알로라',galar:'가라르',hisui:'히스이',paldea:'팔데아'}};
const formWords={zhHant:{combat:'鬥戰',blaze:'火熾',aqua:'水瀾',sunny:'晴天',rainy:'雨天',snowy:'雪天',heat:'加熱',wash:'清洗',frost:'結冰',fan:'旋轉',mow:'切割',female:'雌性',male:'雄性'},ja:{combat:'コンバット',blaze:'ブレイズ',aqua:'ウォーター',sunny:'たいよう',rainy:'あまみず',snowy:'ゆきぐも',heat:'ヒート',wash:'ウォッシュ',frost:'フロスト',fan:'スピン',mow:'カット',female:'メス',male:'オス'},ko:{combat:'컴뱃',blaze:'블레이즈',aqua:'아쿠아',sunny:'쾌청',rainy:'빗방울',snowy:'설운',heat:'히트',wash:'워시',frost:'프로스트',fan:'스핀',mow:'커트',female:'암컷',male:'수컷'}};
const pokemon={};
for(const entry of catalog.pokemon){const base=pokemonNames.get(String(entry.num))||{};pokemon[entry.id]={};for(const lang of Object.keys(langs)){
  let label=base[lang];if(!label)continue;
  if(entry.id!==entry.base){const form=entry.name.split('-').slice(1).join('-').toLowerCase(),parts=form.split('-');const region=Object.keys(suffix[lang]).find(key=>parts.includes(key));if(region){label=`${suffix[lang][region]}${label}`;const rest=parts.filter(part=>part!==region);if(rest.length)label+=rest.map(part=>part.length===1?part.toUpperCase():`（${formWords[lang][part]||part}）`).join('');}else if(form)label+=`（${parts.map(part=>formWords[lang][part]||part).join('・')}）`;}
  pokemon[entry.id][lang]=label;
}}
const moveIds=new Map(tables.moves.map(row=>[norm(row.identifier),row.id]));
const moveNames=indexed(tables.move_names,'move_id');
const moves=Object.fromEntries(Object.values(catalog.moves).map(entry=>[entry.id,moveNames.get(moveIds.get(norm(entry.name||entry.id)))||{}]));
const abilities=names('abilities',catalog.abilities),items=names('items',catalog.items),natures=names('natures',catalog.natures);
Object.assign(abilities['Aura Guard'],{zhHant:'氣場守護',ja:'オーラガード',ko:'오라 가드'});
Object.assign(abilities.Eelevate,{zhHant:'電鰻飄浮',ja:'イールフロート',ko:'전기뱀장어 부유'});
Object.assign(abilities['Fire Mane'],{zhHant:'火焰鬃毛',ja:'ほのおのたてがみ',ko:'불꽃 갈기'});
Object.assign(items[''],{zhHant:'不攜帶道具',ja:'持ち物なし',ko:'지닌 도구 없음'});
Object.assign(result,{pokemon,moves,abilities,items,natures});
await writeFile(new URL('../src/data/locale-names.json',import.meta.url),JSON.stringify(result));
for(const [kind,map] of Object.entries({pokemon,moves,abilities,items,natures}))console.log(kind,Object.keys(map).length,Object.fromEntries(Object.keys(langs).map(lang=>[lang,Object.values(map).filter(value=>value[lang]).length])));
