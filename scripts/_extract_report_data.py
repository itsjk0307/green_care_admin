"""Extract map report meta + estimate stored PDF size from Chrome origin data."""
import json
import os
import re
import struct
from pathlib import Path

REPORT_ID = "b1ce2491-29dc-48b5-9b86-c977e65b61e1"

def extract_ascii(data: bytes) -> str:
    out = []
    i = 0
    while i < len(data):
        if i + 1 < len(data) and 32 <= data[i] <= 126 and data[i + 1] == 0:
            out.append(chr(data[i]))
            i += 2
        elif 32 <= data[i] <= 126:
            out.append(chr(data[i]))
            i += 1
        else:
            out.append(" ")
            i += 1
    return "".join(out)


def read_ls_reports():
    ldb = Path(os.environ["LOCALAPPDATA"]) / (
        "Google/Chrome/User Data/Default/Local Storage/leveldb"
    )
    files = sorted(ldb.glob("*.ldb"), key=lambda p: p.stat().st_mtime, reverse=True)
    for p in files[:12]:
        try:
            text = extract_ascii(p.read_bytes())
        except OSError:
            continue
        if REPORT_ID not in text:
            continue
        # Pull a JSON fragment around the report id
        idx = text.find(REPORT_ID)
        window = text[max(0, idx - 200) : idx + 4000]
        print("source", p.name)
        print(window[:500])
        return window
    return None


def scan_idb_leveldb():
    base = Path(os.environ["LOCALAPPDATA"]) / (
        "Google/Chrome/User Data/Default/IndexedDB/http_localhost_5173.indexeddb.leveldb"
    )
    for p in base.glob("*"):
        if not p.is_file() or p.stat().st_size < 100:
            continue
        try:
            data = p.read_bytes()
        except OSError:
            continue
        if REPORT_ID.encode() in data:
            print("report id in idb leveldb file", p.name, p.stat().st_size)


def scan_blobs():
    base = Path(os.environ["LOCALAPPDATA"]) / (
        "Google/Chrome/User Data/Default/IndexedDB/http_localhost_5173.indexeddb.blob"
    )
    if not base.exists():
        print("no blob dir")
        return
    sizes = []
    for p in base.rglob("*"):
        if p.is_file():
            sizes.append((p.stat().st_size, p))
    sizes.sort(reverse=True)
    for sz, p in sizes[:10]:
        print(f"blob {p.name}: {sz/1024/1024:.2f} MB")


print("=== localStorage scan ===")
read_ls_reports()
print("\n=== idb leveldb ===")
scan_idb_leveldb()
print("\n=== blobs ===")
scan_blobs()
