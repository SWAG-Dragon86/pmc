import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync, copyFileSync, cpSync, mkdtempSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tools = join(root, "output/android-tools");
function find(dir, name) {
  if (!existsSync(dir)) throw new Error("Run scripts/setup-android.ps1 first: " + dir);
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isFile() && item.name === name) return path;
    if (item.isDirectory()) { const result = find(path, name); if (result) return result; }
  }
}
const java = find(join(tools, "jdk"), "java.exe");
const javac = find(join(tools, "jdk"), "javac.exe");
const jar = find(join(tools, "jdk"), "jar.exe");
const keytool = find(join(tools, "jdk"), "keytool.exe");
const aapt = find(join(tools, "build-tools"), "aapt2.exe");
const zipalign = find(join(tools, "build-tools"), "zipalign.exe");
const signer = find(join(tools, "build-tools"), "apksigner.jar");
const d8 = find(join(tools, "build-tools"), "d8.jar");
const androidJar = find(join(tools, "platform"), "android.jar");
if ([java, javac, jar, keytool, aapt, zipalign, signer, d8, androidJar].some(p => !p)) throw new Error("Android tools are incomplete");
function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", windowsHide: true, ...options });
}
const output = join(root, "output/android");
mkdirSync(output, { recursive: true });
const stage = mkdtempSync(join(output, "build-"));
for (const dir of ["res/mipmap-nodpi", "assets/www", "classes", "generated", "dex"]) mkdirSync(join(stage, dir), { recursive: true });
run(process.execPath, ["scripts/prepare-live-teams.mjs"]);
// Build separately: the website's dist and its service worker stay unchanged.
run(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--outDir", join(stage, "assets/www")], {
  env: { ...process.env, VITE_PMC_ANDROID: "true" },
});
const teamFeedUrl = process.env.PMC_TEAM_FEED_URL || "https://pmc-babb04.gitlab.io/live-teams.json";
const teamFeedFallbackUrl = process.env.PMC_TEAM_FEED_FALLBACK_URL || "https://swag-dragon86.github.io/pmc/live-teams.json";
for (const url of [teamFeedUrl, teamFeedFallbackUrl])
  if (!/^https:\/\/[^\s]+\/live-teams\.json$/.test(url)) throw new Error("PMC team feeds must be HTTPS live-teams.json addresses");
writeFileSync(join(stage, "assets/www/team-feed-url.txt"), [...new Set([teamFeedUrl, teamFeedFallbackUrl])].join("\n") + "\n");
cpSync(join(root, "android/res"), join(stage, "res"), { recursive: true });
copyFileSync(join(root, "public/rotom-maskable-512.png"), join(stage, "res/mipmap-nodpi/ic_launcher.png"));
run(aapt, ["compile", "--dir", join(stage, "res"), "-o", join(stage, "resources.zip")]);
run(aapt, ["link", "-o", join(stage, "unsigned.apk"), "-I", androidJar,
  "--manifest", join(root, "android/AndroidManifest.xml"), "--java", join(stage, "generated"),
  "--auto-add-overlay", join(stage, "resources.zip")]);
run(javac, ["-encoding", "UTF-8", "-source", "8", "-target", "8", "-classpath", androidJar,
  "-d", join(stage, "classes"), join(root, "android/src/cn/pmc/calculator/MainActivity.java")]);
run(jar, ["cf", join(stage, "classes.jar"), "-C", join(stage, "classes"), "."]);
run(java, ["-cp", d8, "com.android.tools.r8.D8", "--release", "--min-api", "26", "--lib", androidJar,
  "--output", join(stage, "dex"), join(stage, "classes.jar")]);
// jar uses APK-compatible forward slashes; Windows aapt2 -A may emit backslashes.
run(jar, ["uf", join(stage, "unsigned.apk"), "-C", join(stage, "dex"), "classes.dex", "-C", stage, "assets"]);
run(zipalign, ["-f", "-p", "4", join(stage, "unsigned.apk"), join(stage, "aligned.apk")]);

// A stable private signing key is essential for upgrades without uninstalling.
const signing = join(root, "output/android-signing");
mkdirSync(signing, { recursive: true });
const secretPath = join(signing, "credentials.json");
const keyPath = join(signing, "pmc-release.p12");
if (existsSync(secretPath) !== existsSync(keyPath)) throw new Error("Signing backup is incomplete. Restore it; do not create a replacement key.");
if (!existsSync(secretPath)) {
  const password = randomBytes(32).toString("hex");
  run(keytool, ["-genkeypair", "-keystore", keyPath, "-storetype", "PKCS12", "-alias", "pmc",
    "-storepass:env", "PMC_SIGNING_PASSWORD", "-keypass:env", "PMC_SIGNING_PASSWORD", "-keyalg", "RSA", "-keysize", "3072",
    "-validity", "10000", "-dname", "CN=PMC Offline, OU=Independent Calculator, O=PMC"], {
      env: { ...process.env, PMC_SIGNING_PASSWORD: password },
    });
  writeFileSync(secretPath, JSON.stringify({ alias: "pmc", password }, null, 2));
}
const credentials = JSON.parse(readFileSync(secretPath, "utf8"));
const manifest=readFileSync(join(root,'android/AndroidManifest.xml'),'utf8');
const version=manifest.match(/android:versionName="([0-9.]+)"/)[1];
const apk = join(output, `PMC-${version}-android.apk`);
run(java, ["-jar", signer, "sign", "--ks", keyPath, "--ks-key-alias", credentials.alias,
  "--ks-pass", "env:PMC_SIGNING_PASSWORD", "--v4-signing-enabled", "false", "--out", apk, join(stage, "aligned.apk")], {
    env: { ...process.env, PMC_SIGNING_PASSWORD: credentials.password },
  });
run(java, ["-jar", signer, "verify", "--verbose", "--print-certs", apk]);
run(zipalign, ["-c", "4", apk]);
const hash = createHash("sha256").update(readFileSync(apk)).digest("hex");
writeFileSync(join(output, `PMC-${version}-android.sha256`), hash + `  PMC-${version}-android.apk\n`);
writeFileSync(join(output, "build-info.json"), JSON.stringify({ version, package: "cn.pmc.calculator", minSdk: 26, targetSdk: 35, stage, apk, sha256: hash, builtAt: new Date().toISOString() }, null, 2));
console.log("APK:", apk, "\nSHA256:", hash);
if (process.argv.includes("--qa")) {
  const probe = join(output, "qa-probe");
  mkdirSync(join(probe, "classes"), { recursive: true });
  mkdirSync(join(probe, "dex"), { recursive: true });
  run(aapt, ["link", "-o", join(probe, "unsigned.apk"), "-I", androidJar, "--manifest", join(root, "android/test/AndroidManifest.xml")]);
  run(javac, ["-encoding", "UTF-8", "-source", "8", "-target", "8", "-classpath", androidJar, "-d", join(probe, "classes"), join(root, "android/test/Probe.java")]);
  run(jar, ["cf", join(probe, "classes.jar"), "-C", join(probe, "classes"), "."]);
  run(java, ["-cp", d8, "com.android.tools.r8.D8", "--release", "--min-api", "26", "--lib", androidJar, "--output", join(probe, "dex"), join(probe, "classes.jar")]);
  run(jar, ["uf", join(probe, "unsigned.apk"), "-C", join(probe, "dex"), "classes.dex"]);
  run(zipalign, ["-f", "4", join(probe, "unsigned.apk"), join(probe, "aligned.apk")]);
  run(java, ["-jar", signer, "sign", "--ks", keyPath, "--ks-key-alias", credentials.alias,
    "--ks-pass", "env:PMC_SIGNING_PASSWORD", "--v4-signing-enabled", "false", "--out", join(probe, "probe.apk"), join(probe, "aligned.apk")], {
      env: { ...process.env, PMC_SIGNING_PASSWORD: credentials.password },
    });
}
