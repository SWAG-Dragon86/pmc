// The Android package uses the same UI with locally bundled resources.
export const isAndroidApp = import.meta.env?.VITE_PMC_ANDROID === "true";

export async function saveBlob(blob, name) {
  if (isAndroidApp) {
    if (!globalThis.PMCAndroid?.saveFile)
      throw new Error("安卓文件保存服务未就绪，请重新打开应用");
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("无法读取待导出文件"));
      reader.readAsDataURL(blob);
    });
    globalThis.PMCAndroid.saveFile(name, blob.type || "application/octet-stream", data);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
