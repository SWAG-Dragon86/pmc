// iTXt keeps attribution with the exported PNG without changing its pixels or QR.
export function pngWithArtworkCredit(bytes, credit) {
  if (bytes.length < 33 || bytes.slice(0, 8).join() !== "137,80,78,71,13,10,26,10") {
    throw new Error("Expected PNG image");
  }
  const payload = new TextEncoder().encode(`Description\0\0\0\0\0${credit}`);
  const chunk = new Uint8Array(payload.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length);
  chunk.set([105, 84, 88, 116], 4); // iTXt
  chunk.set(payload, 8);
  let crc = 0xffffffff;
  for (const value of chunk.subarray(4, -4)) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
  const result = new Uint8Array(bytes.length + chunk.length);
  result.set(bytes.subarray(0, 33)); // after IHDR, before IDAT
  result.set(chunk, 33);
  result.set(bytes.subarray(33), 33 + chunk.length);
  return result;
}
