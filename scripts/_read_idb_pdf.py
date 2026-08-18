import os
import struct
from pathlib import Path

REPORT_ID = "b1ce2491-29dc-48b5-9b86-c977e65b61e1"
LIMIT = 20 * 1024 * 1024

idb_root = Path(os.environ["LOCALAPPDATA"]) / "Google/Chrome/User Data/Default/IndexedDB"
dirs = sorted(
    [d for d in idb_root.glob("http_localhost_5173_*") if d.is_dir()],
    key=lambda p: p.stat().st_mtime,
    reverse=True,
)
print("idb candidates:", [d.name for d in dirs[:5]])

for d in dirs[:3]:
    print("\n===", d.name, "===")
    for f in sorted(d.rglob("*"), key=lambda p: p.stat().st_size if p.is_file() else 0, reverse=True):
        if not f.is_file():
            continue
        size = f.stat().st_size
        if size < 1000:
            continue
        try:
            data = f.read_bytes()
        except Exception as e:
            print(" skip", f.name, e)
            continue
        has_id = REPORT_ID.encode() in data
        print(f" {f.name}: {size:,} bytes, has_report_id={has_id}")
        if has_id and size > 1_000_000:
            out = Path(os.environ["TEMP"]) / f"idb-chunk-{f.name}.bin"
            out.write_bytes(data)
            print("  wrote", out)
