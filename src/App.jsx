import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Swords,
  Library,
  Layers,
  Settings,
  Plus,
  Download,
  Upload,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Save,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Shield,
  Target,
  ArrowRight,
  Info,
  Check,
  Image as ImageIcon,
  RefreshCw,
  CloudOff,
  Wifi,
  ArrowUpRight,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Globe2,
} from "lucide-react";
import { pinyin } from "pinyin-pro";
import catalog from "./data/catalog.json";
import spriteInfo from "./data/sprites.json";
import rosterAudit from "./data/roster-audit.json";
import mcManifest from "./data/mc-manifest.json";
import openTeams from "./data/open-teams.json";
import { validateTeamFeed, TEAM_FEED_STORAGE_KEY } from "./team-feed.mjs";
import {
  createBuild,
  defaultScene,
  withMandatoryActions,
  resetBattleState,
  validateBuild,
  validatePoints,
  STAT_KEYS,
  STAT_NAMES,
  hasSameDexPartner,
  TYPES,
  uid,
  clone,
  needsFaintedAlliesInput,
} from "./model.mjs";
import { statsOf, previewDamage, speedOf } from "./engine.mjs";
import { natureOptions } from './natures.mjs';
import { WEATHER_NAMES, TERRAIN_NAMES, openingBranches, OPENING_RULES, hasFriendGuard } from './opening.mjs';
import {
  readWorkspace,
  writeWorkspace,
  parseImport,
  mergeRecords,
  exportPayload,
  downloadFile,
  STORAGE_KEY,
} from "./storage.mjs";
import { getBackground, setBackground } from "./background.mjs";
import { exportResultImage } from "./share.mjs";
import { isAndroidApp } from "./platform.mjs";
import { publicMemberBuild, savePublicMembers, teamSaveability } from "./open-teams.mjs";
import { analyzeTeam } from "./team-analysis.mjs";
import { LANGUAGES, LANGUAGE_KEY, localizeDom, localizedName, prepareLanguage } from "./localization.mjs";
import { initialLanguage } from "./language-preference.mjs";

const pct = (n) => `${Math.max(0, n || 0).toFixed(1)}%`;
const APP_VERSION = "1.3.0";
const range = (r) => `${pct(r.min)} – ${pct(r.max)}`;
const TYPES_COLOR = {
  Fire: "#ce5841",
  Water: "#4b88cb",
  Electric: "#b38c18",
  Grass: "#548960",
  Ice: "#4d929f",
  Fighting: "#b6673c",
  Poison: "#97619e",
  Ground: "#af814f",
  Flying: "#788cb5",
  Psychic: "#c76487",
  Bug: "#839343",
  Rock: "#9b9167",
  Ghost: "#766c9c",
  Dragon: "#6f72bb",
  Dark: "#65596c",
  Steel: "#748c99",
  Fairy: "#bc79a5",
  Normal: "#8a8c84",
};
const pMap = Object.fromEntries(catalog.pokemon.map((p) => [p.id, p]));
const AliasContext = createContext({});
function readAliases() {
  try {
    const raw=JSON.parse(localStorage.getItem('pmc.aliases.v1')||'{}'),valid={};
    for(const [id,values] of Object.entries(raw||{}))if((pMap[id]||catalog.moves[id])&&Array.isArray(values))valid[id]=values.filter(value=>typeof value==='string'&&value.length<=32).slice(0,12);
    return valid;
  } catch { return {}; }
}
const searchCache = new Map();
function matches(option, query, aliases = {}) {
  const q = query.toLowerCase().replace(/[\s'-]/g, "");
  if (!q) return true;
  const key = `${option.id}:${option.zh}`;
  if (!searchCache.has(key)) {
    const zh = option.zh || option.name;
    searchCache.set(
      key,
      [
        zh,
        option.name || "",
        option.id,
        ...['zhHant','ja','ko'].flatMap(language=>[localizedName('pokemon',option.id,language)||localizedName('moves',option.id,language)||'']),
        pinyin(zh, { toneType: "none" }),
        pinyin(zh, { pattern: "first", toneType: "none" }),
      ]
        .join("|")
        .toLowerCase()
        .replace(/[\s'-]/g, ""),
    );
  }
  return searchCache.get(key).includes(q) || (aliases[option.id] || []).some(alias=>alias.toLowerCase().replace(/[\s'-]/g, "").includes(q));
}
function Sprite({ species, small = false }) {
  const p = pMap[species];
  return p && !spriteInfo.missing.includes(species) ? (
    <img
      className={small ? "sprite small" : "sprite"}
      src={`${import.meta.env.BASE_URL}sprites/${species}.png`}
      alt={p.zh}
      loading="lazy"
    />
  ) : (
    <span className="sprite-placeholder" title="此形态图片待补充">
      <span className="pokeball" />
      <small>形态图待补</small>
    </span>
  );
}
function Badge({ type }) {
  return (
    <span className="type-badge" style={{ "--type": TYPES_COLOR[type] }}>
      {TYPES[type] || type}
    </span>
  );
}
function Dialog({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="关闭" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function SelectSearch({
  options,
  value,
  onChange,
  label,
  species = false,
  compact = false,
}) {
  const aliases=useContext(AliasContext);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(
    () => options.filter((o) => matches(o, query, aliases)),
    [options, query, aliases],
  );
  return (
    <>
      <button
        type="button"
        className={`search-select ${compact ? "compact" : ""}`}
        aria-label={label}
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <span>{selected?.zh || selected?.name || value || "选择"}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <Dialog title={label} onClose={() => setOpen(false)}>
          <label className="search-box">
            <Search size={18} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="中文、全拼或首字母搜索"
              aria-label={`${label}搜索`}
            />
          </label>
          <div className="option-count">{filtered.length} 个匹配结果</div>
          <div className="option-list">
            {filtered.map((o) => (
              <button
                type="button"
                className={`option ${o.id === value ? "chosen" : ""}`}
                key={o.id}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                {species && <Sprite species={o.id} small />}
                <span>
                  <strong>{o.zh || o.name}</strong>
                  <small>
                    {o.name}
                    {o.types
                      ? ` · ${o.types.map((t) => TYPES[t]).join(" / ")}`
                      : ""}
                    {o.power !== undefined
                      ? ` · ${o.category === "Status" ? "变化" : `威力 ${o.power}`}`
                      : ""}
                  </small>
                </span>
                {o.id === value && <Check size={17} />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="empty-small">
                未找到匹配项。可尝试更短的中文或拼音。
              </p>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
function FieldSelect({ label, value, onChange, options }) {
  return (
    <label className="field-select">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle-label">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function safeDamage(b, target, m, scene) {
  try {
    return previewDamage(b, target, m, scene, catalog);
  } catch (e) {
    return { error: e.message };
  }
}

function PokemonCard({
  build,
  index,
  scene,
  onChange,
  onSave,
  onLoad,
  preview,
}) {
  const p = pMap[build.species],
    issues = validateBuild(build, catalog),
    [advanced, setAdvanced] = useState(false);
  const target = scene.actors[index < 2 ? scene.target : build.target || 0];
  const results = useMemo(
    () => build.moves.map((m) => safeDamage(build, target, m, scene)),
    [build, target, scene],
  );
  let recommended = -1;
  results.forEach((r, i) => {
    if (
      !r.error &&
      catalog.moves[build.moves[i]]?.category !== "Status" &&
      (recommended < 0 || r.mean > results[recommended].mean + 1e-10)
    )
      recommended = i;
  });
  let stats = {};
  try {
    stats = statsOf(build, catalog);
  } catch {}
  const update = (key, value) => onChange({ ...build, [key]: value });
  const sum = Object.values(build.points).reduce((s, n) => s + n, 0);
  const isSecondary = index === 3;
  const selectedMoveId = build.moves[build.selected];
  const showFaintedAllies = needsFaintedAlliesInput(build);
  return (
    <section
      className={`pokemon-card ${index < 2 ? "offense" : "defense"} ${!build.present ? "absent" : ""}`}
    >
      <div className="card-eyebrow">
        <span>
          {index < 2 ? <Swords size={14} /> : <Shield size={14} />}{" "}
          {index < 2
            ? `进攻方 ${index === 0 ? "A" : "B"}`
            : index === 2
              ? "防守方 · 主要行动者"
              : "防守方 · 被动副目标"}
        </span>
        <div>
          <button
            className="icon-button"
            title="从配置库载入"
            aria-label={`载入${index + 1}号配置`}
            onClick={onLoad}
          >
            <Library size={16} />
          </button>
          <button
            className="icon-button"
            title="保存此配置"
            aria-label={`保存${index + 1}号配置`}
            onClick={onSave}
          >
            <Save size={16} />
          </button>
        </div>
      </div>
      <div className="pokemon-heading">
        <Sprite species={build.species} />
        <div className="pokemon-heading-text">
          <span className="dex-number">
            NO. {String(p?.num || 0).padStart(3, "0")}{" "}
            {p?.mega && <span className="mega-label">MEGA</span>}
          </span>
          <SelectSearch
            label={`选择${index < 2 ? "进攻" : "防守"}宝可梦 ${index + 1}`}
            options={catalog.pokemon}
            value={build.species}
            species
            onChange={(id) =>
              onChange({
                ...createBuild(catalog, id),
                ...(index >= 2 ? { moves: ["", "", "", ""] } : {}),
                id: build.id,
                active: build.active,
                present: build.present,
                target: build.target,
              })
            }
          />
          <div className="types">
            {p?.types.map((t) => (
              <Badge key={t} type={t} />
            ))}
            <span className="level">Lv. 50</span>
          </div>
        </div>
      </div>
      <div className="three-fields">
        <FieldSelect
          label={`性格 ${index + 1}`}
          value={build.nature}
          onChange={(v) => update("nature", v)}
          options={natureOptions(catalog.natures)}
        />
        <FieldSelect
          label={`特性 ${index + 1}`}
          value={build.ability}
          onChange={(v) => update("ability", v)}
          options={(p?.abilities || [build.ability]).map((a) => [
            a,
            catalog.abilities.find((x) => x.name === a)?.zh || a,
          ])}
        />
        <div className="field-select">
          <span>道具</span>
          <SelectSearch
            label={`选择道具 ${index + 1}`}
            options={catalog.items.map((i) => ({ ...i, id: i.name }))}
            value={build.item}
            onChange={(v) => update("item", v)}
            compact
          />
        </div>
      </div>
      {showFaintedAllies && (
        <label className="fainted-allies-control">
          <span>已倒下队友</span>
          <input
            aria-label={`${index + 1}号已倒下队友数量`}
            inputMode="numeric"
            type="number"
            min="0"
            max="5"
            step="1"
            value={build.faintedAllies ?? 0}
            onChange={(e) =>
              update(
                "faintedAllies",
                Math.min(5, Math.max(0, Number(e.target.value) || 0)),
              )
            }
          />
          <small>
            {build.ability === "Supreme Overlord" &&
              `大将招式威力 +${10 * (build.faintedAllies ?? 0)}%`}
            {build.ability === "Supreme Overlord" &&
              selectedMoveId === "lastrespects" &&
              "；"}
            {selectedMoveId === "lastrespects" &&
              `扫墓威力 ${(catalog.moves.lastrespects?.power ?? 50) + 50 * (build.faintedAllies ?? 0)}`}
          </small>
        </label>
      )}
      <div className="stats-heading">
        <h3>
          能力点分配 <span>SP</span>
        </h3>
        <span className={sum > 66 ? "error-text" : "muted"}>
          <b>{sum}</b> / 66 · 剩余 {66 - sum}
        </span>
      </div>
      <div className="stats-table">
        <div className="stats-row stats-labels">
          <span>能力</span>
          <span>种族</span>
          <span>分配点数</span>
          <span>实际值</span>
        </div>
        {STAT_KEYS.map((k) => (
          <div className="stats-row" key={k}>
            <span>{STAT_NAMES[k]}</span>
            <span className="base-stat">{p?.stats[k] || "—"}</span>
            <label className="stat-input">
              <input
                aria-label={`${index + 1}号${STAT_NAMES[k]}能力点`}
                inputMode="numeric"
                type="number"
                min="0"
                max="32"
                value={build.points[k]}
                onChange={(e) =>
                  update("points", {
                    ...build.points,
                    [k]: Math.max(0, Math.min(32, Number(e.target.value) || 0)),
                  })
                }
              />
              <input className="stat-range" type="range" min="0" max="32" value={build.points[k]} style={{'--fill':`${build.points[k]/32*100}%`}} aria-label={`${index + 1}号${STAT_NAMES[k]}能力点滑块`} onChange={(e)=>update("points",{...build.points,[k]:Number(e.target.value)})}/>
            </label>
            <strong>{stats[k] ?? "—"}</strong>
          </div>
        ))}
      </div>
      <div className="hp-control">
        <label htmlFor={`hp-${index}`}>开局血量</label>
        <input
          id={`hp-${index}`}
          type="range"
          min="0"
          max="100"
          value={build.hp}
          onChange={(e) => update("hp", Number(e.target.value))}
        />
        <label className="percent-input">
          <input
            aria-label={`${index + 1}号剩余血量百分比`}
            type="number"
            min="0"
            max="100"
            value={build.hp}
            onChange={(e) => update("hp", Number(e.target.value))}
          />
          %
        </label>
      </div>
      <div className="battle-state">
        <FieldSelect
          label={`异常状态 ${index + 1}`}
          value={build.status}
          onChange={(v) => update("status", v)}
          options={[
            ["", "无异常"],
            ["brn", "灼伤"],
            ["par", "麻痹 · 只降速"],
            ["psn", "中毒"],
            ["tox", "剧毒"],
            ["slp", "睡眠 · 仍出招"],
            ["frz", "冰冻 · 仍出招"],
          ]}
        />
        <Toggle
          label="守住"
          checked={build.protected}
          onChange={(v) => update("protected", v)}
        />
        {scene.mode === "double" && (
          <Toggle
            label="在场"
            checked={build.present}
            onChange={(v) => update("present", v)}
          />
        )}
      </div>
      {!isSecondary && (
        <>
          <div className="moves-heading">
            <h3>招式</h3>
            <span>
              {preview ? "对选中目标 · 单招试算" : "启用试算后显示伤害"}
            </span>
          </div>
          <div className="move-list">
            {build.moves.map((id, i) => {
              const m = catalog.moves[id],
                r = results[i];
              return (
                <div
                  key={i}
                  className={`move-row ${build.selected === i ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`move-${index}`}
                    checked={build.selected === i}
                    onChange={() => update("selected", i)}
                    aria-label={`${index + 1}号使用第${i + 1}招`}
                  />
                  <div className="move-main">
                    <SelectSearch
                      label={`选择${index + 1}号第${i + 1}招`}
                      options={[
                        { id: "", zh: "空招式栏", name: "" },
                        ...(p?.moves || []).map((m) => catalog.moves[m]),
                      ]}
                      value={id}
                      onChange={(v) =>
                        update(
                          "moves",
                          build.moves.map((x, j) => (j === i ? v : x)),
                        )
                      }
                      compact
                    />
                    <small>
                      <span style={{ color: TYPES_COLOR[m?.type] }}>
                        {TYPES[m?.type] || "未知"}
                      </span>{" "}
                      ·{" "}
                      {m?.category === "Status"
                        ? "变化招式"
                        : `${m?.category === "Physical" ? "物理" : "特殊"} · ${m?.power || "变化威力"}`}
                      {preview && recommended === i && <em>推荐</em>}
                    </small>
                  </div>
                  <div className="move-result">
                    {preview && !r.error ? (
                      <>
                        <strong>
                          {m?.category === "Status" ? "—" : range(r)}
                        </strong>
                        {r.spread && <small>分散修正</small>}
                        {r.variants?.length>1&&r.variants.map(v=><small key={v.weather}>{WEATHER_NAMES[v.weather]} {range(v.result)}</small>)}
                        {id==='suckerpunch'&&<small>按成功出招试算</small>}
                      </>
                    ) : (
                      <span>{r.error ? "配置待修正" : "—"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {isSecondary && (
        <p className="passive-note">
          此位置不主动出招。它的在场、守住与被动特性仍会影响范围伤害。
        </p>
      )}
      <button
        className="advanced-toggle"
        onClick={() => setAdvanced(!advanced)}
      >
        <ChevronRight size={15} className={advanced ? "rotated" : ""} />
        能力阶段与行动设置
      </button>
      {advanced && (
        <div className="advanced">
          <div className="boost-grid">
            {STAT_KEYS.filter((k) => k !== "hp").map((k) => (
              <FieldSelect
                key={k}
                label={`${index + 1}号${STAT_NAMES[k]}阶段`}
                value={build.boosts[k]}
                onChange={(v) =>
                  update("boosts", { ...build.boosts, [k]: Number(v) })
                }
                options={Array.from({ length: 13 }, (_, i) => [
                  i - 6,
                  i === 6 ? "0" : i > 6 ? `+${i - 6}` : String(i - 6),
                ])}
              />
            ))}
          </div>
          <p className="hint">
            这里填写开场自动效果触发前的阶段；威吓、甘露之蜜和黏黏网会自动结算，请勿重复填写。
          </p>
          {!isSecondary && (
            <div className="switch-grid">
              <Toggle
                label="击中要害"
                checked={build.crit}
                onChange={(v) => update("crit", v)}
              />
              <Toggle
                label="计入追加效果"
                checked={build.secondary}
                onChange={(v) => update("secondary", v)}
              />
            </div>
          )}
          {!isSecondary && (
            <FieldSelect
              label={`${index + 1}号连续攻击次数`}
              value={build.hits}
              onChange={(v) => update("hits", Number(v))}
              options={[1, 2, 3, 4, 5, 10].map((v) => [
                v,
                `${v} 次（仅可变次数招式）`,
              ])}
            />
          )}
          {index === 2 && scene.mode === "double" && (
            <FieldSelect
              label="反击目标"
              value={build.target}
              onChange={(v) => update("target", Number(v))}
              options={[
                [0, `进攻方 A · ${scene.actors[0].name}`],
                [1, `进攻方 B · ${scene.actors[1].name}`],
              ]}
            />
          )}
        </div>
      )}
      {!!issues.length && <p className="inline-error">{issues.join("；")}</p>}
    </section>
  );
}

function Battlefield({ scene, onChange }) {
  const field = scene.field;
  let openingWeather='配置待核对';
  let openingTerrain='配置待核对';
  try { const branches=openingBranches(scene,catalog);openingWeather=[...new Set(branches.map(w=>WEATHER_NAMES[w.openingWeather]))].join(' / ');openingTerrain=[...new Set(branches.map(w=>TERRAIN_NAMES[w.scene.field.terrain]))].join(' / '); } catch { /* Invalid edits retain the controls and show validation in the result panel. */ }
  const set = (k, v) => onChange({ ...scene, field: { ...field, [k]: v } });
  return (
    <section className="battlefield panel">
      <div className="section-title">
        <h2>战场条件</h2>
        <span>调整后自动计算</span>
      </div>
      <div className="field-grid">
        <FieldSelect
          label="天气"
          value={field.weatherMode==='auto'||(!field.weatherMode&&!field.weather)?'auto':field.weather}
          onChange={(v) => onChange({...scene,field:{...field,weatherMode:v==='auto'?'auto':'manual',weather:v==='auto'?'':v}})}
          options={[
            ['auto','自动：按开局天气特性'],
            ["", "无天气"],
            ["Sun", "晴天"],
            ["Rain", "雨天"],
            ["Sand", "沙暴"],
            ["Snow", "雪天"],
          ]}
        />
        <FieldSelect
          label="场地"
          value={field.terrainMode==='auto'||(!field.terrainMode&&!field.terrain)?'auto':field.terrain}
          onChange={(v) => onChange({...scene,field:{...field,terrainMode:v==='auto'?'auto':'manual',terrain:v==='auto'?'':v}})}
          options={[
            ['auto','自动：按开场场地特性'],
            ["", "无场地"],
            ["Electric", "电气场地"],
            ["Grassy", "青草场地"],
            ["Misty", "薄雾场地"],
            ["Psychic", "精神场地"],
          ]}
        />
        <Toggle
          label="戏法空间"
          checked={field.trickRoom}
          onChange={(v) => set("trickRoom", v)}
        />
        <Toggle
          label="重力"
          checked={field.gravity}
          onChange={(v) => set("gravity", v)}
        />
      </div>
      <p className="hint weather-readout">{field.weatherMode==='manual'||(!field.weatherMode&&field.weather)?`手动天气：${WEATHER_NAMES[field.weather]}`:`自动天气：${openingWeather}`}；{field.terrainMode==='manual'||(!field.terrainMode&&field.terrain)?`手动场地：${TERRAIN_NAMES[field.terrain]}`:`自动场地：${openingTerrain}`}。开局只比较性格、能力点及道具后的速度。</p>
      <details className="field-details hazard-options">
        <summary>入场钉子（当前 HP 为吃钉前） <ChevronDown size={15}/></summary>
        <div className="side-options">{[['attacker','我方'],['defender','对方']].map(([side,label])=><div key={side}>
          <h3>{label}场上</h3>
          <Toggle label={`${label}隐形岩`} checked={field[side].isSR} onChange={v=>set(side,{...field[side],isSR:v})}/>
          <FieldSelect label={`${label}撒菱层数`} value={field[side].spikes||0} onChange={v=>set(side,{...field[side],spikes:Number(v)})} options={[[0,'关闭'],[1,'1 层'],[2,'2 层'],[3,'3 层']]}/>
          <Toggle label={`${label}黏黏网`} checked={field[side].stickyWeb} onChange={v=>set(side,{...field[side],stickyWeb:v})}/>
        </div>)}</div>
      </details>
      <details className="field-details">
        <summary>
          墙、顺风与队友支援 <ChevronDown size={15} />
        </summary>
        <div className="side-options">
          {[
            ["attacker", "我方"],
            ["defender", "对方"],
          ].map(([side, label]) => (
            <div key={side}>
              <h3>{label}</h3>
              <div className="switch-grid">
                {[
                  ["isReflect", "反射壁"],
                  ["isLightScreen", "光墙"],
                  ["isAuroraVeil", "极光幕"],
                  ["isTailwind", "顺风"],
                  ["isHelpingHand", "帮助"],
                  ["isFriendGuard", "友情防守"],
                  ["isBattery", "蓄电池"],
                  ["isPowerSpot", "能量点"],
                  ["isSteelySpirit", "钢之意志"],
                ].map(([k, l]) => (
                  <Toggle
                    key={k}
                    label={l}
                    checked={k==='isFriendGuard'?(field[side].friendGuardOverride??(field[side][k]||hasFriendGuard(scene,side))):field[side][k]}
                    onChange={(v) => set(side, { ...field[side], [k]: v,...(k==='isFriendGuard'?{friendGuardOverride:v}:{}) })}
                  />
                ))}
              </div>
              {hasFriendGuard(scene,side)&&<small className="hint">友情防守队友已在场，开关可手动调整；自动效果不作用于特性拥有者自身。</small>}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function OpenTeamsPage({ builds, setBuilds, scene, setScene, setPage, notify, feed, updateFeed, feedUpdating, feedMessage }) {
  const [section,setSection]=useState("official"),[teamQuery,setTeamQuery]=useState(""),[picked,setPicked]=useState([]);
  const aliases=useContext(AliasContext);
  const [format,setFormat]=useState('all');
  const formats=[...new Set(feed.teams.map(team=>team.format))].sort().reverse();
  const teams=useMemo(()=>feed.teams
    .filter(team=>team.section===section)
    .filter(team=>format==='all'||team.format===format)
    .filter(team=>matches({id:team.id,name:`${team.player} ${team.handle}`,zh:`${team.player} ${team.event} ${team.members.map(member=>`${pMap[member.species]?.zh||member.species} ${(aliases[member.species]||[]).join(' ')}`).join(" ")}`},teamQuery,aliases))
    .sort((a,b)=>b.date.localeCompare(a.date)),[feed,section,format,teamQuery,aliases]);
  const togglePick=(key)=>setPicked(values=>values.includes(key)?values.filter(value=>value!==key):[...values,key]);
  const saveMembers=(team,indices)=>{
    try {
      const saved=savePublicMembers(builds,team,indices,catalog);
      setBuilds(saved.records);
      notify(`已保存 ${saved.added} 个配置${saved.skipped?`，跳过 ${saved.skipped} 个完全相同的配置`:""}`);
    } catch(error) { notify(error.message); }
  };
  const loadMember=(team,memberIndex,slot)=>{
    if(slot==="")return;
    try {
      const index=Number(slot),build=publicMemberBuild(team,memberIndex,catalog);
      const candidate={...scene,mode:[1,3].includes(index)?"double":scene.mode};
      if(hasSameDexPartner(candidate,index,build,catalog)) {
        notify("同一方不能同时使用图鉴编号相同的宝可梦");return;
      }
      setScene(current=>({...current,mode:[1,3].includes(index)?"double":current.mode,actors:current.actors.map((actor,i)=>i===index?{...build,present:true,target:actor.target}:actor)}));
      setPage("calc");notify(`已载入到${["进攻方 A","进攻方 B","防守方 A","防守方 B"][index]}`);
    } catch(error) { notify(error.message); }
  };
  return <>
    <div className="page-heading open-teams-heading">
      <div><p className="eyebrow">OPEN TEAMS</p><h1>公开阵容</h1><p>只收录《宝可梦冠军》赛制；内置完整66点配置，可离线查看、保存和载入。</p></div>
      <div className="open-team-count"><b>{feed.teams.length}</b><span>公开阵容 · 离线可看</span></div>
    </div>
    <section className="panel open-team-toolbar">
      <div className="segmented" aria-label="阵容来源">
        {[["official","官方比赛"],["community","社区比赛"]].map(([id,label])=><button key={id} className={section===id?"active":""} onClick={()=>{setSection(id);setPicked([])}}>{label} · {feed.teams.filter(team=>team.section===id).length}</button>)}
      </div>
      <select className="open-team-format" aria-label="按赛制筛选" value={format} onChange={e=>setFormat(e.target.value)}><option value="all">全部赛制</option>{formats.map(value=><option key={value} value={value}>{value}</option>)}</select>
      <label className="open-team-search"><Search size={16}/><input value={teamQuery} onChange={event=>setTeamQuery(event.target.value)} placeholder="搜索选手、比赛、宝可梦或拼音"/></label>
      <button className="button open-team-refresh" disabled={feedUpdating} onClick={updateFeed}><RefreshCw size={15}/>{feedUpdating?'更新中…':'更新队伍'}</button>
    </section>
    {feedMessage&&<p className="open-team-feed-message" role="status">{feedMessage}</p>}
    <div className="open-team-list">
      {teams.map(team=>{
        const status=teamSaveability(team,catalog),teamPicked=team.members.map((_,index)=>`${team.id}:${index}`).filter(key=>picked.includes(key));
        return <details className="panel open-team-card" key={team.id}>
          <summary>
            <div className="open-team-summary-main"><span className="team-date">{team.date}</span><h2>{team.player} <small>{team.handle}</small></h2><p>{team.event} · {team.placing}</p></div>
            <div className="team-sprites">{team.members.map((member,index)=><Sprite key={`${member.species}-${index}`} species={member.species} small/>)}</div>
            <ChevronDown size={18}/>
          </summary>
          <div className="open-team-meta">
            <span><b>赛制</b>{team.format}</span><span><b>战绩</b>{team.record||"未公开"}</span><span><b>租借码</b>{team.rentalCode||"未公开"}</span><span><b>名次</b>{team.placing}</span>
          </div>
          {!status.saveable&&<p className="open-team-limit"><Info size={15}/>{status.reason}</p>}
          <div className="open-team-members">
            {team.members.map((member,index)=>{
              const pokemon=pMap[member.species],key=`${team.id}:${index}`;
              let stats=null;
              if(status.saveable)try{stats=statsOf(publicMemberBuild(team,index,catalog),catalog)}catch{}
              return <article className="open-team-member" key={key}>
                <div className="member-title"><Sprite species={member.species}/><div><h3>{pokemon?.zh||member.species}</h3><p>{catalog.items.find(item=>item.name===member.item)?.zh||member.item||"道具未公开"}</p></div>{status.saveable&&<input type="checkbox" aria-label={`选择${pokemon?.zh}`} checked={picked.includes(key)} onChange={()=>togglePick(key)}/>}</div>
                <dl><div><dt>特性</dt><dd>{catalog.abilities.find(ability=>ability.name===member.ability)?.zh||member.ability||"未公开"}</dd></div><div><dt>性格</dt><dd>{natureOptions(catalog.natures).find(([name])=>name===member.nature)?.[1]||member.nature||"未公开"}</dd></div><div><dt>能力点</dt><dd>{member.points?STAT_KEYS.map(stat=>member.points[stat]).join(" / "):"未公开"}</dd></div>{stats&&<div><dt>实际值</dt><dd>{STAT_KEYS.map(stat=>stats[stat]).join(" / ")}</dd></div>}</dl>
                <ul>{member.moves.map(move=><li key={move}>{catalog.moves[move]?.zh||move}</li>)}</ul>
                <select aria-label={`载入${pokemon?.zh}到计算位置`} defaultValue="" disabled={!status.saveable} onChange={event=>{loadMember(team,index,event.target.value);event.target.value=""}}><option value="">载入到计算位置…</option><option value="0">进攻方 A</option><option value="1">进攻方 B</option><option value="2">防守方 A</option><option value="3">防守方 B</option></select>
              </article>;
            })}
          </div>
          <div className="open-team-actions">
            <div><span>来源：</span>{team.sourceUrl?<a href={team.sourceUrl} target="_blank" rel="noopener noreferrer">{team.sourceLabel}<ArrowUpRight size={13}/></a>:<b>{team.sourceLabel}</b>}{team.pasteUrl&&team.pasteUrl!==team.sourceUrl&&<> · <a href={team.pasteUrl} target="_blank" rel="noopener noreferrer">完整配招<ArrowUpRight size={13}/></a></>}</div>
            <button className="button" disabled={!status.saveable||!teamPicked.length} onClick={()=>saveMembers(team,teamPicked.map(key=>Number(key.split(":").at(-1))))}>保存选中 {teamPicked.length?`(${teamPicked.length})`:""}</button>
            <button className="button primary" disabled={!status.saveable} onClick={()=>saveMembers(team,[0,1,2,3,4,5])}>保存全部六只</button>
          </div>
        </details>;
      })}
      {!teams.length&&<section className="panel empty-state"><Trophy size={30}/><h2>没有找到阵容</h2><p>换一个选手、比赛名称或宝可梦名称试试。</p></section>}
    </div>
    <section className="panel open-team-sources"><div><b>数据来源</b><span>队伍快照 {feed.meta.updatedAt} · 每天检查公开来源；打开 PMC 时自动检查，也可手动更新。</span></div><div>{feed.meta.sources?.map(source=><a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer" title={source.role}>{source.name}<ArrowUpRight size={12}/></a>)}</div></section>
    <p className="open-team-footnote">只收录《宝可梦冠军》已实装、配置完整且可校验的队伍。断网仍可查看已有阵容；已保存的配置不会被更新覆盖。</p>
  </>;
}

function freshTeam() {
  return {id:uid(),name:'我的队伍',members:['venusaur','charizard','blastoise','garchomp','pikachu','dragonite'].map(id=>createBuild(catalog,id))};
}
function TeamBuilderPage({draft,setDraft,builds,savedTeams,setSavedTeams,threats,setThreats,notify}) {
  const firstMemberRef=useRef(null);
  useEffect(()=>{if(firstMemberRef.current)firstMemberRef.current.open=true;},[]);
  const setMember=(index,next)=>{setDraft(current=>({...current,members:current.members.map((member,i)=>i===index?next:member)}));setThreats(null);};
  const check=()=>{try{const result=analyzeTeam(draft.members,catalog);setThreats(result);return result;}catch(error){notify(error.message);return null;}};
  return <>
    <div className="page-heading"><div><p className="eyebrow">TEAM WORKSPACE</p><h1>我的队伍</h1><p>配置六只宝可梦，查看可能难处理的已实装对手。</p></div><button className="button" onClick={()=>{setDraft(freshTeam());setThreats(null);}}><Plus size={16}/>新队伍</button></div>
    <section className="panel team-builder-head"><label>队伍名称<input maxLength={80} value={draft.name} onChange={event=>setDraft(current=>({...current,name:event.target.value}))}/></label><div className="team-builder-actions"><button className="button" onClick={()=>{const result=check();if(result)notify(`已分析 ${catalog.pokemon.length} 个已实装形态`);}}><Target size={16}/>分析弱点</button><button className="button primary" onClick={()=>{if(!check())return;const saved={...clone(draft),name:draft.name.trim()||'我的队伍'};setSavedTeams(current=>current.some(team=>team.id===saved.id)?current.map(team=>team.id===saved.id?saved:team):[...current,saved]);notify('我的队伍已保存到本机');}}><Save size={16}/>保存队伍</button></div></section>
    <div className="team-member-grid">{draft.members.map((member,index)=>{
      const pokemon=pMap[member.species],points=Object.values(member.points).reduce((sum,value)=>sum+value,0);
      const update=(key,value)=>setMember(index,{...member,[key]:value});
      return <details className="panel team-member-card" key={index} ref={index===0?firstMemberRef:undefined}><summary><span className="team-slot">{String(index+1).padStart(2,'0')}</span><Sprite species={member.species} small/><span><b>{pokemon?.zh||member.species}</b><small>{member.name}</small></span><ChevronDown size={18}/></summary>
        <div className="team-member-fields"><SelectSearch label={`第${index+1}只宝可梦`} options={catalog.pokemon} value={member.species} onChange={id=>setMember(index,createBuild(catalog,id))} species/>
          <label className="team-library-select">从配置库载入<select value="" onChange={event=>{const saved=builds.find(build=>build.id===event.target.value);if(saved)setMember(index,{...clone(saved),id:uid(),originId:saved.id});}}><option value="">选择已保存配置…</option>{builds.map(build=><option key={build.id} value={build.id}>{build.name} · {pMap[build.species]?.zh}</option>)}</select></label>
          <FieldSelect label="特性" value={member.ability} onChange={value=>update('ability',value)} options={pokemon.abilities.map(name=>[name,catalog.abilities.find(a=>a.name===name)?.zh||name])}/>
          <FieldSelect label="道具" value={member.item} onChange={value=>update('item',value)} options={catalog.items.map(item=>[item.name,item.zh||item.name||'无道具'])}/>
          <FieldSelect label="性格" value={member.nature} onChange={value=>update('nature',value)} options={natureOptions(catalog.natures)}/>
          <div className="team-moves"><b>招式</b>{member.moves.map((id,moveIndex)=><SelectSearch key={moveIndex} label={`第${index+1}只第${moveIndex+1}招`} options={[{id:'',zh:'空招式栏',name:''},...pokemon.moves.map(move=>catalog.moves[move])]} value={id} onChange={value=>update('moves',member.moves.map((move,i)=>i===moveIndex?value:move))} compact/>)}</div>
          <div className="team-points"><b>能力点 {points}/66</b>{STAT_KEYS.map(key=><label key={key}><span>{STAT_NAMES[key]}</span><input type="number" min="0" max="32" aria-label={`第${index+1}只${STAT_NAMES[key]}能力点`} value={member.points[key]} onChange={event=>update('points',{...member.points,[key]:Math.max(0,Math.min(32,Number(event.target.value)||0))})}/><input type="range" min="0" max="32" aria-label={`第${index+1}只${STAT_NAMES[key]}能力点滑块`} value={member.points[key]} onChange={event=>update('points',{...member.points,[key]:Number(event.target.value)})}/></label>)}</div>
        </div>
      </details>;
    })}</div>
    {threats&&<section className="panel team-threat-section"><div className="section-title"><h2>潜在难处理的宝可梦</h2><span>对手配置未知 · 按可能风险排序</span></div><p className="hint">综合你队伍的招式、属性、特性、道具和速度，以及对手可学招式分析。对手实际配招与努力值可能改变结果。</p><div className="team-threat-list">{threats.length?threats.map(row=><article key={row.id}><Sprite species={row.id} small/><div><h3>{row.name}</h3>{row.reasons.map(reason=><p key={reason}>{reason}</p>)}</div></article>):<p className="hint">没有发现达到当前提示阈值的明显风险；这不代表没有不利对局。</p>}</div></section>}
    <section className="panel team-saved-section"><div className="section-title"><h2>已保存队伍</h2><span>{savedTeams.length} 支 · 存在本机，可随完整备份导出</span></div>{savedTeams.length===0?<p className="hint">保存后可在这里载入队伍继续编辑。</p>:<div className="team-saved-list">{savedTeams.map(team=><div key={team.id}><span><b>{team.name}</b><small>{team.members.map(member=>pMap[member.species]?.zh||member.species).join(' · ')}</small></span><button className="button" onClick={()=>{setDraft(clone(team));setThreats(null);}}>载入</button><button className="icon-button" aria-label={`删除${team.name}`} onClick={()=>{if(confirm(`删除队伍“${team.name}”？`))setSavedTeams(current=>current.filter(value=>value.id!==team.id));}}><Trash2 size={16}/></button></div>)}</div>}</section>
  </>;
}

function ResultPanel({ scene, result, preview, onEnable, onShare }) {
  const target = scene.actors[scene.target];
  return (
    <section className="result-panel panel">
      <div className="section-title">
        <h2>
          <Target size={18} />{" "}
          {scene.mode === "double" ? "双打集火结果" : "本回合结果"}
        </h2>
        <span className="preview-tag">试算</span>
      </div>
      <div className="result-target">
        <Sprite species={target.species} small />
        <div>
          <small>选中目标</small>
          <strong>{target.name}</strong>
        </div>
        <span>{target.hp}% 开场血量</span>
      </div>
      {!preview ? (
        <div className="result-placeholder">
          <Shield size={30} />
          <h3>冠军数据仍在核验</h3>
          <p>
            先试用界面和本地保存。社区规则试算需要你主动开启，结果不能当作游戏实测。
          </p>
          <button className="button primary" onClick={onEnable}>
            启用社区试算
          </button>
        </div>
      ) : !result ? (
        <div className="result-placeholder">
          <RefreshCw className="spin" />
          <p>正在展开本回合结果…</p>
        </div>
      ) : result.error ? (
        <div className="result-placeholder limitation">
          <Info size={24} />
          <h3>此场景暂不能完整模拟</h3>
          <p>{result.error}</p>
          <small>
            单招伤害仍显示在招式列表中。不会用两段伤害直接相加来代替完整回合。
          </small>
        </div>
      ) : (
        <>
          <div className="damage-hero">
            <small>回合末所剩血量 / 最大 HP</small>
            <strong>{range(result.remaining)}</strong>
            <div className="damage-track">
              <i style={{ width: `${Math.min(100, result.remaining.max)}%` }} />
              <b style={{ width: `${Math.min(100, result.remaining.min)}%` }} />
            </div>
            <div className="damage-metrics">
              <div>
                <span>平均所剩血量</span>
                <strong>{pct(result.remaining.mean)}</strong>
              </div>
              <div>
                <span>行动结束击倒</span>
                <strong>{pct(result.damage.ko)}</strong>
              </div>
            </div>
          </div>
          <div className="end-result">
            <span>回合末击倒概率</span>
            <b>{pct(result.endKO)}</b>
          </div>
          <details className="turn-details">
            <summary>
              展开详细过程 <ChevronDown size={16} />
            </summary>
            <p className="hint">{result.note}</p>
            {result.opening?.map((o,i)=><div key={i}><h3>开局 · {WEATHER_NAMES[o.weather]}</h3>{o.log.map((text,j)=><p className="hint" key={j}>{text}</p>)}</div>)}
            <h3>行动路径示例（不是唯一结果）</h3>
            <ol>
              {result.log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
            <h3>剩余血量范围</h3>
            {(scene.mode === "double" ? [0, 1, 2, 3] : [0, 2]).map((i) => (
              <div className="hp-summary" key={i}>
                <span>{scene.actors[i].name}</span>
                <small>
                  行动后 {range(result.afterAction[i])}
                  <br />
                  回合末 {range(result.afterEnd[i])}
                </small>
              </div>
            ))}
            <small>{result.branches} 个合并后的结果分支</small>
          </details>
        </>
      )}
      <div className="result-footnote">
        <CheckCircle2 size={14} />
        <span>
          只计算当前一回合，不继承上一回合状态，也不模拟下一回合触发
          <br />
          命中且不受状态性行动失败影响
          <br />
          所剩血量以目标最大 HP 为分母
        </span>
      </div>
      <button
        className="button share-button"
        disabled={!preview || !result || !!result.error}
        onClick={()=>onShare(false)}
      >
        <ImageIcon size={16} />
        保存结果图片
      </button>
      <button className="button share-button" disabled={!preview||!result||!!result.error} onClick={()=>onShare(true)}>导出分支详情图片</button>
    </section>
  );
}

import {
  DEFAULT_HEADING,
  normalizeHeading,
  DISCUSSION_URL,
} from "./preferences.mjs";

export default function App() {
  const [language,setLanguage]=useState(()=>{let saved;try{saved=localStorage.getItem(LANGUAGE_KEY);}catch{}return initialLanguage(saved,globalThis.navigator?.language);});
  useEffect(()=>{
    try{localStorage.setItem(LANGUAGE_KEY,language);}catch{}
    document.documentElement.lang={zhHans:'zh-CN',zhHant:'zh-TW',ja:'ja',ko:'ko'}[language];
    const root=document.querySelector('.app-shell');if(!root)return;
    let frame=0;
    const translate=()=>{frame=0;localizeDom(root,language);};
    translate();
    let active=true;
    prepareLanguage(language).then(()=>{if(active)translate();}).catch(()=>{});
    const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(translate);});
    observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder','alt']});
    return ()=>{active=false;observer.disconnect();if(frame)cancelAnimationFrame(frame);};
  },[language]);
  const [aliases,setAliases]=useState(readAliases);
  const [aliasType,setAliasType]=useState('pokemon'),[aliasTarget,setAliasTarget]=useState(''),[aliasText,setAliasText]=useState('');
  useEffect(()=>{try {localStorage.setItem('pmc.aliases.v1',JSON.stringify(aliases));} catch {notify('别称保存失败，请检查本机存储空间');}},[aliases]);
  const [screenMode,setScreenMode]=useState(()=>isAndroidApp?(globalThis.PMCAndroid?.getScreenMode?.()||'auto'):'auto');
  const [initial] = useState(() => readWorkspace());
  const [teamDraft,setTeamDraft]=useState(()=>{const saved=initial?.teamDraft;return saved&&Array.isArray(saved.members)&&saved.members.length===6&&saved.members.every(member=>!validateBuild(member,catalog).length)?saved:freshTeam();});
  const [savedTeams,setSavedTeams]=useState(()=>initial?.teams||[]);
  const [teamThreats,setTeamThreats]=useState(null);
  const [teamFeed,setTeamFeed]=useState(()=>{try{return validateTeamFeed(openTeams,JSON.parse(localStorage.getItem(TEAM_FEED_STORAGE_KEY)),catalog);}catch{return openTeams;}});
  const [teamFeedUpdating,setTeamFeedUpdating]=useState(false),[teamFeedMessage,setTeamFeedMessage]=useState('');
  const [heading, setHeading] = useState(() =>
    normalizeHeading(initial?.heading),
  );
  const [scene, setSceneState] = useState(() =>
      withMandatoryActions(initial?.scene || defaultScene(catalog)),
    ),
    [builds, setBuilds] = useState(() => initial?.builds || []),
    [scenes, setScenes] = useState(() => initial?.scenes || []),
    [theme, setTheme] = useState(() => initial?.theme || "system");
  const setScene = (next) =>
    setSceneState((previous) =>
      withMandatoryActions(typeof next === "function" ? next(previous) : next),
    );
  const [page, setPage] = useState("calc"),
    [preview, setPreview] = useState(false),
    [result, setResult] = useState(null),
    [message, setMessage] = useState(""),
    [storageError, setStorageError] = useState(""),
    [modal, setModal] = useState(null),
    [name, setName] = useState(""),
    [selected, setSelected] = useState(() =>
      Array.isArray(initial?.selected) ? initial.selected : [],
    ),
    [query, setQuery] = useState(""),
    [backgroundUrls, setBackgroundUrls] = useState({
      landscape: "",
      portrait: "",
    }),
    [isPortrait, setIsPortrait] = useState(
      () => matchMedia("(orientation: portrait)").matches,
    ),
    [online, setOnline] = useState(navigator.onLine),
    [registration, setRegistration] = useState(null),
    [updateReady, setUpdateReady] = useState(false),
    [offlineReady, setOfflineReady] = useState(isAndroidApp),
    [installPrompt, setInstallPrompt] = useState(null);
  const importRef = useRef(),
    backgroundRef = useRef(),
    portraitBackgroundRef = useRef(),
    backgroundUrlsRef = useRef({});
  const background =
    backgroundUrls[isPortrait ? "portrait" : "landscape"] ||
    backgroundUrls[isPortrait ? "landscape" : "portrait"];
  const notify = (text) => setMessage(text);
  const updateTeamFeed=async()=>{
    setTeamFeedUpdating(true);
    try {
      const response=await fetch(new URL('live-teams.json',document.baseURI),{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`服务器返回 ${response.status}`);
      const fresh=validateTeamFeed(openTeams,await response.json(),catalog);
      setTeamFeed(fresh);
      try {localStorage.setItem(TEAM_FEED_STORAGE_KEY,JSON.stringify(fresh));} catch {setTeamFeedMessage('新队伍已显示，但本机空间不足，无法保留离线副本。');return;}
      setTeamFeedMessage(`已检查更新：${fresh.meta.updatedAt} · ${fresh.teams.length} 支队伍`);
    } catch(error) {setTeamFeedMessage(`联网更新失败：${error.message}；继续使用本机队伍。`);}
    finally {setTeamFeedUpdating(false);}
  };
  useEffect(()=>{updateTeamFeed();},[]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.dataset.theme = isAndroidApp && theme === "system"
        ? (globalThis.PMCAndroid?.isDarkMode?.() ? "dark" : "light")
        : theme;
    };
    applyTheme();
    window.addEventListener("pmc-system-theme", applyTheme);
    return () => window.removeEventListener("pmc-system-theme", applyTheme);
  }, [theme]);
  useEffect(() => {
    const t = setTimeout(
      () =>
        setStorageError(
          writeWorkspace({ scene, builds, scenes, teams:savedTeams, teamDraft, theme, selected, heading }),
        ),
      300,
    );
    return () => clearTimeout(t);
  }, [scene, builds, scenes, savedTeams, teamDraft, theme, selected, heading]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ["landscape", "portrait"].map(async (orientation) => [
        orientation,
        await getBackground(orientation),
      ]),
    )
      .then((entries) => {
        if (cancelled) return;
        const urls = Object.fromEntries(
          entries.map(([orientation, file]) => [
            orientation,
            file ? URL.createObjectURL(file) : "",
          ]),
        );
        backgroundUrlsRef.current = urls;
        setBackgroundUrls(urls);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      Object.values(backgroundUrlsRef.current)
        .filter(Boolean)
        .forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    const media = matchMedia("(orientation: portrait)");
    const update = () => setIsPortrait(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine),
      install = (e) => {
        e.preventDefault();
        setInstallPrompt(e);
      };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("beforeinstallprompt", install);
    const updateMessage = (e) => {
      if (e.data?.type === "UPDATE_FAILED")
        notify("新版资源下载失败，仍保留当前版本，请重试。");
    };
    navigator.serviceWorker?.addEventListener("message", updateMessage);
    if (!isAndroidApp && "serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .then((reg) => {
          setRegistration(reg);
          setUpdateReady(!!reg.waiting);
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed") {
                if (navigator.serviceWorker.controller) setUpdateReady(true);
                else setOfflineReady(true);
              }
            });
          });
          navigator.serviceWorker.ready.then(() => setOfflineReady(true));
        })
        .catch(() => notify("离线缓存安装失败，联网使用不受影响。"));
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("beforeinstallprompt", install);
      navigator.serviceWorker?.removeEventListener("message", updateMessage);
    };
  }, []);
  useEffect(() => {
    setResult(null);
    if (!preview) return;
    let worker;
    const timer = setTimeout(() => {
      worker = new Worker(new URL("./engine.worker.js", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e) => setResult(e.data);
      worker.onerror = () =>
        setResult({ error: "计算进程失败，请调整场景后重试。" });
      worker.postMessage(scene);
    }, 180);
    return () => {
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [scene, preview]);
  const updateActor = (index, value) => {
    const current = scene.actors[index];
    const identityChanged =
      current.species !== value.species || current.present !== value.present;
    if(identityChanged && hasSameDexPartner(scene,index,value,catalog)) {
      notify("同一方不能同时使用图鉴编号相同的宝可梦");
      return;
    }
    setScene((s) => {
      const side=index<2?'attacker':'defender',old=s.actors[index];
      const changed=old.species!==value.species||old.ability!==value.ability||old.present!==value.present;
      return {...s,actors:s.actors.map((b,i)=>i===index?value:b),field:changed?{...s.field,[side]:{...s.field[side],isFriendGuard:false,friendGuardOverride:undefined}}:s.field};
    });
  };
  const reset = () => setModal({ type: "reset" });
  const saveBuild = (i) => {
    setName(scene.actors[i].name);
    setModal({ type: "saveBuild", index: i });
  };
  const saveScene = () => {
    setName(scene.name === "未命名场景" ? "" : scene.name);
    setModal({ type: "saveScene" });
  };
  const exportAll = () => {
    downloadFile(
      JSON.stringify(exportPayload(builds, scenes, savedTeams), null, 2),
      "PMC-完整备份.json",
    );
    notify(isAndroidApp ? `已准备 ${builds.length} 个配置、${scenes.length} 个场景和 ${savedTeams.length} 支队伍，请选择保存位置` : `已导出 ${builds.length} 个配置、${scenes.length} 个场景和 ${savedTeams.length} 支队伍`);
  };
  const importFile = async (file) => {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("文件不能超过 10 MB");
      const data = parseImport(await file.text());
      const b = mergeRecords(builds, data.builds),
        s = mergeRecords(scenes, data.scenes),t=mergeRecords(savedTeams,data.teams);
      setModal({
        type: "import",
        data,
        conflicts: b.conflicts.length + s.conflicts.length+t.conflicts.length,
        skipped: b.skipped + s.skipped+t.skipped,
      });
    } catch (e) {
      notify(e.message);
    } finally {
      importRef.current.value = "";
    }
  };
  const applyImport = (policy) => {
    setBuilds(mergeRecords(builds, modal.data.builds, policy).records);
    setScenes(mergeRecords(scenes, modal.data.scenes, policy).records);
    setSavedTeams(mergeRecords(savedTeams,modal.data.teams,policy).records);
    setModal(null);
    notify("导入完成，原有记录已保留");
  };
  const share = async (details=false) => {
    try {
      await exportResultImage(scene, result, catalog,{details});
      notify("结果图片已生成");
    } catch (e) {
      notify(e.message);
    }
  };
  const setCustomBackground = async (file, orientation = "landscape") => {
    if (
      file &&
      (!["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 12 * 1024 * 1024)
    ) {
      notify("请选择不超过 12 MB 的 PNG、JPG 或 WebP 图片");
      return;
    }
    try {
      await setBackground(file, orientation);
      const previous = backgroundUrlsRef.current[orientation];
      if (previous) URL.revokeObjectURL(previous);
      const urls = {
        ...backgroundUrlsRef.current,
        [orientation]: file ? URL.createObjectURL(file) : "",
      };
      backgroundUrlsRef.current = urls;
      setBackgroundUrls(urls);
      notify(
        file
          ? `${orientation === "landscape" ? "横屏" : "竖屏"}背景已保存在本机`
          : "已清除该方向的自定义背景",
      );
    } catch {
      notify("背景保存失败，可能是本地存储空间不足");
    }
  };
  const filteredBuilds = builds.filter((b) =>
    matches(
      {
        id: b.id,
        name: b.name,
        zh: `${b.name} ${pMap[b.species]?.zh || b.species}`,
      },
      query,aliases,
    ),
  );
  const nav = [
    ["calc", Swords, "伤害计算"],
    ["openTeams", Trophy, "公开阵容"],
    ["teamBuilder", Shield, "我的队伍"],
    ["library", Library, "配置库"],
    ["scenes", Layers, "已存场景"],
    ["settings", Settings, "设置"],
  ];
  const sourceVersion = catalog.meta.source.showdown.commit.slice(0, 8);
  return (
    <AliasContext.Provider value={aliases}>
      <div
        className="fixed-background"
        style={
          background ? { backgroundImage: `url("${background}")` } : undefined
        }
      />
      <div className="background-wash" />
      <div className="app-shell">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage("calc");
            }}
          >
            <span className="brand-mark">
              <img
                src="./rotom-logo.webp"
                alt="洛托姆图鉴"
                width="48"
                height="48"
              />
            </span>
            <div>
              <b>
                PMC<span> / </span>
              </b>
              <small>宝可梦冠军计算器</small>
            </div>
          </a>
          <nav aria-label="主导航">
            {nav.map(([id, Icon, label]) => (
              <button
                key={id}
                className={page === id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setPage(id);
                  setQuery("");
                }}
              >
                <Icon size={17} />
                <span>{label}</span>
                {id === "library" && builds.length > 0 && (
                  <small>{builds.length}</small>
                )}
              </button>
            ))}
          </nav>
          <div
            className="connection"
            title={offlineReady ? "本机离线资源已就绪" : "正在使用本地预览"}
          >
            {online ? <Wifi size={15} /> : <CloudOff size={15} />}
            <span>
              {online ? (offlineReady ? "离线已就绪" : "本地预览") : "离线模式"}
            </span>
          </div>
          <label className="language-control">
            <Globe2 size={15} aria-hidden="true" />
            <select aria-label={{zhHans:'界面语言',zhHant:'介面語言',ja:'表示言語',ko:'표시 언어'}[language]} value={language} onChange={event=>setLanguage(event.target.value)}>
              {LANGUAGES.map(([id,label])=><option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        </header>
        <div className="data-notice">
          <Info size={16} />
          <span>
            <b>社区数据预览</b>
            <span className="notice-detail">
              {" "}
              · 游戏补丁版本尚未核实，试算结果仅供核对。
            </span>
          </span>
          <button onClick={() => setPage("settings")}>
            数据说明 <ArrowUpRight size={14} />
          </button>
        </div>
        {storageError && (
          <div className="error-banner" role="alert">
            {storageError}
            <button onClick={exportAll}>导出备份</button>
          </div>
        )}
        {updateReady && (
          <div className="update-banner">
            <span>发现新版本。更新后将使用新规则，配置与场景继续保留。</span>
            <button
              className="button primary"
              onClick={() => {
                const error = writeWorkspace({
                  scene,
                  builds,
                  scenes,
                  teams: savedTeams,
                  teamDraft,
                  theme,
                  selected,
                  heading,
                });
                if (error) {
                  notify(error);
                  return;
                }
                navigator.serviceWorker.addEventListener(
                  "controllerchange",
                  () => location.reload(),
                  { once: true },
                );
                registration.waiting?.postMessage({ type: "ACTIVATE" });
              }}
            >
              确认更新
            </button>
          </div>
        )}
        <main>
          {page === "calc" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">BATTLE WORKSPACE</p>
                  <h1
                    className="custom-heading"
                    data-testid="workspace-heading"
                    style={{
                      fontSize: `${heading.size}px`,
                      color: heading.color || undefined,
                    }}
                  >
                    {heading.text || DEFAULT_HEADING.text}
                  </h1>
                  <p>调整配置，比较伤害，找到你这一回合的选择。</p>
                </div>
                <div className="page-actions">
                  <button className="button" onClick={() => {setScene(s=>resetBattleState(s,catalog));notify("场上临时状态已重置，宝可梦配置已保留");}}><RotateCcw size={16}/>重置</button>
                  <button className="button" onClick={reset}>
                    <Plus size={16} />
                    新建计算
                  </button>
                  <button className="button" onClick={saveScene}>
                    <Save size={16} />
                    保存场景
                  </button>
                </div>
              </div>
              <div className="workspace-toolbar">
                <div className="segmented" aria-label="计算模式">
                  {[
                    ["single", "单打"],
                    ["double", "双打集火"],
                    ["compare", "配置比较"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      className={scene.mode === v ? "active" : ""}
                      onClick={() =>
                        setScene((s) => ({ ...s, mode: v, target: 2 }))
                      }
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="workspace-caption">
                  <span className="live-dot" />
                  自动计算 <span className="separator">/</span> {scene.name}
                </div>
              </div>
              <Battlefield scene={scene} onChange={setScene} />
              {scene.mode === "double" && (
                <div className="double-target">
                  <Target size={16} />
                  <span>比较与集火目标</span>
                  {[2, 3].map((i) => (
                    <button
                      className={scene.target === i ? "chip selected" : "chip"}
                      key={i}
                      onClick={() => setScene((s) => ({ ...s, target: i }))}
                    >
                      {i === 2 ? "对方 A" : "对方 B"} · {scene.actors[i].name}
                    </button>
                  ))}
                  <small>推荐只比较选中目标</small>
                </div>
              )}
              <div className="workspace-grid">
                {scene.openingRules!==OPENING_RULES&&<div className="legacy-opening-notice" role="alert">
                  <strong>旧场景：请核对开场前的能力等级</strong>
                  <p>新版会自动结算威吓、甘露之蜜和黏黏网。如果以前手动填过触发后的等级，请先还原为触发前数值。原记录未删除或自动改写。</p>
                  <button className="button" onClick={()=>{setScene(s=>({...s,openingRules:OPENING_RULES}));setScenes(list=>list.map(s=>s.id===scene.id?{...s,openingRules:OPENING_RULES}:s));}}>已检查，不再提醒此场景</button>
                </div>}
                <div className="combatants">
                  {(scene.mode === "double" ? [0, 2, 1, 3] : [0, 2]).map(
                    (i) => (
                      <PokemonCard
                        key={i}
                        index={i}
                        build={scene.actors[i]}
                        scene={scene}
                        preview={preview}
                        onChange={(b) => updateActor(i, b)}
                        onSave={() => saveBuild(i)}
                        onLoad={() => {
                          setModal({ type: "load", index: i });
                          setQuery("");
                        }}
                      />
                    ),
                  )}
                </div>
                <aside>
                  <ResultPanel
                    scene={scene}
                    result={result}
                    preview={preview}
                    onEnable={() => setPreview(true)}
                    onShare={share}
                  />
                  <div className="side-note">
                    <span className="mini-ball" />{" "}
                    <p>
                      配置只保存在这台设备。
                      <br />
                      <button onClick={exportAll}>
                        定期导出备份 <ArrowRight size={13} />
                      </button>
                    </p>
                  </div>
                </aside>
              </div>
              {scene.mode === "compare" && (
                <section className="panel comparison">
                  <div className="section-title">
                    <h2>配置独立比较</h2>
                    <button
                      className="button"
                      onClick={() => setPage("library")}
                    >
                      从配置库选择 <ArrowRight size={15} />
                    </button>
                  </div>
                  <p className="hint">
                    所选配置分别攻击同一目标，不视为同时上场；比较数量不限两只。
                  </p>
                  {selected.length === 0 ? (
                    <p className="empty-small">
                      还没有选择配置。先把宝可梦保存到配置库，再勾选需要比较的记录。
                    </p>
                  ) : (
                    <div className="comparison-table">
                      {builds
                        .filter((b) => selected.includes(b.id))
                        .map((b) => {
                          const values = b.moves.map((m) =>
                            safeDamage(b, scene.actors[scene.target], m, {
                              ...scene,
                              actors: [
                                b,
                                scene.actors[1],
                                scene.actors[2],
                                scene.actors[3],
                              ],
                            }),
                          );
                          let best = 0;
                          values.forEach((v, i) => {
                            if (
                              !v.error &&
                              (values[best].error || v.mean > values[best].mean)
                            )
                              best = i;
                          });
                          return (
                            <div className="comparison-row" key={b.id}>
                              <Sprite species={b.species} small />
                              <strong>{b.name}</strong>
                              <span>{catalog.moves[b.moves[best]]?.zh}</span>
                              <b>
                                {preview && !values[best].error
                                  ? range(values[best])
                                  : "—"}
                              </b>
                              <small>
                                {preview && !values[best].error
                                  ? `平均 ${pct(values[best].mean)}`
                                  : "需启用试算 / 修正配置"}
                              </small>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {page === "openTeams" && <OpenTeamsPage builds={builds} setBuilds={setBuilds} scene={scene} setScene={setScene} setPage={setPage} notify={notify} feed={teamFeed} updateFeed={updateTeamFeed} feedUpdating={teamFeedUpdating} feedMessage={teamFeedMessage}/>}
          {page === "teamBuilder" && <TeamBuilderPage draft={teamDraft} setDraft={setTeamDraft} builds={builds} savedTeams={savedTeams} setSavedTeams={setSavedTeams} threats={teamThreats} setThreats={setTeamThreats} notify={notify}/>}
          {page === "library" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">YOUR POKÉMON</p>
                  <h1>
                    配置库<span>.</span>
                  </h1>
                  <p>保存不同配点，不限六只。重名配置也会分别保留。</p>
                </div>
                <div className="page-actions">
                  <button
                    className="button"
                    onClick={() => importRef.current.click()}
                  >
                    <Upload size={16} />
                    批量导入
                  </button>
                  <button className="button" onClick={exportAll}>
                    <Download size={16} />
                    完整备份
                  </button>
                </div>
              </div>
              <section className="panel library-panel">
                <div className="library-toolbar">
                  <label className="search-box">
                    <Search size={18} />
                    <input
                      placeholder="搜索名称、宝可梦或拼音"
                      aria-label="搜索配置库"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <span>
                    {builds.length} 个配置 · 已选 {selected.length}
                  </span>
                  <button
                    className="button"
                    onClick={() =>
                      setSelected(
                        selected.length === builds.length
                          ? []
                          : builds.map((b) => b.id),
                      )
                    }
                  >
                    全选 / 取消
                  </button>
                </div>
                {builds.length === 0 ? (
                  <div className="empty-state">
                    <Library size={38} />
                    <h2>把第一只宝可梦收进来</h2>
                    <p>在计算页面调整配置，再点击卡片右上角的保存按钮。</p>
                    <button
                      className="button primary"
                      onClick={() => setPage("calc")}
                    >
                      去配置宝可梦 <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="library-grid">
                      {filteredBuilds.map((b) => (
                        <article
                          className={`library-card ${selected.includes(b.id) ? "checked" : ""}`}
                          key={b.id}
                        >
                          <label className="library-check">
                            <input
                              type="checkbox"
                              aria-label={`选择配置 ${b.name}`}
                              checked={selected.includes(b.id)}
                              onChange={(e) =>
                                setSelected((s) =>
                                  e.target.checked
                                    ? [...s, b.id]
                                    : s.filter((id) => id !== b.id),
                                )
                              }
                            />
                            <span>{b.id.slice(0, 6)}</span>
                          </label>
                          <Sprite species={b.species} />
                          <h3>{b.name}</h3>
                          <p>
                            {pMap[b.species]?.zh || b.species} ·{" "}
                            {
                              catalog.natures.find((n) => n.name === b.nature)
                                ?.zh
                            }
                          </p>
                          <small>
                            {catalog.items.find((i) => i.name === b.item)?.zh ||
                              b.item}
                          </small>
                          <div className="saved-moves">
                            {b.moves.map((m, i) => (
                              <span key={i}>
                                {catalog.moves[m]?.zh || `${m}（失效）`}
                              </span>
                            ))}
                          </div>
                          {!!validateBuild(b, catalog).length && (
                            <p className="error-text">当前版本需修正</p>
                          )}
                          <div className="library-card-actions">
                            <button
                              className="button"
                              onClick={() => {
                                updateActor(0, {
                                  ...clone(b),
                                  id: uid(),
                                  originId: b.id,
                                });
                                setPage("calc");
                                notify("已载入进攻方 A，原配置未修改");
                              }}
                            >
                              载入计算
                            </button>
                            <button
                              className="icon-button"
                              title="删除配置"
                              aria-label={`删除 ${b.name}`}
                              onClick={() =>
                                setModal({
                                  type: "deleteBuild",
                                  id: b.id,
                                  label: b.name,
                                })
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="selection-actions">
                      <button
                        className="button"
                        disabled={!selected.length}
                        onClick={() =>
                          downloadFile(
                            JSON.stringify(
                              exportPayload(
                                builds.filter((b) => selected.includes(b.id)),
                                [],
                              ),
                              null,
                              2,
                            ),
                            "PMC-所选配置.json",
                          )
                        }
                      >
                        <Download size={16} />
                        导出所选
                      </button>
                      <button
                        className="button primary"
                        disabled={!selected.length}
                        onClick={() => {
                          setScene((s) => ({ ...s, mode: "compare" }));
                          setPage("calc");
                        }}
                      >
                        独立比较 {selected.length ? `(${selected.length})` : ""}
                      </button>
                      <button
                        className="button"
                        disabled={selected.length !== 2}
                        onClick={() => {
                          const pair = builds.filter((b) =>
                            selected.includes(b.id),
                          );
                          setScene((s) => ({
                            ...s,
                            mode: "double",
                            target: 2,
                            actors: [
                              { ...clone(pair[0]), id: uid() },
                              { ...clone(pair[1]), id: uid() },
                              s.actors[2],
                              s.actors[3],
                            ],
                          }));
                          setPage("calc");
                        }}
                      >
                        用两只进行集火
                      </button>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
          {page === "scenes" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">SAVED BATTLES</p>
                  <h1>
                    已存场景<span>.</span>
                  </h1>
                  <p>保留保存当时的配置，计算规则随数据更新。</p>
                </div>
                <button className="button" onClick={exportAll}>
                  <Download size={16} />
                  导出备份
                </button>
              </div>
              <section className="panel">
                {scenes.length === 0 ? (
                  <div className="empty-state">
                    <Layers size={38} />
                    <h2>还没有保存场景</h2>
                    <p>保存一组对局，下次可以从这里继续。</p>
                    <button
                      className="button primary"
                      onClick={() => setPage("calc")}
                    >
                      回到计算
                    </button>
                  </div>
                ) : (
                  <div className="scene-list">
                    {scenes.map((s) => (
                      <article className="scene-card" key={s.id}>
                        <div className="scene-icons">
                          <Sprite species={s.actors[0].species} small />
                          <ArrowRight size={16} />
                          <Sprite species={s.actors[s.target].species} small />
                        </div>
                        <div>
                          <h3>{s.name}</h3>
                          <p>
                            {s.mode === "double"
                              ? "双打集火"
                              : s.mode === "compare"
                                ? "独立比较"
                                : "单打"}{" "}
                            · {s.actors[0].name} → {s.actors[s.target].name}
                          </p>
                          <small>独立配置快照 · 按当前版本计算</small>
                        </div>
                        <div className="scene-actions">
                          <button
                            className="button primary"
                            onClick={() => {
                              setScene(clone(s));
                              setPage("calc");
                              notify("场景已恢复");
                            }}
                          >
                            载入
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`导出场景 ${s.name}`}
                            onClick={() =>
                              downloadFile(
                                JSON.stringify(exportPayload([], [s]), null, 2),
                                "PMC-场景.json",
                              )
                            }
                          >
                            <Download size={17} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`删除场景 ${s.name}`}
                            onClick={() =>
                              setModal({
                                type: "deleteScene",
                                id: s.id,
                                label: s.name,
                              })
                            }
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">MAKE IT YOURS</p>
                  <h1>
                    设置<span>.</span>
                  </h1>
                  <p>外观和数据保存在本机，不需要账号。</p>
                </div>
              </div>
              <section className="panel settings-card alias-settings">
                <h2>自定义搜索别称</h2><p>给宝可梦或招式添加熟悉的叫法，搜索时使用，正式名称保持不变。</p>
                <div className="alias-form">
                  <FieldSelect label="类型" value={aliasType} onChange={v=>{setAliasType(v);setAliasTarget('');}} options={[["pokemon","宝可梦"],["move","招式"]]}/>
                  <SelectSearch label="选择要绑定别称的对象" options={aliasType==='pokemon'?catalog.pokemon:Object.values(catalog.moves)} value={aliasTarget} onChange={setAliasTarget} species={aliasType==='pokemon'}/>
                  <input aria-label="输入搜索别称" maxLength={32} value={aliasText} onChange={e=>setAliasText(e.target.value)}/>
                  <button className="button primary" disabled={!aliasTarget||!aliasText.trim()} onClick={()=>{const value=aliasText.trim();setAliases(current=>({...current,[aliasTarget]:[...new Set([...(current[aliasTarget]||[]),value])].slice(0,12)}));setAliasText('');}}>添加别称</button>
                </div>
                <div className="alias-list">{Object.entries(aliases).flatMap(([id,values])=>values.map(value=><div className="alias-row" key={`${id}:${value}`}><span><b>{pMap[id]?.zh||catalog.moves[id]?.zh||id}</b><small>{value}</small></span><button className="icon-button" aria-label={`删除${value}别称`} onClick={()=>setAliases(current=>{const next={...current},rest=next[id].filter(x=>x!==value);if(rest.length)next[id]=rest;else delete next[id];return next;})}><X size={16}/></button></div>))}</div>
              </section>
              <div className="settings-grid">
                <section className="panel settings-card heading-settings">
                  <h2>首页文字</h2>
                  <p>修改计算页上方的文字，自动保存在本机。</p>
                  <label className="heading-field">
                    自定义文字
                    <input
                      aria-label="自定义文字"
                      maxLength={80}
                      value={heading.text}
                      onChange={(e) =>
                        setHeading({ ...heading, text: e.target.value })
                      }
                      placeholder={DEFAULT_HEADING.text}
                    />
                  </label>
                  <label className="heading-field">
                    字体大小：{heading.size} px
                    <input
                      aria-label="首页文字字号"
                      type="range"
                      min="18"
                      max="64"
                      step="1"
                      value={heading.size}
                      onChange={(e) =>
                        setHeading({ ...heading, size: Number(e.target.value) })
                      }
                    />
                  </label>
                  <div className="button-row">
                    <label className="heading-color">
                      文字颜色
                      <input
                        aria-label="首页文字颜色"
                        type="color"
                        value={heading.color || "#292a30"}
                        onChange={(e) =>
                          setHeading({ ...heading, color: e.target.value })
                        }
                      />
                    </label>
                    <button
                      className="button"
                      onClick={() => setHeading({ ...heading, color: "" })}
                    >
                      颜色跟随主题
                    </button>
                  </div>
                  <div
                    className="heading-preview custom-heading"
                    style={{
                      fontSize: `${heading.size}px`,
                      color: heading.color || undefined,
                    }}
                  >
                    {heading.text || DEFAULT_HEADING.text}
                  </div>
                  <small>最多 80 字；自选颜色在深浅主题下保持不变。</small>
                  <button
                    className="button"
                    onClick={() => setHeading({ ...DEFAULT_HEADING })}
                  >
                    <RotateCcw size={15} />
                    恢复默认文字样式
                  </button>
                </section>
                <section className="panel settings-card">
                  <h2>外观</h2>
                  <p>玻璃面板随主题调整，背景保持固定。</p>
                  {isAndroidApp&&<FieldSelect label="APP 屏幕方向" value={screenMode} onChange={v=>{setScreenMode(v);globalThis.PMCAndroid?.setScreenMode?.(v);}} options={[["auto","跟随手机旋转"],["portrait","竖屏"],["landscape","横屏"]]}/>}
                  <div className="theme-options">
                    {[
                      ["light", Sun, "浅色"],
                      ["dark", Moon, "深色"],
                      ["system", Monitor, "跟随系统"],
                    ].map(([v, Icon, l]) => (
                      <button
                        className={
                          theme === v ? "theme-option active" : "theme-option"
                        }
                        key={v}
                        onClick={() => setTheme(v)}
                      >
                        <Icon size={22} />
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="background-choices">
                    {[
                      [
                        "landscape",
                        "横屏背景",
                        "建议 16:9，适合电脑或横屏",
                        backgroundRef,
                      ],
                      [
                        "portrait",
                        "竖屏背景",
                        "建议 9:16，适合手机竖屏",
                        portraitBackgroundRef,
                      ],
                    ].map(([orientation, label, hint, inputRef]) => (
                      <div className="background-choice" key={orientation}>
                        <h3>{label}</h3>
                        <small>{hint}</small>
                        <div
                          className={`background-preview ${orientation}`}
                          style={
                            backgroundUrls[orientation]
                              ? {
                                  backgroundImage: `url("${backgroundUrls[orientation]}")`,
                                }
                              : undefined
                          }
                        />
                        <button
                          className="button"
                          onClick={() => inputRef.current.click()}
                        >
                          <ImageIcon size={16} />
                          选择{label}
                        </button>
                        {backgroundUrls[orientation] && (
                          <button
                            className="button"
                            onClick={() =>
                              setCustomBackground(null, orientation)
                            }
                          >
                            清除{label}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="hint">
                    按屏幕方向自动切换，旋转屏幕也会切换。只设置一张时，两种方向共用；两张都未设置时使用默认背景。不同尺寸会居中裁剪。
                  </p>
                  <div className="button-row">
                    <button
                      className="button"
                      onClick={async () => {
                        await setCustomBackground(null, "landscape");
                        await setCustomBackground(null, "portrait");
                      }}
                    >
                      <RotateCcw size={15} />
                      恢复默认
                    </button>
                  </div>
                  <small>
                    PNG / JPG / WebP，每张最大 12 MB。图片只保存在本机。
                  </small>
                </section>
                <section className="panel settings-card">
                  <h2>安装与备份</h2>
                  <p>{isAndroidApp ? "安卓离线版 1.3.0 · 数据与图片已内置。网页版记录请先导出，再在这里导入。" : "本地数据不会自动同步到其他设备。"}</p>
                  <div className="status-line">
                    <span>离线资源</span>
                    <b>
                      {isAndroidApp ? "安装包已内置" : offlineReady
                        ? "已缓存"
                        : import.meta.env.DEV
                          ? "开发预览不安装缓存"
                          : "等待缓存完成"}
                    </b>
                  </div>
                  <div className="status-line">
                    <span>本机记录</span>
                    <b>
                      {builds.length} 配置 / {scenes.length} 场景
                    </b>
                  </div>
                  <div className="button-row">
                    <button className="button primary" onClick={exportAll}>
                      <Download size={16} />
                      完整导出
                    </button>
                    <button
                      className="button"
                      onClick={() => importRef.current.click()}
                    >
                      <Upload size={16} />
                      导入备份
                    </button>
                  </div>
                  <p className="hint">
                    {isAndroidApp ? "卸载或清除应用数据会丢失记录。覆盖安装同签名新版可保留记录；更新和换机前仍建议导出备份。" : "卸载或清理浏览器数据可能丢失记录。换设备前请导出备份。"}
                  </p>
                  <button
                    className="button"
                    onClick={async () => {
                      if (isAndroidApp) {
                        notify("当前已是离线安卓版，无需再次安装。请在设置中导出备份后分享给其他设备。");
                        return;
                      }
                      if (installPrompt) {
                        await installPrompt.prompt();
                        setInstallPrompt(null);
                      } else
                        notify(
                          "手机请在浏览器菜单选择“添加到主屏幕”；电脑使用地址栏的安装按钮。需要 HTTPS 或 localhost。",
                        );
                    }}
                  >
                    <Plus size={16} />
                    {isAndroidApp ? "已安装安卓版" : "安装 PMC"}
                  </button>
                </section>
                <section className="panel settings-card data-card">
                  <h2>数据与计算边界</h2>
                  <p>
                    当前数据适用于《宝可梦冠军》1.2.0、排位规则 M-C。计算引擎为非官方工具。
                  </p>
                  <div className="data-summary">
                    <div>
                      <b>{catalog.pokemon.length}</b>
                      <span>可用形态</span>
                    </div>
                    <div>
                      <b>{Object.keys(catalog.moves).length}</b>
                      <span>关联招式</span>
                    </div>
                    <div>
                      <b>{catalog.items.length - 1}</b>
                      <span>可用道具</span>
                    </div>
                  </div>
                  <div className="status-line">
                    <span>游戏版本 / 排位规则</span>
                    <b>{catalog.meta.gameVersion} / {catalog.meta.regulation}</b>
                  </div>
                  <div className="status-line">
                    <span>社区数据快照</span>
                    <b>{sourceVersion}</b>
                  </div>
                  <div className="status-line">
                    <span>冠军引擎</span>
                    <b>
                      {catalog.meta.source.calc.commit.slice(0, 8)} · 专用模式
                    </b>
                  </div>
                  <p className="hint">
                    {language==='ja'
                      ? `M-Bの${rosterAudit.roster.length}件は引き続き有効です。M-Cではポケモン24種とメガシンカ6種が追加され、性別・地域・対戦に影響するフォルムを含めて${mcManifest.pokemon.length}件の設定が増えました。${spriteInfo.count}枚のフォルム画像をキャッシュ済みです。`
                      : language==='ko'
                        ? `M-B의 참가 항목 ${rosterAudit.roster.length}개는 계속 유효합니다. M-C에는 포켓몬 24종과 메가진화 6종이 추가되었고 성별·지역·배틀에 영향을 주는 모습까지 ${mcManifest.pokemon.length}개 설정이 늘었습니다. 모습 이미지 ${spriteInfo.count}장을 캐시했습니다.`
                        : language==='zhHant'
                          ? `M-B 的 ${rosterAudit.roster.length} 個參賽項目仍有效；M-C 新增 24 種寶可夢與 6 種超級進化，依性別、地區及影響對戰的外觀形態展開為 ${mcManifest.pokemon.length} 個配置項。${spriteInfo.count} 張形態圖片已快取。`
                          : <>M-B 的 {rosterAudit.roster.length} 个参赛条目继续有效；M-C 新增 24 种宝可梦和 6 种超级进化，并按性别、地区及可影响对战的外观形态展开为 {mcManifest.pokemon.length} 个配置项。{spriteInfo.count} 张形态图片已缓存。</>}
                  </p>
                  <p className="hint">
                    本计算器只计算当前一回合，不继承上一回合状态，也不模拟下一回合触发。单招试算使用冠军专用引擎。回合计算尚未覆盖全部特殊招式、特性、道具、开局触发与回合末效果；复杂场景会提示限制。剧毒当前按第一回合处理。请勿据此认定游戏内击倒概率。
                  </p>
                  <div className="button-row">
                    <button
                      className="button"
                      onClick={() => setPreview((v) => !v)}
                    >
                      {preview ? "关闭社区试算" : "启用社区试算"}
                    </button>
                    <button
                      className="button"
                      onClick={async () => {
                        if (isAndroidApp) {
                          notify("安卓版通过新版 APK 更新。请从原发布者获取，先导出备份，再直接覆盖安装；不要先卸载。当前版本 1.3.0。");
                          return;
                        }
                        if (!online) {
                          notify("当前离线，联网后可检查更新");
                          return;
                        }
                        try {
                          await registration?.update();
                          notify(
                            registration?.waiting
                              ? "发现新版本，请在顶部确认更新"
                              : "检查完成；当前已是最新数据。",
                          );
                          setUpdateReady(!!registration?.waiting);
                        } catch {
                          notify("更新检查失败，请稍后重试");
                        }
                      }}
                    >
                      <RefreshCw size={15} />
                      {isAndroidApp ? "安卓版更新说明" : "检查更新"}
                    </button>
                  </div>
                  <div className="source-links">
                    <a
                      href={catalog.meta.officialAnnouncement}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      官方公告 / M-C <ArrowUpRight size={13} />
                    </a>
                    <a
                      href={`https://github.com/smogon/damage-calc/tree/${catalog.meta.source.calc.commit}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      计算引擎 / MIT <ArrowUpRight size={13} />
                    </a>
                    <a
                      href={`https://github.com/smogon/pokemon-showdown/tree/${catalog.meta.source.showdown.commit}/data/mods/champions`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      冠军数据分支 / MIT <ArrowUpRight size={13} />
                    </a>
                    <a
                      href="https://github.com/professorsidon/VGC-Damage-Calculator-Chinese"
                      target="_blank"
                      rel="noreferrer"
                    >
                      中文词条来源 <ArrowUpRight size={13} />
                    </a>
                  </div>
                  <small>
                    非官方工具。宝可梦相关角色、图片及名称的权利属于各权利人。公开分发素材许可仍需核实。
                  </small>
                </section>
              </div>
            </>
          )}
        </main>
        <footer>
          <a
            className="discussion-link"
            href={DISCUSSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="加入 QQ 群：卡比兽侠的小屋"
          >
            讨论频道 <ExternalLink size={13} />
          </a>
          <span>
            PMC <span className="footer-slash">/</span> 为每一种配置，找到答案。
          </span>
          <span>本地优先 · PMC {APP_VERSION} · M-C {sourceVersion}</span>
        </footer>
      </div>
      {page === "calc" && (
        <div className="mobile-result">
          <div>
            <small>回合末所剩血量 · 社区试算</small>
            <strong>
              {preview && result && !result.error
                ? range(result.remaining)
                : !preview
                  ? "尚未启用试算"
                  : result?.error
                    ? "该场景存在限制"
                    : "计算中…"}
            </strong>
          </div>
          <button
            className="button primary"
            onClick={() => {
              if (!preview) setPreview(true);
              else
                document
                  .querySelector(".result-panel")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {preview ? "查看结果" : "启用试算"}
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => importFile(e.target.files?.[0])}
      />
      <input
        ref={backgroundRef}
        aria-label="横屏背景文件"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setCustomBackground(file);
          e.target.value = "";
        }}
      />
      <input
        ref={portraitBackgroundRef}
        aria-label="竖屏背景文件"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setCustomBackground(file, "portrait");
          e.target.value = "";
        }}
      />
      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {message}
        </div>
      )}
      {modal && (
        <Dialog
          title={
            {
              saveBuild: "保存宝可梦配置",
              saveScene: "保存当前场景",
              reset: "新建计算",
              load: "从配置库载入",
              import: "确认导入",
              deleteBuild: "删除配置",
              deleteScene: "删除场景",
            }[modal.type]
          }
          onClose={() => setModal(null)}
        >
          {["saveBuild", "saveScene"].includes(modal.type) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                if (modal.type === "saveBuild")
                  setBuilds((b) => [
                    ...b,
                    {
                      ...clone(scene.actors[modal.index]),
                      id: uid(),
                      name: name.trim(),
                    },
                  ]);
                else {
                  const saved = {
                    ...clone(scene),
                    openingRules: OPENING_RULES,
                    id: uid(),
                    name: name.trim(),
                  };
                  setScenes((s) => [...s, saved]);
                  setScene(saved);
                }
                setModal(null);
                notify("已保存在本机");
              }}
            >
              <label className="form-label">
                名称
                <input
                  autoFocus
                  aria-label="保存名称"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：喷火龙 · 晴天特攻"
                />
              </label>
              {(modal.type === "saveBuild" ? builds : scenes).some(
                (x) => x.name === name.trim(),
              ) && (
                <p className="hint warning">
                  已有同名记录。本次会新建一份，不覆盖原记录。
                </p>
              )}
              <p className="hint">
                {modal.type === "saveScene"
                  ? "保存当前配置的独立快照。今后修改配置库，不会改变这份场景。"
                  : "可保存多种配置，数量不限六只。"}
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setModal(null)}
                >
                  取消
                </button>
                {modal.type === "saveBuild" &&
                  builds.some(
                    (b) => b.id === scene.actors[modal.index].originId,
                  ) && (
                    <button
                      type="button"
                      className="button"
                      disabled={!name.trim()}
                      onClick={() => {
                        const id = scene.actors[modal.index].originId;
                        setBuilds((list) =>
                          list.map((b) =>
                            b.id === id
                              ? {
                                  ...clone(scene.actors[modal.index]),
                                  id,
                                  name: name.trim(),
                                }
                              : b,
                          ),
                        );
                        setModal(null);
                        notify("原配置已更新，已保存场景保持不变");
                      }}
                    >
                      更新原配置
                    </button>
                  )}
                <button type="submit" className="button primary">
                  <Save size={16} />
                  保存
                </button>
              </div>
            </form>
          )}
          {modal.type === "reset" && (
            <>
              <p>当前计算现场将恢复默认。配置库和已保存场景不会改变。</p>
              <div className="modal-actions">
                <button className="button" onClick={() => setModal(null)}>
                  取消
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    setScene(defaultScene(catalog));
                    setModal(null);
                  }}
                >
                  新建计算
                </button>
              </div>
            </>
          )}
          {modal.type === "load" && (
            <>
              <label className="search-box">
                <Search size={18} />
                <input
                  aria-label="搜索待载入配置"
                  placeholder="名称或宝可梦"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="option-list">
                {filteredBuilds.map((b) => (
                  <button
                    className="option"
                    key={b.id}
                    onClick={() => {
                      updateActor(modal.index, {
                        ...clone(b),
                        id: uid(),
                        originId: b.id,
                      });
                      setModal(null);
                    }}
                  >
                    <Sprite species={b.species} small />
                    <span>
                      <strong>{b.name}</strong>
                      <small>
                        {pMap[b.species]?.zh} · {b.id.slice(0, 6)}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
                {builds.length === 0 && (
                  <p className="empty-small">
                    配置库为空，请先保存宝可梦配置。
                  </p>
                )}
              </div>
            </>
          )}
          {modal.type === "import" && (
            <>
              <p>
                文件包含 {modal.data.builds.length} 个配置、
                {modal.data.scenes.length} 个场景、{modal.data.teams.length} 支已保存队伍。
              </p>
              <p className="hint">
                将跳过 {modal.skipped} 条完全重复的记录。发现 {modal.conflicts}{" "}
                条同一标识但内容不同的记录。
              </p>
              <p className="hint">
                已失效的条目仍保留，计算时提示修正。现有配置库不会清空。
              </p>
              <div className="modal-actions">
                <button className="button" onClick={() => setModal(null)}>
                  取消
                </button>
                {modal.conflicts > 0 && (
                  <button
                    className="button"
                    onClick={() => applyImport("overwrite")}
                  >
                    覆盖冲突记录
                  </button>
                )}
                <button
                  className="button primary"
                  onClick={() => applyImport("copy")}
                >
                  {modal.conflicts ? "保留双方副本并导入" : "确认导入"}
                </button>
              </div>
            </>
          )}
          {["deleteBuild", "deleteScene"].includes(modal.type) && (
            <>
              <p>删除“{modal.label}”？删除前可以先取消并导出备份。</p>
              {modal.type === "deleteBuild" && (
                <p className="hint">已保存场景中的配置快照不受影响。</p>
              )}
              <div className="modal-actions">
                <button className="button" onClick={() => setModal(null)}>
                  取消
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    if (modal.type === "deleteBuild") {
                      setBuilds((b) => b.filter((x) => x.id !== modal.id));
                      setSelected((s) => s.filter((id) => id !== modal.id));
                    } else setScenes((s) => s.filter((x) => x.id !== modal.id));
                    setModal(null);
                    notify("记录已删除；已有导出备份可用于恢复");
                  }}
                >
                  确认删除
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </AliasContext.Provider>
  );
}
