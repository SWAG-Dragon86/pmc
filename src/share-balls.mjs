import data from './data/share-balls.json' with {type:'json'};

export const SHARE_BALL_KEY='pmc.share-ball.v1';
export const shareBalls=data.balls;
const palettes={
  'poke-ball':['#c13b40','#ef6b65','#f6e9e4'],
  'great-ball':['#285cac','#347cdd','#e95957'],
  'ultra-ball':['#69551d','#353940','#e7bd45'],
  'master-ball':['#7353a3','#8c6bbb','#e77cac'],
  'safari-ball':['#626b37','#859257','#b09a68'],
  'park-ball':['#87610f','#e9bf44','#f5ebc8'],
  'sport-ball':['#b94332','#e85c45','#eee7df'],
  'net-ball':['#187d85','#2ba6ad','#354953'],
  'dive-ball':['#216bb3','#46ace2','#90d8f0'],
  'nest-ball':['#51833b','#80b760','#ebd264'],
  'repeat-ball':['#a9482d','#e96742','#efd168'],
  'timer-ball':['#9c4340','#e3645c','#65717e'],
  'luxury-ball':['#5f4a20','#414047','#d5aa4b'],
  'premier-ball':['#a94a48','#e7736f','#eceff3'],
  'dusk-ball':['#33774c','#3d9761','#e69b45'],
  'heal-ball':['#ad5587','#e391b7','#78b7d3'],
  'quick-ball':['#2671af','#3c94d5','#f2d55c'],
  'cherish-ball':['#a93243','#d83d54','#702e3b'],
  'dream-ball':['#925b95','#c18fc1','#ef96be'],
  'beast-ball':['#2c5b9d','#3678cb','#e9ce78'],
  'lure-ball':['#317f9d','#51acc4','#e76c62'],
  'level-ball':['#735323','#474447','#e5bf55'],
  'moon-ball':['#386688','#528cac','#e8c66a'],
  'heavy-ball':['#4d627a','#7d91ad','#c4ccd6'],
  'fast-ball':['#ab4938','#e16d51','#eed072'],
  'friend-ball':['#4c813d','#88b863','#ead26b'],
  'love-ball':['#b35f8c','#e593bc','#fae6ef'],
  'lapoke-ball':['#a44834','#ca6650','#a99472'],
  'lagreat-ball':['#396b91','#4d96bc','#a99870'],
  'laultra-ball':['#725926','#4b4843','#c7a347'],
  'laheavy-ball':['#4a596f','#79879a','#9f8d68'],
  'laleaden-ball':['#3e596c','#6f95a5','#a39374'],
  'lagigaton-ball':['#425f79','#6d91ab','#d5b558'],
  'lafeather-ball':['#386f88','#6ba7bd','#c8d2c4'],
  'lawing-ball':['#467984','#8db6b8','#cfd7bb'],
  'lajet-ball':['#45668b','#6a90b8','#c9d2d8'],
  'laorigin-ball':['#a63f30','#cb5a48','#dbc88e'],
};
export function selectedShareBall(value) {return shareBalls.find(ball=>ball.name===value)||shareBalls.find(ball=>ball.name==='poke-ball');}
export function ballPalette(value) {
  const [accent,primary,secondary]=palettes[selectedShareBall(value).name];
  return {accent,primary,secondary};
}
export function ballName(ball,language) {
  const key={zhHans:'zh-hans',zhHant:'zh-hant',ja:'ja',ko:'ko',en:'en'}[language]||'en';
  const name=ball.names[key]||ball.names.en;
  return ball.name.startsWith('la') ? `${name} (${{zhHans:'洗翠',zhHant:'洗翠',ja:'ヒスイ',ko:'히스이',en:'Hisui'}[language]||'Hisui'})` : name;
}
