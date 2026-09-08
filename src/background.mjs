function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("pmc-appearance", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("assets");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function backgroundKey(orientation) {
  if (!["landscape", "portrait"].includes(orientation))
    throw new Error("Invalid background orientation");
  return orientation === "landscape" ? "background" : "background-portrait";
}
export async function getBackground(orientation = "landscape") {
  const key = backgroundKey(orientation);
  const database = await db();
  return new Promise((resolve, reject) => {
    const t = database.transaction("assets");
    const r = t.objectStore("assets").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => database.close();
  });
}
export async function setBackground(file, orientation = "landscape") {
  const key = backgroundKey(orientation);
  const database = await db();
  return new Promise((resolve, reject) => {
    const t = database.transaction("assets", "readwrite");
    if (file) t.objectStore("assets").put(file, key);
    else t.objectStore("assets").delete(key);
    t.oncomplete = () => {
      database.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
  });
}
