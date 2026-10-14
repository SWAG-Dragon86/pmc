import React, { useEffect, useRef, useState } from 'react';
import { Share2, X, Download, Copy, Camera, Upload, QrCode } from 'lucide-react';
import { shareText, buildName } from './sharing-language.mjs';
import { decodeShare } from './share-code.mjs';
import { saveBlob } from './platform.mjs';

function useDialog(onClose) {
  const ref=useRef(null);
  useEffect(()=>{const dialog=ref.current;if(!dialog)return;dialog.showModal();const cancel=event=>{event.preventDefault();onClose();};
    dialog.addEventListener('cancel',cancel);return()=>dialog.removeEventListener('cancel',cancel);},[]);
  return ref;
}
export function ShareButton({kind,value,onShare,language,compact=false,disabled=false}) {
  const label=shareText('share',language);
  return <button type="button" className={compact?'icon-button pmc-share-button':'button pmc-share-button'}
    title={label} aria-label={`${label} · ${value.name||shareText(kind,language)}`} disabled={disabled}
    onClick={()=>onShare(kind,value)}><Share2 size={16}/>{!compact&&label}</button>;
}
export function SharingDialog({share,catalog,language,ball,onClose,notify}) {
  const dialog=useDialog(onClose),t=key=>shareText(key,language);
  const [image,setImage]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  useEffect(()=>{
    let active=true,url;
    import('./share-image.mjs').then(module=>module.createShareImage(share.kind,share.value,catalog,language,{result:share.result,details:share.details,ball}))
      .then(result=>{if(active){url=URL.createObjectURL(result.blob);setImage({...result,url});}})
      .catch(cause=>{if(active)setError(t(cause.message)===cause.message?cause.message:t(cause.message));})
      .finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[share,language,ball]);
  async function save(){try{await saveBlob(image.blob,`PMC-1.4-${share.kind}-${Date.now()}.png`);notify(t('saved'));}catch(cause){setError(cause.message);}}
  async function copy(){try{await navigator.clipboard.writeText(image.code);notify(t('copied'));}catch{dialog.current.querySelector('textarea')?.select();}}
  return <dialog ref={dialog} className="sharing-dialog"><header><div><h2>{t('share')} · {t(share.kind)}</h2></div>
    <button className="icon-button" aria-label={t('close')} onClick={onClose}><X size={20}/></button></header>
    {busy&&<p role="status">{t('loading')}</p>}{error&&<p className="inline-error" role="alert">{error}</p>}
    {image&&<><img className="sharing-image-preview" src={image.url} alt={`${t(share.kind)} ${image.width} × ${image.height}`}/>
      <div className="sharing-actions"><button className="button primary" onClick={save}><Download size={16}/>{t('exportImage')}</button>
        <button className="button" onClick={copy}><Copy size={16}/>{t('copyCode')}</button></div>
      <label className="sharing-code-label">{t('codeLabel')}<textarea readOnly value={image.code} onClick={event=>event.target.select()}/></label>
      <p className="hint">{t('codeHint')}</p></>}
  </dialog>;
}

export function SharingImport({catalog,language,onClose,onConfirm}) {
  const dialog=useDialog(onClose),input=useRef(),video=useRef(),stream=useRef(),timer=useRef(),generation=useRef(0);
  const t=key=>shareText(key,language);
  const [code,setCode]=useState(''),[error,setError]=useState(''),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[camera,setCamera]=useState(false);
  function stop(){generation.current++;clearTimeout(timer.current);stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setCamera(false);}
  useEffect(()=>()=>{generation.current++;clearTimeout(timer.current);stream.current?.getTracks().forEach(track=>track.stop());},[]);
  useEffect(()=>{
    // Permission prompts can hide the app before a camera stream exists.
    const background=()=>{if(stream.current)stop();},hidden=()=>{if(document.hidden)background();};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pmc-app-background',background);
    return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pmc-app-background',background);};
  },[]);
  function read(value){try{const parsed=decodeShare(value,catalog);setPreview(parsed);setCode(value);setError('');stop();return true;}catch(cause){setError(t(cause.message));setPreview(null);return false;}}
  async function fileChanged(file){if(!file)return;stop();setBusy(true);setPreview(null);setError('');try{const module=await import('./qr-reader.mjs');read(await module.readQrImage(file));}
    catch(cause){setError(t(cause.message));}finally{setBusy(false);if(input.current)input.current.value='';}}
  async function start(){
    if(!navigator.mediaDevices?.getUserMedia){setError(t('cameraUnavailable'));return;}
    stop();setError('');setPreview(null);const token=++generation.current;setCamera(true);
    try {
      const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
      if(token!==generation.current||document.hidden){media.getTracks().forEach(track=>track.stop());if(token===generation.current)setCamera(false);return;}
      stream.current=media;video.current.srcObject=media;await video.current.play();
      const {readQrCanvas}=await import('./qr-reader.mjs'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
      function scan(){if(token!==generation.current||!video.current)return;const element=video.current;
        if(element.readyState>=2){const scale=Math.min(1,1280/element.videoWidth);canvas.width=Math.round(element.videoWidth*scale);canvas.height=Math.round(element.videoHeight*scale);
          ctx.drawImage(element,0,0,canvas.width,canvas.height);const found=readQrCanvas(canvas);if(found&&read(found))return;}
        timer.current=setTimeout(scan,400);
      }scan();
    } catch {if(token===generation.current){stop();setError(t('cameraDenied'));}}
  }
  const members=preview?(preview.kind==='team'?preview.value.members:preview.kind==='scene'?preview.value.actors:[preview.value]):[];
  return <dialog ref={dialog} className="sharing-dialog sharing-import"><header><div><small>PMC 1.4</small><h2><QrCode size={20}/>{t('import')}</h2></div>
    <button className="icon-button" aria-label={t('close')} onClick={onClose}><X size={20}/></button></header>
    <p className="hint">{t('codeHint')}</p>
    <div className="sharing-actions"><button className="button" disabled={busy} onClick={()=>input.current.click()}><Upload size={16}/>{t('chooseImage')}</button>
      <button className="button" disabled={busy} onClick={camera?stop:start}><Camera size={16}/>{t(camera?'stopCamera':'camera')}</button></div>
    <input ref={input} type="file" accept="image/*" hidden onChange={event=>fileChanged(event.target.files?.[0])}/>
    {camera&&<video ref={video} muted autoPlay playsInline className="sharing-camera"/>}
    <label className="sharing-code-label">{t('paste')}<textarea value={code} onChange={event=>{setCode(event.target.value);setPreview(null);}}/></label>
    <button className="button" disabled={!code||busy} onClick={()=>read(code)}>{t('readCode')}</button>
    {busy&&<p role="status">{t('loading')}</p>}{error&&<p className="inline-error" role="alert">{error}</p>}
    {preview&&<section className="shared-data-preview"><h3>{t('preview')} · {t(preview.kind)}</h3><p>{preview.kind!=='build'&&preview.value.name}</p>
      <div>{members.map((build,index)=><article key={index}><img src={`${import.meta.env.BASE_URL}sprites/${build.species}.png`} alt=""/>
        <b>{buildName(build,catalog,language)}</b><small>{t('points')} {Object.values(build.points).reduce((sum,value)=>sum+value,0)}/66</small></article>)}</div>
      <p className="hint">{t('previewHint')}</p><button className="button primary" onClick={()=>onConfirm(preview.data)}>{t('confirm')}</button>
    </section>}
  </dialog>;
}
