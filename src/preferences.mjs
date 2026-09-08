export const DEFAULT_HEADING = Object.freeze({
  text: "每一击，都心中有数.",
  size: 32,
  color: "",
});

export function normalizeHeading(value) {
  return {
    text:
      typeof value?.text === "string"
        ? value.text.slice(0, 80)
        : DEFAULT_HEADING.text,
    size: Number.isFinite(value?.size)
      ? Math.min(64, Math.max(18, Math.round(value.size)))
      : DEFAULT_HEADING.size,
    color: /^#[0-9a-f]{6}$/i.test(value?.color || "") ? value.color : "",
  };
}

// Group invitation supplied by the site owner; never includes automatic join actions.
export const DISCUSSION_URL =
  "https://qun.qq.com/universal-share/share?ac=1&authKey=YxueGgAMVY0C3vAc5ObWyClOVPhGPCso%2F1E16yKQtGPIKXqQQKkgezRDVnVgWe9B&busi_data=eyJncm91cENvZGUiOiI1OTIwNjgyNTUiLCJ0b2tlbiI6InVBL1JBWDZWK2FqM0o2K0ZCOU1tZkFGTytqUXlWVWMwUXpYdk5nY0FkMkpDK2pxQzd2bnZZSlBBVTBwVU1wcVAiLCJ1aW4iOiIzMDkxMjkxMTYzIn0%3D&data=TXBcZt1FxcQmJmOJYYH1FIkqxRJ4ZeWs9nnRZbS280n2iWu7Vi7U-IDJBXRdPhBe5vTbfo4kpXrFqvzTX3pvhA&svctype=4&tempid=h5_group_info";
