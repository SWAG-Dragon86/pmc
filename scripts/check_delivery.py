import json
import pathlib
import sys

manifest_path = pathlib.Path(sys.argv[1])
root = manifest_path.parent
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
missing = []
for relative in manifest["required_files"]:
    path = root / relative
    if not path.is_file() or path.stat().st_size == 0:
        missing.append(relative)
if missing:
    raise SystemExit("DELIVERY_CHECK_FAILED: " + ", ".join(missing))
print(f"DELIVERY_CHECK_PASS: {len(manifest['required_files'])} files")
