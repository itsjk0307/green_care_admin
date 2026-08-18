"""Extract greencare auth keys from Chrome Local Storage leveldb (localhost:5173)."""
import json
import os
import re
import sys
from pathlib import Path


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
            i += 1
    return "".join(out)


def main():
    ldb = Path(os.environ["LOCALAPPDATA"]) / (
        "Google/Chrome/User Data/Default/Local Storage/leveldb"
    )
    token = None
    user = None
    reports_raw = None

    for p in sorted(ldb.glob("*"), key=lambda x: x.stat().st_mtime, reverse=True):
        if not p.is_file() or p.stat().st_size < 10:
            continue
        try:
            raw = p.read_bytes()
            text = extract_ascii(raw)
            latin = raw.decode("latin1", errors="ignore")
        except OSError:
            continue

        if token is None and b"access_token" in raw:
            # Value follows key in Chrome leveldb UTF-16LE records
            idx = raw.find(b"access_token")
            tail = raw[idx : idx + 4000]
            m = re.search(rb"eyJ[\w\-]+\.[\w\-]+\.[\w\-]+", tail)
            if m:
                token = m.group(0).decode("ascii")

        if user is None and "reencare-admin-user" in latin:
            idx = latin.find("reencare-admin-user")
            chunk = latin[idx : idx + 2000]
            m = re.search(r'\{[^{}]*"email"[^{}]*\}', chunk)
            if m:
                try:
                    user = json.loads(m.group(0))
                except json.JSONDecodeError:
                    pass

        if reports_raw is None and "reencare-map-work-reports" in latin:
            idx = latin.find("reencare-map-work-reports")
            chunk = latin[idx : idx + 120000]
            start = chunk.find("[")
            if start >= 0:
                depth = 0
                for j, ch in enumerate(chunk[start:], start):
                    if ch == "[":
                        depth += 1
                    elif ch == "]":
                        depth -= 1
                        if depth == 0:
                            reports_raw = chunk[start : j + 1]
                            break

    out = {
        "token": token,
        "user": user,
        "hasReports": reports_raw is not None,
    }
    if reports_raw:
        try:
            out["reports"] = json.loads(reports_raw)
        except json.JSONDecodeError:
            out["hasReports"] = False
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
