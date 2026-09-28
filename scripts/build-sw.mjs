import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(path, prefix = "") {
  const all = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const relative = `${prefix}${item.name}`;
    if (item.isDirectory())
      all.push(...(await files(`${path}/${item.name}`, `${relative}/`)));
    else if (item.name !== "sw.js") all.push(relative);
  }
  return all;
}
const list = await files("dist");
let hash = createHash("sha256");
for (const file of list) hash.update(await readFile(`dist/${file}`));
const version = hash.digest("hex").slice(0, 12);
const source = `const CACHE='pmc-${version}';
const FILES=${JSON.stringify(list.map((f) => "./" + f))};
async function precache(){const cache=await caches.open(CACHE);for(let i=0;i<FILES.length;i+=20)await cache.addAll(FILES.slice(i,i+20));}
self.addEventListener('install',event=>event.waitUntil(self.registration.active?Promise.resolve():precache()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')event.waitUntil(precache().then(()=>self.skipWaiting()).catch(async()=>{for(const client of await self.clients.matchAll())client.postMessage({type:'UPDATE_FAILED'});}));});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('pmc-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;if(url.pathname.endsWith('/live-teams.json')){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}event.respondWith((async()=>{const cache=await caches.open(CACHE);const found=await cache.match(event.request,{ignoreSearch:true});if(found)return found;try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error;}})());});`;
await writeFile("dist/sw.js", source);
console.log(
  `PWA ${version}: ${list.length} local assets precached; updates require confirmation.`,
);
