import { writeFileSync } from "node:fs";

const pages=await fetch("http://127.0.0.1:9222/json/list").then(response=>response.json());
const page=pages.find(entry=>entry.type==="page");
if(!page)throw new Error("没有可用的浏览器页面");
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true});});
let nextId=0;
const pending=new Map();
socket.addEventListener("message",event=>{const message=JSON.parse(event.data);const callback=pending.get(message.id);if(callback){pending.delete(message.id);callback(message);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,message=>message.error?reject(new Error(message.error.message)):resolve(message.result));socket.send(JSON.stringify({id,method,params}));});
await send("Runtime.evaluate",{expression:"Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('公开阵容'))?.click()"});
await new Promise(resolve=>setTimeout(resolve,250));
const heading=await send("Runtime.evaluate",{expression:"document.querySelector('main h1')?.textContent",returnByValue:true});
if(!heading.result.value?.includes("公开阵容"))throw new Error("公开阵容页面没有打开");
for(const [name,width,height] of [["open-teams-desktop",1440,1000],["open-teams-mobile",390,844]]){
  await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<640});
  await new Promise(resolve=>setTimeout(resolve,100));
  const image=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
  writeFileSync(new URL(`./artifacts/${name}.png`,import.meta.url),Buffer.from(image.data,"base64"));
}
await send("Runtime.evaluate",{expression:"Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('社区比赛'))?.click();setTimeout(()=>{const card=document.querySelector('.open-team-card');if(card)card.open=true},50)"});
await new Promise(resolve=>setTimeout(resolve,250));
for(const [name,width,height] of [["open-team-detail-desktop",1440,1200],["open-team-detail-mobile",390,844]]){
  await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<640});
  await new Promise(resolve=>setTimeout(resolve,100));
  const image=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
  writeFileSync(new URL(`./artifacts/${name}.png`,import.meta.url),Buffer.from(image.data,"base64"));
}
socket.close();
console.log("公开阵容列表与详情的桌面、手机截图已生成");
