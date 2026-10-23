import QRCode from 'qrcode';
import { encodeShare } from './share-code.mjs';
import { statsOf, RESIST_BERRY_TYPES } from './engine.mjs';
import { STAT_KEYS, STAT_NAMES, TYPES, activeIndices } from './model.mjs';
import { buildReport } from './report.mjs';
import { battleCards } from './battle-view.mjs';
import { shareText, gameName, buildName } from './sharing-language.mjs';
import { translateText, prepareLanguage } from './localization.mjs';
import { selectedShareBall, ballPalette } from './share-balls.mjs';
import { typeName } from './move-types.mjs';
import artworkCredits from './data/artwork-attribution.json' with {type:'json'};
import { pngWithArtworkCredit } from './png-artwork.mjs';

const ink='#292a30', muted='#686d78', red='#b83238', line='#e9ebef';
const font='"PingFang SC","Yu Gothic","Malgun Gothic","Microsoft YaHei",system-ui,sans-serif';
const images=new Map();
async function asset(path) {
  if (!images.has(path)) images.set(path,new Promise(resolve=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);
    image.src=new URL(path,document.baseURI).href;
  }));
  return images.get(path);
}
const sprite=species=>asset(`sprites/${species}.png`);
function imageBuildName(build,catalog,language) {
  const species=catalog.pokemon.find(p=>p.id===build.species);
  // Public builds used to append the player's name; hide that generated suffix in images.
  if(species&&build.name?.startsWith(`${species.zh} · `))return gameName('pokemon',species,language);
  return buildName(build,catalog,language);
}
function box(ctx,x,y,width,height,color='#fff',radius=24,border=line) {
  ctx.beginPath();ctx.roundRect(x,y,width,height,radius);ctx.fillStyle=color;ctx.fill();
  if(border){ctx.strokeStyle=border;ctx.lineWidth=2;ctx.stroke();}
}
function text(ctx,value,x,y,size=32,width=1000,color=ink,weight=550) {
  ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=color;ctx.textBaseline='top';
  let output=String(value??'');
  while(output.length&&ctx.measureText(output).width>width) output=output.slice(0,-1);
  if(output!==String(value??'')) output=output.slice(0,-1)+'…';
  ctx.fillText(output,x,y);
  return output;
}
function wrap(ctx,value,width,size=32,weight=500) {
  ctx.font=`${weight} ${size}px ${font}`;const lines=[];let row='';
  for(const character of String(value??'')) {
    if(character==='\n'||(row&&ctx.measureText(row+character).width>width)){lines.push(row);row=character==='\n'?'':character;}
    else row+=character;
  }
  if(row)lines.push(row);return lines;
}
function picture(ctx,image,x,y,width,height) {
  if(!image)return;
  const scale=Math.min(width/image.width,height/image.height);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,x+(width-image.width*scale)/2,y+(height-image.height*scale)/2,image.width*scale,image.height*scale);
  ctx.imageSmoothingEnabled=true;
}
function statLabel(key,language) {return language==='en'?{hp:'HP',atk:'Atk',def:'Def',spa:'SpA',spd:'SpD',spe:'Spe'}[key]:translateText(STAT_NAMES[key],language);}
function itemLabel(build,catalog,language) {
  const item=catalog.items.find(entry=>entry.name===build.item);
  if(!build.item)return shareText('noItem',language);
  const base=gameName('items',item,language),type=RESIST_BERRY_TYPES[build.item];
  if(!type)return base;
  const attribute=language==='en'?type:translateText(TYPES[type],language);
  const prefix={zhHans:'抵抗',zhHant:'抵抗',ja:'耐性：',ko:'저항 ',en:'Resists '}[language];
  return `${base} (${prefix}${attribute})`;
}
function traits(ctx,build,catalog,language,x,y,width,size) {
  const t=key=>shareText(key,language);
  text(ctx,`${t('ability')} · ${gameName('abilities',catalog.abilities.find(a=>a.name===build.ability),language)}`,x,y,size,width);
  text(ctx,`${t('item')} · ${itemLabel(build,catalog,language)}`,x,y+size*1.6,size,width);
}
function stats(ctx,build,catalog,language,x,y,width,rowHeight,size) {
  const accent=ctx.shareTheme.accent;
  const values=statsOf(build,catalog),nature=catalog.natures.find(n=>n.name===build.nature);
  STAT_KEYS.forEach((key,index)=>{
    const top=y+index*rowHeight,boosted=nature.plus!==nature.minus;
    text(ctx,statLabel(key,language),x,top,size,width*.4,muted);
    text(ctx,`${values[key]}${boosted&&nature.plus===key?' ↑':boosted&&nature.minus===key?' ↓':''}`,x+width*.36,top,size,width*.3,
      boosted&&nature.plus===key?red:boosted&&nature.minus===key?'#4585bb':ink,700);
    box(ctx,x+width*.65,top+size*.45,width*.16,8,'#eceef2',4,null);
    const points=build.points[key];if(points)box(ctx,x+width*.65,top+size*.45,width*.16*points/32,8,accent,4,null);
    text(ctx,points,x+width*.84,top,size,width*.16,accent,700);
  });
}
async function buildCard(ctx,build,catalog,language,x,y,width,height,large=false) {
  const accent=ctx.shareTheme.accent;
  const t=key=>shareText(key,language),species=catalog.pokemon.find(p=>p.id===build.species);
  const compact=!large&&height<400,size=large?40:compact?22:26,pad=large?44:24;
  if(compact)return teamCard(ctx,build,catalog,language,x,y,width,height);
  box(ctx,x,y,width,height,'#fff',large?32:22);
  if(!large){
    text(ctx,imageBuildName(build,catalog,language),x+pad,y+15,32,width-160,accent,750);
    picture(ctx,await sprite(build.species),x+width-120,y+10,90,64);
    species.types.forEach((type,index)=>picture(ctx,images.get(`types/${type.toLowerCase()}.png`),x+pad+index*30,y+52,24,24));
  }
  const top=y+(large?40:compact?76:90),left=x+pad,right=x+width*.52,half=width*.46-pad;
  traits(ctx,build,catalog,language,left,top,half,size);
  build.moves.forEach((id,index)=>moveLine(ctx,catalog.moves[id],language,left,
    top+(large?160:compact?64:100)+index*(large?110:compact?27:70),half,size));
  text(ctx,`${t('nature')} · ${gameName('natures',catalog.natures.find(n=>n.name===build.nature),language)}`,right,top,size,half,accent,650);
  text(ctx,`${t('stats')} / ${t('points')}`,right,top+size*1.65,large?28:18,half,muted);
  stats(ctx,build,catalog,language,right,top+(large?150:compact?58:100),half,large?105:compact?22:65,large?38:compact?22:26);
  text(ctx,`${t('points')} ${STAT_KEYS.reduce((sum,key)=>sum+build.points[key],0)}/66`,left,y+height-(large?75:26),large?32:21,half,muted);
}
async function teamCard(ctx,build,catalog,language,x,y,width,height) {
  const t=key=>shareText(key,language),species=catalog.pokemon.find(p=>p.id===build.species);
  const left=x+24,right=x+width*.52,half=width*.46-24;
  box(ctx,x,y,width,height,'#fff',24,'#eceef1');

  // Keep the original game symbols inside quiet, aligned type pills.
  ctx.font=`550 16px ${font}`;
  const badges=species.types.map(type=>({type,label:typeName(type,language),width:Math.ceil(ctx.measureText(typeName(type,language)).width)+52}));
  const badgeWidth=badges.reduce((sum,badge)=>sum+badge.width+8,0);
  const title=text(ctx,imageBuildName(build,catalog,language),left,y+18,30,width-184-badgeWidth,ink,650);
  let badgeX=left+ctx.measureText(title).width+16;
  for(const badge of badges){
    box(ctx,badgeX,y+16,badge.width,32,'#f3f4f6',10,null);
    ctx.save();ctx.globalAlpha=.9;
    picture(ctx,images.get(`types/${badge.type.toLowerCase()}.png`),badgeX+7,y+21,22,22);
    ctx.restore();
    text(ctx,badge.label,badgeX+36,y+24,16,badge.width-42,'#737983',550);
    badgeX+=badge.width+8;
  }
  picture(ctx,await sprite(build.species),x+width-120,y+10,90,64);

  // Two inset rows use a shared label column, like an iOS grouped settings cell.
  box(ctx,left,y+66,half,66,'#f5f6f8',12,null);
  const rows=[
    [t('ability'),gameName('abilities',catalog.abilities.find(a=>a.name===build.ability),language)],
    [t('item'),itemLabel(build,catalog,language)],
  ];
  rows.forEach(([label,value],index)=>{
    const top=y+75+index*31;
    text(ctx,label,left+12,top+2,17,90,'#858a94',500);
    text(ctx,value,left+112,top,21,half-126,'#42464e',550);
  });
  ctx.fillStyle='#e7e9ee';ctx.fillRect(left+112,y+99,half-126,1);
  build.moves.forEach((id,index)=>moveLine(ctx,catalog.moves[id],language,left+8,y+145+index*27,half-16,22));

  text(ctx,`${t('nature')} · ${gameName('natures',catalog.natures.find(n=>n.name===build.nature),language)}`,right,y+76,22,half,'#535965',550);
  const total=STAT_KEYS.reduce((sum,key)=>sum+build.points[key],0);
  text(ctx,`${t('stats')} / ${t('points')} ${total}/66`,right,y+112,18,half,'#858a94',500);
  stats(ctx,build,catalog,language,right,y+137,half,21,22);
}
function moveLine(ctx,move,language,x,y,width,size) {
  let inset=0;
  if(move) {
    const image=images.get(`types/${move.type.toLowerCase()}.png`);
    picture(ctx,image,x,y,size*1.1,size*1.1);
    inset=size*1.55;
  }
  text(ctx,move?gameName('moves',move,language):shareText('empty',language),x+inset,y,size,width-inset,ink,600);
}
export async function qrCanvas(code) {
  const canvas=document.createElement('canvas');
  await QRCode.toCanvas(canvas,code,{errorCorrectionLevel:code.length>3391?'L':'M',margin:4,scale:5,color:{dark:'#22262fff',light:'#ffffffff'}});
  return canvas;
}
function footer(ctx,qr,width,height,language,kind,logo) {
  const t=key=>shareText(key,language),limit=kind==='team'?320:Math.min(420,width*.3);
  // Keep each QR module an integer number of pixels when reducing its size.
  const modules=qr.width/5,size=modules*Math.max(1,Math.floor(limit/modules)),x=width-size-48,y=height-size-76;
  box(ctx,x-12,y-12,size+24,size+24,'#fff',20);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(qr,x,y,size,size);ctx.imageSmoothingEnabled=true;
  picture(ctx,logo,48,height-224,160,160);
  text(ctx,t('qrCaption'),x,height-48,20,size,muted);
}
async function drawComparison(ctx,scene,catalog,language,y,width) {
  const accent=ctx.shareTheme.accent;
  const t=key=>shareText(key,language),rows=battleCards(scene,catalog),cardWidth=(width-120)/2;
  const height=710;
  for(const row of rows){
    const side=row.index<2?0:1,slot=row.index%2,x=40+side*(cardWidth+40),top=y+slot*(height+28);
    box(ctx,x,top,cardWidth,height,'#ffffffee',28,ctx.shareTheme[side?'secondary':'primary']+'50');
    text(ctx,`${t(side?'defend':'attack')} ${slot?'B':'A'}`,x+24,top+22,26,cardWidth-48,muted);
    text(ctx,imageBuildName(row.build,catalog,language),x+24,top+64,36,cardWidth-48,side?ink:accent,750);
    picture(ctx,await sprite(row.build.species),x+(cardWidth-150)/2,top+108,150,110);
    text(ctx,`${t('target')} · ${imageBuildName(row.target,catalog,language)}`,x+24,top+221,23,cardWidth-48,muted);
    row.moves.forEach((damage,index)=>{
      const move=catalog.moves[damage.id],moveY=top+262+index*103;
      box(ctx,x+18,moveY,cardWidth-36,92,'#fff',18);
      moveLine(ctx,move,language,x+34,moveY+12,cardWidth-68,30);
      const label=damage.error?'—':move?.category==='Status'?t('statusMove'):`${damage.min.toFixed(1)}–${damage.max.toFixed(1)}%`;
      box(ctx,x+34,moveY+63,cardWidth*.28,9,'#edf0f2',5,null);
      if(!damage.error&&damage.mean>0)box(ctx,x+34,moveY+63,cardWidth*.28*Math.min(100,damage.mean)/100,9,damage.ko>0?'#f47b4a':'#12b99a',5,null);
      text(ctx,label,x+cardWidth*.36,moveY+55,25,cardWidth*.58,muted,600);
      if(row.build.selected===index)ctx.strokeStyle=accent,ctx.lineWidth=3,ctx.strokeRect(x+18,moveY,cardWidth-36,92);
    });
  }
  return y+(scene.mode==='double'?2:1)*(height+28);
}

export async function createShareImage(kind,value,catalog,language='zhHans',{result,details=false,ball='poke-ball'}={}) {
  await document.fonts?.ready;await prepareLanguage(language);
  const typeImages=await Promise.all(Object.keys(TYPES).map(type=>asset(`types/${type.toLowerCase()}.png`)));
  // Cache loaded images rather than their promises for the synchronous row renderer.
  Object.keys(TYPES).forEach((type,index)=>images.set(`types/${type.toLowerCase()}.png`,typeImages[index]));
  const logo=await asset(selectedShareBall(ball).sprite),brand=await asset('rotom-logo.webp'),palette=ballPalette(ball);
  const code=encodeShare(kind,value,catalog),qr=await qrCanvas(code),canvas=document.createElement('canvas');
  const t=key=>shareText(key,language);
  canvas.width=kind==='team'?2560:1440;
  const measure=document.createElement('canvas').getContext('2d');
  let report=[],reportY=0;
  if(kind==='scene') {
    if(!result||result.error)throw new Error(result?.error||t('pending'));
    report=buildReport(value,result,catalog,{details}).flatMap(row=>wrap(measure,translateText(row.text,language),1328,row.kind==='section'?38:30).map(text=>({...row,text})));
    reportY=140+(value.mode==='double'?2:1)*738+50+Math.ceil(activeIndices(value).length/2)*660;
    canvas.height=Math.ceil(reportY+report.reduce((sum,row)=>sum+(row.kind==='section'?76:47),0)+560);
    if(canvas.height>16000)throw new Error(t('tooLarge'));
  } else canvas.height=kind==='team'?1440:2560;
  const ctx=canvas.getContext('2d');ctx.shareTheme=palette;
  ctx.fillStyle='#fbfaf8';ctx.fillRect(0,0,canvas.width,canvas.height);
  const background=ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  background.addColorStop(0,palette.primary+'2a');background.addColorStop(.5,'#ffffff80');background.addColorStop(1,palette.secondary+'38');
  ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=palette.primary;ctx.fillRect(0,0,canvas.width*.65,12);
  ctx.fillStyle=palette.secondary;ctx.fillRect(canvas.width*.65,0,canvas.width*.35,12);
  picture(ctx,brand,48,35,64,64);
  text(ctx,'PMC',128,48,42,canvas.width-176,ink,800);
  if(kind==='team') {
    for(let index=0;index<6;index++)await buildCard(ctx,value.members[index],catalog,language,48+(index%2)*1244,140+Math.floor(index/2)*294,1218,274);
  } else if(kind==='build') {
    text(ctx,imageBuildName(value,catalog,language),72,216,64,1296,ink,800);
    picture(ctx,await sprite(value.species),510,330,420,420);
    const species=catalog.pokemon.find(p=>p.id===value.species);
    species.types.forEach((type,index)=>picture(ctx,images.get(`types/${type.toLowerCase()}.png`),72+index*70,800,52,52));
    await buildCard(ctx,value,catalog,language,48,920,1344,1030,true);
  } else {
    const after=await drawComparison(ctx,value,catalog,language,140,canvas.width);
    for(const [position,index] of activeIndices(value).entries())await buildCard(ctx,value.actors[index],catalog,language,
      48+(position%2)*692,after+40+Math.floor(position/2)*660,652,630,false);
    let y=reportY;
    for(const row of report){const heading=row.kind==='section';text(ctx,row.text,56,y,heading?38:30,1328,
      ['accent','result'].includes(row.kind)?palette.accent:row.kind==='muted'||row.kind==='footer'?muted:ink,heading?750:550);y+=heading?76:47;}
  }
  footer(ctx,qr,canvas.width,canvas.height,language,kind,logo);
  const canvasBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!canvasBlob)throw new Error(t('tooLarge'));
  const members=kind==='team'?value.members:kind==='scene'?value.actors:[value];
  const usedPaths=new Set(['public/rotom-logo.webp',`public/${selectedShareBall(ball).sprite}`,
    ...Object.keys(TYPES).map(type=>`public/types/${type.toLowerCase()}.png`),
    ...members.map(build=>`public/sprites/${build.species}.png`)]);
  const credit=JSON.stringify({notice:'Artwork retains the contributor licenses below. Noncommercial use and attribution conditions apply where stated; underlying Pokemon rights are not granted. Preserve these credits when sharing. Social platforms may strip PNG metadata; include attribution separately if that happens.',
    artwork:artworkCredits.filter(entry=>usedPaths.has(entry.path))});
  const blob=new Blob([pngWithArtworkCredit(new Uint8Array(await canvasBlob.arrayBuffer()),credit)],{type:'image/png'});
  return {blob,code,width:canvas.width,height:canvas.height};
}
