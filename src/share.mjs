import {saveBlob} from './platform.mjs';
import {buildReport} from './report.mjs';
const style={brand:[38,700,'#292a30'],result:[54,750,'#b93034'],section:[26,700,'#292a30'],heading:[24,650,'#292a30'],body:[22,500,'#292a30'],muted:[20,450,'#565863'],accent:[22,650,'#a62931'],footer:[18,450,'#656774']};
export async function exportResultImage(scene,result,catalog,options={}) {
  await document.fonts?.ready;
  const rows=buildReport(scene,result,catalog,options),canvas=document.createElement('canvas');
  canvas.width=1080;const ctx=canvas.getContext('2d'),lines=[];
  for(const row of rows){
    const [size,weight,color]=style[row.kind];ctx.font=`${weight} ${size}px "Microsoft YaHei",sans-serif`;
    let text='';
    for(const char of row.text){
      if(char==='\n'||ctx.measureText(text+char).width>984){lines.push({text,size,weight,color,gap:0});text=char==='\n'?'':char;}
      else text+=char;
    }
    lines.push({text,size,weight,color,gap:['section','brand'].includes(row.kind)?18:5});
  }
  canvas.height=Math.ceil(90+lines.reduce((n,l)=>n+l.size*1.5+l.gap,0));
  if(canvas.height>16000)throw new Error('分支详情图片过长，请先导出简洁结果，或减少同时在场的行动者。');
  ctx.fillStyle='#f5f3ef';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#b93034';ctx.fillRect(0,0,canvas.width,10);
  let y=42;ctx.textBaseline='top';
  for(const l of lines){y+=l.gap;ctx.font=`${l.weight} ${l.size}px "Microsoft YaHei",sans-serif`;ctx.fillStyle=l.color;ctx.fillText(l.text,48,y);y+=l.size*1.5;}
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('图片生成失败');
  await saveBlob(blob,`PMC-${options.details?'分支详情':'伤害结果'}-${Date.now()}.png`);
}
