"""Check APK content and prevent Windows resource path/signing leaks."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parent.parent
info = json.loads((root / "output/android/build-info.json").read_text(encoding="utf-8"))
apk = Path(info["apk"])
checks = []
with ZipFile(apk) as bundle:
    names = bundle.namelist()
    assert len(names) == len(set(names)), "Duplicate entries"
    assert not any("\\" in n for n in names), "Backslashes break Android AssetManager paths"
    checks.append("All APK paths use forward slashes")
    for name in ["AndroidManifest.xml", "classes.dex", "resources.arsc", "assets/www/index.html", "res/mipmap-nodpi-v4/ic_launcher.png"]:
        assert name in names, name
    assert not any(n.endswith((".p12", ".jks", ".env", "credentials.json", "probe.apk")) or "android-signing" in n for n in names)
    checks.append("Manifest, native code and launcher icon present; no signing secrets or QA probe")
    assert "assets/www/sw.js" not in names
    checks.append("No web service worker can override packaged resources")
    stage = Path(info["stage"]) / "assets/www"
    for file in stage.rglob("*"):
        if file.is_file():
            key = "assets/www/" + file.relative_to(stage).as_posix()
            assert bundle.read(key) == file.read_bytes(), key
    sprites = [n for n in names if n.startswith("assets/www/sprites/") and n.endswith(".png")]
    assert len(sprites) == 315, len(sprites)
    checks.append("Every web asset matches the build; all 315 sprites are packaged")
assert hashlib.sha256(apk.read_bytes()).hexdigest() == info["sha256"]
checks.append("APK SHA-256 matches delivery checksum")
report = {"checks": checks, "apk_bytes": apk.stat().st_size}
(root / "output/android/package-checks.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
for check in checks:
    print("PASS", check)
