import os from "node:os";
import { syncBuiltinESMExports } from "node:module";
import { fileURLToPath } from "node:url";

// Vercel 59.11.2 puts the hostname in an HTTP header. Only this process uses
// an ASCII device label; the Windows computer name is never changed.
if (/[^\x20-\x7e]/.test(os.hostname())) {
  os.hostname = () => "pmc-windows";
  syncBuiltinESMExports();
}
process.env.VERCEL_TELEMETRY_DISABLED = "1";
const cli = new URL("../output/deployment-cli/node_modules/vercel/dist/vc.js", import.meta.url);
const config = fileURLToPath(new URL("../output/vercel-auth", import.meta.url));
process.argv = [process.execPath, fileURLToPath(cli), ...process.argv.slice(2), "--global-config", config];
await import(cli.href);
