import React, { useState } from 'react';
import { Image as ImageIcon, Upload, Info, ChevronDown } from 'lucide-react';
import { mergeTeamScreenshots, POINT_KEYS } from './team-image-import.mjs';
import { validateBuild, setPointWithinLimit } from './model.mjs';
import { localizedName } from './localization.mjs';
import { translateText } from './localization.mjs';
import { RESIST_BERRY_TYPES } from './engine.mjs';
import { TYPES } from './model.mjs';

const WORDS = {
  zhHans: ['从游戏截图导入', '选择一张或两张完整队伍截图。系统会判断“能力／状态”页面；识别结果须预览确认。', '选择截图', '开始识别', '自动判断', '能力：招式／特性／道具', '状态：性格／能力点', '识别预览', '待核对', '我已核对待确认的字段', '确认覆盖当前编辑队伍', '取消预览', '识别中…', '不确定的字段使用默认值，请在确认前核对。已保存的队伍不受影响。', '截图类型无法确定，请手动选择后重试。', '能力点', '特性', '道具', '性格', '招式', '宝可梦'],
  zhHant: ['從遊戲截圖匯入', '選擇一張或兩張完整隊伍截圖。系統會判斷「能力／狀態」頁面；請先預覽並確認識別結果。', '選擇截圖', '開始識別', '自動判斷', '能力：招式／特性／道具', '狀態：性格／能力點', '識別預覽', '待核對', '我已核對待確認的欄位', '確認覆蓋目前編輯隊伍', '取消預覽', '識別中…', '不確定的欄位會使用預設值，請在確認前核對。已儲存的隊伍不受影響。', '無法判斷截圖類型，請手動選擇後重試。', '能力點', '特性', '道具', '性格', '招式', '寶可夢'],
  ja: ['ゲーム画面からチームを読み込む', 'チーム全体が写った画像を1～2枚選択します。「能力／状態」を自動判定し、読み込み前に確認できます。', '画像を選択', '認識を開始', '自動判定', '能力：技／特性／持ち物', '状態：性格／能力ポイント', '認識結果の確認', '要確認', '不明な項目を確認しました', '編集中のチームに反映', '確認をやめる', '認識中…', '不明な項目には初期値が入ります。反映前に確認してください。保存済みのチームは変更されません。', '画面の種類を判定できません。手動で指定して再試行してください。', '能力ポイント', '特性', '持ち物', '性格', '技', 'ポケモン'],
  ko: ['게임 스크린샷에서 팀 불러오기', '팀 전체가 보이는 이미지 1~2장을 선택하세요. 능력/상태 화면을 자동 판별하며 적용 전에 확인할 수 있습니다.', '이미지 선택', '인식 시작', '자동 판별', '능력: 기술/특성/도구', '상태: 성격/능력 포인트', '인식 결과 확인', '확인 필요', '불확실한 항목을 확인했습니다', '편집 중인 팀에 적용', '미리보기 취소', '인식 중…', '불확실한 항목은 기본값으로 설정됩니다. 적용 전에 확인하세요. 저장된 팀은 바뀌지 않습니다.', '화면 종류를 판별하지 못했습니다. 수동으로 선택한 뒤 다시 시도하세요.', '능력 포인트', '특성', '도구', '성격', '기술', '포켓몬'],
  en: ['Import team screenshots', 'Choose one or two full team screenshots. Ability and Status pages are detected automatically; review the result before applying.', 'Choose screenshots', 'Recognize', 'Detect automatically', 'Ability: moves / ability / item', 'Status: nature / Stat Points', 'Import preview', 'Review', 'I checked the uncertain fields', 'Replace the team I am editing', 'Cancel preview', 'Recognizing…', 'Uncertain fields use defaults. Check them before applying. Saved teams stay unchanged.', 'Could not detect the screenshot type. Select it manually and retry.', 'Stat Points', 'Ability', 'Item', 'Nature', 'Moves', 'Pokémon'],
};

const STAT_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const OCR_ERRORS = {
  '请只选择一张或两张截图':['請只選擇一張或兩張截圖','画像は1枚か2枚だけ選んでください。','이미지는 한 장 또는 두 장만 선택하세요.','Choose one or two screenshots only.'],
  '请导入一张或两张队伍截图':['請匯入一張或兩張隊伍截圖','チーム画像を1枚か2枚選んでください。','팀 스크린샷을 한 장 또는 두 장 선택하세요.','Import one or two team screenshots.'],
  '请先确认每张截图属于“能力”或“状态”页':['請先確認每張截圖屬於「能力」或「狀態」頁','各画像を「能力」または「状態」に指定してください。','각 이미지를 능력 또는 상태 화면으로 지정하세요.','Choose Ability or Status for each screenshot.'],
  '截图含有重复或无法区分的宝可梦；当前队伍未被覆盖':['截圖含有重複或無法區分的寶可夢；目前隊伍未被覆蓋','重複または区別できないポケモンがいます。現在のチームは変更していません。','중복되거나 구별할 수 없는 포켓몬이 있습니다. 현재 팀은 변경되지 않았습니다.','The screenshot has duplicate or indistinguishable Pokémon. Your current team was not changed.'],
  '请选择 PNG、JPG 或其他常见图片格式':['請選擇 PNG、JPG 或其他常見圖片格式','PNG、JPGなどの画像を選んでください。','PNG, JPG 등 일반적인 이미지 형식을 선택하세요.','Choose a PNG, JPG, or another common image format.'],
  '截图比例与游戏六人队伍界面不符；请使用完整游戏截图':['截圖比例與遊戲六人隊伍畫面不符；請使用完整遊戲截圖','画像の縦横比がチーム画面と異なります。画面全体の画像を使用してください。','이미지 비율이 게임 팀 화면과 다릅니다. 전체 화면 스크린샷을 사용하세요.','The image aspect ratio does not match the team screen. Use a full game screenshot.'],
  '无法确定这张图是“能力”还是“状态”页；请手动指定类型后重试':['無法判斷這張圖是「能力」或「狀態」頁；請手動指定類型後重試','「能力」か「状態」か判定できません。種類を指定して再試行してください。','능력 또는 상태 화면인지 판별할 수 없습니다. 종류를 지정하고 다시 시도하세요.','Could not tell whether this is an Ability or Status page. Choose the type and retry.'],
  '两张截图不是完全相同的六人队伍；当前队伍未被覆盖': ['兩張截圖不是完全相同的六人隊伍；目前隊伍未被覆蓋','2枚の画像は同じ6匹のチームではありません。現在のチームは変更していません。','두 이미지의 6마리 팀이 서로 다릅니다. 현재 팀은 변경되지 않았습니다.','The two screenshots show different six-Pokémon teams. Your current team was not changed.'],
  '截图中无法确认完整的六只宝可梦；当前队伍未被覆盖': ['無法在截圖中確認完整六隻寶可夢；目前隊伍未被覆蓋','6匹すべてを確認できません。現在のチームは変更していません。','스크린샷에서 6마리 모두 확인할 수 없습니다. 현재 팀은 변경되지 않았습니다.','Could not identify all six Pokémon. Your current team was not changed.'],
  '无法可靠识别完整六人队伍；当前队伍未被覆盖': ['無法可靠辨識完整六人隊伍；目前隊伍未被覆蓋','6匹全員を確実に認識できません。現在のチームは変更していません。','6마리 팀 전체를 확실히 인식할 수 없습니다. 현재 팀은 변경되지 않았습니다.','Could not reliably identify the full team. Your current team was not changed.'],
  '两张截图必须分别是“能力”和“状态”页': ['兩張截圖須分別為「能力」和「狀態」頁','2枚の画像は「能力」と「状態」を1枚ずつ選んでください。','두 이미지는 각각 능력 화면과 상태 화면이어야 합니다.','Choose one Ability page and one Status page.'],
};
function localizedError(message,language) {
  const index={zhHant:0,ja:1,ko:2,en:3}[language];
  return index===undefined?message:OCR_ERRORS[message]?.[index]||message;
}

export default function TeamImageImport({ catalog, language, onImport, disabled = false }) {
  const words = WORDS[language] || WORDS.en;
  const [files, setFiles] = useState([]);
  const [types, setTypes] = useState(['', '']);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const name = (kind, entry) => {
    if (!entry) return '';
    if (kind === 'items' && !entry.name) return ({zhHans:'不携带道具',zhHant:'不攜帶道具',ja:'もちものなし',ko:'도구 없음',en:'No item'}[language] || 'No item');
    const base=localizedName(kind, entry.id, language) || (language === 'zhHans' ? entry.zh : entry.name) || entry.zh || entry.name || '';
    const type=kind==='items'&&RESIST_BERRY_TYPES[entry.name];
    if (!type) return base;
    const typeName=language==='en'?type:translateText(TYPES[type],language);
    const suffix=language==='ja'?`耐性：${typeName}`:language==='ko'?`저항 ${typeName}`:language==='en'?`Resists ${typeName}`:`抵抗${typeName}`;
    return language==='en'?`${base} (${suffix})`:`${base}（${suffix}）`;
  };
  const reviewName = field => field === 'pointsTotal' ? `${words[15]} Σ` : POINT_KEYS.includes(field) ? STAT_LABELS[field] : field.startsWith('move') ? `${words[19]} ${Number(field.slice(4)) + 1}` : ({ability:words[16],item:words[17],nature:words[18]})[field] || field;
  const update = (index, patch) => setPreview(current => current.map((row, i) => i === index ? { ...row, build: { ...row.build, ...patch } } : row));

  async function recognize() {
    if (!files.length || files.length > 2) return;
    setError(''); setPreview(null); setBusy(true); setChecked(false);
    try {
      const { scanTeamImage } = await import('./team-image-ocr.mjs');
      const scans = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setProgress(`${index + 1}/${files.length} · ${file.name}`);
        scans.push(await scanTeamImage(file, catalog, {
          forcedKind: types[index] || null, preferredLanguage: language,
          onProgress: () => setProgress(`${index + 1}/${files.length} · ${words[12]}`),
        }));
      }
      setPreview(mergeTeamScreenshots(scans, catalog));
    } catch (cause) {
      const original=cause.message || String(cause),message=localizedError(original,language);
      setError(message);
      if(original.includes('不是完全相同的六人队伍'))window.alert(message);
    } finally { setBusy(false); setProgress(''); }
  }

  function confirmImport() {
    if (!preview) return;
    const problems = preview.flatMap((row, index) => validateBuild(row.build, catalog).map(issue => `${index + 1}: ${issue}`));
    if (problems.length) { setError(problems.join('；')); return; }
    if (preview.some(row => row.review.length) && !checked) return;
    onImport(preview.map(row => row.build));
    setPreview(null); setFiles([]); setTypes(['', '']); setChecked(false); setError('');
  }

  return <details className="panel team-image-import">
    <summary><ImageIcon size={19}/><span><b>{words[0]}</b><small>{words[1]}</small></span><ChevronDown size={17}/></summary>
    <div className="team-image-body">
      <div className="team-image-toolbar">
        <label className="button team-image-file"><Upload size={16}/>{words[2]}<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event=>{const selected=Array.from(event.target.files || []);setFiles(selected);setTypes(['','']);setPreview(null);setError(selected.length > 2 ? localizedError('请只选择一张或两张截图',language) : '');event.target.value='';}}/></label>
        <span>{files.map(file => file.name).join(' · ')}</span>
        <button className="button primary" disabled={disabled || busy || files.length < 1 || files.length > 2} onClick={recognize}>{busy ? words[12] : words[3]}</button>
      </div>
      {files.map((file,index)=><label className="team-image-type" key={`${file.name}-${index}`}><span>{file.name}</span><select value={types[index] || ''} disabled={busy} onChange={event=>setTypes(current=>current.map((value,i)=>i===index?event.target.value:value))}><option value="">{words[4]}</option><option value="ability">{words[5]}</option><option value="status">{words[6]}</option></select></label>)}
      {progress&&<p className="team-image-progress" role="status">{progress}</p>}
      {error&&<p className="team-image-error" role="alert"><Info size={15}/>{error}</p>}
      {preview&&<div className="team-image-preview"><div className="section-title"><h2>{words[7]}</h2><span>{preview.length}/6</span></div><p className="hint">{words[13]}</p>
        <div className="team-image-preview-grid">{preview.map((row,index)=>{
          const {build,review}=row, pokemon=catalog.pokemon.find(entry=>entry.id===build.species);
          const option = (entry, kind) => <option key={entry.id} value={kind === 'moves' ? entry.id : entry.name}>{name(kind, entry)}</option>;
          const total=POINT_KEYS.reduce((sum,key)=>sum+build.points[key],0);
          return <article key={`${build.species}-${index}`} className="team-image-preview-card"><header><b>{index+1}. {name('pokemon',pokemon)}</b>{review.length>0&&<small>{words[8]}：{review.map(reviewName).join(' · ')}</small>}</header>
            <div className="team-image-preview-fields"><label>{words[16]}<select value={build.ability} onChange={event=>update(index,{ability:event.target.value})}>{pokemon.abilities.map(value=>option(catalog.abilities.find(entry=>entry.name===value),'abilities'))}</select></label>
              <label>{words[17]}<select value={build.item} onChange={event=>update(index,{item:event.target.value})}>{catalog.items.map(entry=>option(entry,'items'))}</select></label>
              <label>{words[18]}<select value={build.nature} onChange={event=>update(index,{nature:event.target.value})}>{catalog.natures.map(entry=>option(entry,'natures'))}</select></label>
              <div className="team-image-preview-moves"><b>{words[19]}</b>{build.moves.map((id,moveIndex)=><select key={moveIndex} aria-label={`${words[19]} ${moveIndex+1}`} value={id} onChange={event=>update(index,{moves:build.moves.map((value,i)=>i===moveIndex?event.target.value:value)})}><option value="">—</option>{pokemon.moves.map(value=>option(catalog.moves[value],'moves'))}</select>)}</div>
              <div className="team-image-preview-points"><b className={total>66?'error-text':''}>{words[15]} {total}/66</b>{POINT_KEYS.map(key=><label key={key}>{STAT_LABELS[key]}<input type="number" min="0" max="32" value={build.points[key]} onChange={event=>update(index,{points:setPointWithinLimit(build.points,key,event.target.value)})}/></label>)}</div>
            </div>
          </article>;
        })}</div>
        {preview.some(row=>row.review.length)&&<label className="team-image-ack"><input type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)}/>{words[9]}</label>}
        <div className="team-image-actions"><button className="button" onClick={()=>{setPreview(null);setChecked(false);}}>{words[11]}</button><button className="button primary" disabled={disabled || (preview.some(row=>row.review.length)&&!checked)} onClick={confirmImport}>{words[10]}</button></div>
      </div>}
    </div>
  </details>;
}
