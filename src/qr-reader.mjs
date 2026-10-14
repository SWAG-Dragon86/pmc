import jsQR from 'jsqr';

export function readQrCanvas(canvas) {
  const context=canvas.getContext('2d',{willReadFrequently:true});
  const image=context.getImageData(0,0,canvas.width,canvas.height);
  return jsQR(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'})?.data||null;
}
export async function readQrImage(file) {
  if(!file?.type.startsWith('image/')||file.size>40*1024*1024)throw new Error('imageTooLarge');
  const bitmap=await createImageBitmap(file);
  try {
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    // Scan the compact bottom-right QR without resampling its pixels.
    for(const fraction of [.35,.6]) {
      const side=Math.min(1400,Math.ceil(bitmap.width*fraction),bitmap.height);
      canvas.width=canvas.height=side;
      ctx.drawImage(bitmap,bitmap.width-side,bitmap.height-side,side,side,0,0,side,side);
      const corner=readQrCanvas(canvas);if(corner)return corner;
    }
    const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const code=readQrCanvas(canvas);if(!code)throw new Error('imageNoCode');return code;
  } finally {bitmap.close?.();}
}
