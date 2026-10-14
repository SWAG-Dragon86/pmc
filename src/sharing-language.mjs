import { localizedName, translateText } from './localization.mjs';

// New sharing and result labels have explicit translations in all five UI languages.
const rows = {
  ballTheme: ['分享图片的精灵球风格','分享圖片的精靈球風格','共有画像のボールテーマ','공유 이미지의 볼 테마','Poké Ball theme for sharing images'],
  storageFailed: ['设置已更改，但本机空间不足，无法保存。','設定已更改，但本機空間不足，無法儲存。','設定は変更されましたが、端末の空き容量不足で保存できません。','설정은 변경되었지만 기기 공간 부족으로 저장할 수 없습니다.','Setting changed, but there is not enough device storage to save it.'],
  ballThemeHint: ['选择精灵球，导出图片会使用对应的配色和球图。选择保存在本机。','選擇精靈球，匯出圖片會使用對應的配色和球圖。選擇儲存在本機。','ボールを選ぶと、書き出す画像の配色とボール画像が変わります。選択は端末に保存されます。','볼을 선택하면 내보내는 이미지의 색상과 볼 그림이 바뀝니다. 선택은 기기에 저장됩니다.','Choose a ball to set the colors and ball image in your exports. Your choice is saved on this device.'],
  share: ['分享／导出','分享／匯出','共有・書き出し','공유/내보내기','Share / export'],
  import: ['导入分享','匯入分享','共有データを読み込む','공유 데이터 가져오기','Import shared data'],
  exportImage: ['保存分享图片','儲存分享圖片','共有画像を保存','공유 이미지 저장','Save sharing image'],
  copyCode: ['复制分享码','複製分享碼','共有コードをコピー','공유 코드 복사','Copy share code'],
  copied: ['分享码已复制','分享碼已複製','共有コードをコピーしました','공유 코드를 복사했습니다','Share code copied'],
  paste: ['粘贴 PMC 分享码','貼上 PMC 分享碼','PMC共有コードを貼り付け','PMC 공유 코드 붙여넣기','Paste a PMC share code'],
  chooseImage: ['选择二维码图片','選擇二維碼圖片','QRコード画像を選択','QR 이미지 선택','Choose a QR image'],
  camera: ['摄像头扫码','相機掃碼','カメラで読み取る','카메라로 스캔','Scan with camera'],
  stopCamera: ['关闭摄像头','關閉相機','カメラを閉じる','카메라 닫기','Stop camera'],
  close: ['关闭','關閉','閉じる','닫기','Close'],
  preview: ['导入预览','匯入預覽','読み込みプレビュー','가져오기 미리보기','Import preview'],
  confirm: ['确认保存','確認儲存','確認して保存','확인 후 저장','Confirm and save'],
  readCode: ['读取分享码','讀取分享碼','共有コードを読む','공유 코드 읽기','Read share code'],
  build: ['宝可梦配置','寶可夢配置','ポケモンの設定','포켓몬 설정','Pokémon build'],
  team: ['六人队伍','六隻隊伍','6匹のチーム','6마리 팀','Six-Pokémon team'],
  scene: ['对战场景','對戰場景','対戦の設定','배틀 설정','Battle scene'],
  moves: ['招式','招式','わざ','기술','Moves'],
  ability: ['特性','特性','特性','특성','Ability'],
  item: ['道具','道具','持ち物','도구','Item'],
  nature: ['性格','性格','性格','성격','Nature'],
  stats: ['实际能力值','實際能力值','実数値','실제 능력치','Actual stats'],
  points: ['能力点','能力點','能力ポイント','능력 포인트','Stat Points'],
  empty: ['空招式栏','空招式欄','わざなし','빈 기술 칸','Empty move slot'],
  noItem: ['不携带道具','不攜帶道具','持ち物なし','도구 없음','No item'],
  attack: ['进攻方','進攻方','攻撃側','공격측','Attacking side'],
  defend: ['防守方','防守方','防御側','방어측','Defending side'],
  target: ['攻击目标','攻擊目標','攻撃対象','공격 대상','Attack target'],
  inactive: ['本回合不出招','本回合不出招','このターンは行動しない','이번 턴 행동하지 않음','No action this turn'],
  selected: ['本回合使用','本回合使用','このターンに使用','이번 턴 사용','Use this turn'],
  statusMove: ['变化招式','變化招式','変化わざ','변화 기술','Status move'],
  sureKO: ['一击必倒','一擊必倒','一撃で確定','한 번에 확정 기절','Guaranteed one-hit KO'],
  possibleKO: ['可能一击击倒','可能一擊擊倒','一撃で倒せる可能性','한 번에 기절 가능','Possible one-hit KO'],
  ko: ['一击击倒概率','一擊擊倒機率','一撃で倒せる確率','한 번에 기절할 확률','One-hit KO chance'],
  pending: ['需启用试算／核对配置','需啟用試算／核對配置','試算を有効にして設定を確認','계산 활성화/설정 확인 필요','Enable calculation / check build'],
  previewHint: ['确认后保存到本机，当前编辑内容不会被覆盖。','確認後儲存到本機，目前編輯內容不會被覆蓋。','確認後に端末へ保存します。編集中の内容は上書きしません。','확인 후 기기에 저장하며 편집 중인 내용은 덮어쓰지 않습니다.','Save locally after review. Your current edits will stay intact.'],
  codeHint: ['分享码包含完整配置，无需服务器；支持图片识码或摄像头扫描。','分享碼包含完整配置，無須伺服器；支援圖片識碼或相機掃描。','コードに設定全体を保存。サーバー不要で、画像やカメラから読み込めます。','코드에 전체 설정이 포함됩니다. 서버 없이 이미지나 카메라로 읽을 수 있습니다.','The code contains the full configuration. Import its image or scan it without a server.'],
  qrCaption: ['在 PMC 中导入此二维码','在 PMC 中匯入此二維碼','PMCでこのQRコードを読み込む','PMC에서 QR 코드 가져오기','Import this QR code in PMC'],
  loading: ['正在准备…','正在準備…','準備中…','준비 중…','Preparing…'],
  saved: ['分享图片已生成','分享圖片已產生','共有画像を生成しました','공유 이미지가 생성되었습니다','Sharing image generated'],
  imported: ['已保存分享配置，请在对应页面载入。','已儲存分享配置，請在對應頁面載入。','保存しました。対応するページから読み込んでください。','저장했습니다. 해당 페이지에서 불러오세요.','Saved. Load it from the corresponding page.'],
  cameraUnavailable: ['当前环境不支持摄像头，请选择二维码图片。','目前環境不支援相機，請選擇二維碼圖片。','この環境ではカメラを利用できません。画像を選択してください。','현재 환경에서 카메라를 사용할 수 없습니다. 이미지를 선택하세요.','Camera unavailable here. Choose a QR image instead.'],
  cameraDenied: ['无法打开摄像头，请检查相机权限或选择图片。','無法開啟相機，請檢查相機權限或選擇圖片。','カメラを開けません。権限を確認するか画像を選択してください。','카메라를 열 수 없습니다. 권한을 확인하거나 이미지를 선택하세요.','Could not open the camera. Check permission or choose an image.'],
  imageNoCode: ['图片中没有找到可读的 PMC 二维码。','圖片中沒有找到可讀的 PMC 二維碼。','読み取れるPMCのQRコードが見つかりません。','읽을 수 있는 PMC QR 코드를 찾지 못했습니다.','No readable PMC QR code found in this image.'],
  invalidCode: ['分享码无效、内容损坏或配置不适用于当前版本。','分享碼無效、內容損壞或配置不適用於目前版本。','コードが無効、破損、または現在のバージョンに非対応です。','코드가 잘못되었거나 손상되었으며 현재 버전과 호환되지 않습니다.','Invalid, damaged, or incompatible share code.'],
  tooLarge: ['分享内容过大，请缩短名称后重试。','分享內容過大，請縮短名稱後重試。','共有データが大きすぎます。名前を短くして再試行してください。','공유 데이터가 너무 큽니다. 이름을 줄이고 다시 시도하세요.','Shared data is too large. Shorten the names and retry.'],
  imageTooLarge: ['图片过大，请选择较小的原图。','圖片過大，請選擇較小的原圖。','画像が大きすぎます。小さい画像を選択してください。','이미지가 너무 큽니다. 더 작은 이미지를 선택하세요.','Image too large. Choose a smaller image.'],
  codeLabel: ['完整配置分享码','完整配置分享碼','設定全体の共有コード','전체 설정 공유 코드','Full configuration share code'],
  updated: ['已更新队伍','已更新隊伍','チームを更新しました','팀을 업데이트했습니다','Teams updated'],
  latest: ['当前队伍已是最新','目前隊伍已是最新','チームは最新です','팀이 최신 상태입니다','Teams are up to date'],
  checkedAt: ['最近联网检查','最近聯網檢查','前回のオンライン確認','최근 온라인 확인','Last online check'],
  sourceUpdated: ['队伍数据更新时间','隊伍資料更新時間','チームデータの更新日時','팀 데이터 업데이트 시간','Team data updated'],
  updateFailed: ['联网更新失败，继续使用本机队伍。','聯網更新失敗，繼續使用本機隊伍。','オンライン更新に失敗。端末のチームを使用します。','온라인 업데이트 실패. 저장된 팀을 계속 사용합니다.','Online update failed. Using your locally saved teams.'],
  checking: ['正在检查队伍更新…','正在檢查隊伍更新…','チームの更新を確認中…','팀 업데이트 확인 중…','Checking for team updates…'],
  count: ['支队伍','支隊伍','チーム','개 팀','teams'],
  readonly: ['此席位当前不出招','此位置目前不出招','この枠は現在行動しません','이 슬롯은 현재 행동하지 않음','This slot currently does not act'],
  activate: ['参与本回合行动','參與本回合行動','このターンに行動する','이번 턴 행동에 참여','Act this turn'],
};
const languages = ['zhHans','zhHant','ja','ko','en'];
export const sharingWords = rows;
export function shareText(key, language = 'zhHans') { return rows[key]?.[languages.indexOf(language)] || rows[key]?.[4] || key; }
export function gameName(kind, entry, language) {
  if (!entry) return '';
  return localizedName(kind, entry.id || entry.name, language) || (language === 'en' ? entry.name : entry.zh) || entry.name || entry.id;
}
export function buildName(build, catalog, language) {
  const species = catalog.pokemon.find(p => p.id === build.species);
  if (!build.name || [species?.zh, species?.name].includes(build.name)) return gameName('pokemon', species, language);
  return translateText(build.name, language);
}
export function localTime(value, language) {
  if (!value) return '—';
  const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly?`${value}T12:00:00`:value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat({zhHans:'zh-CN',zhHant:'zh-TW',ja:'ja-JP',ko:'ko-KR',en:'en-GB'}[language],
    {year:'numeric',month:'2-digit',day:'2-digit',...(!dateOnly?{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}:{})}).format(date);
}
