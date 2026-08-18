"""Verify map-report migration via GET /api/v1/map-reports/"""
import json
import os
import subprocess
import urllib.request
from pathlib import Path

LIMIT = 20 * 1024 * 1024
LOCAL_IDS = {
    "b1ce2491-29dc-48b5-9b86-c977e65b61e1",
    "2cafb002-5e27-4752-a4db-1dcf6f82dcb4",
    "47bc8c78-1c02-41ef-9a23-55e4405df0b1",
    "3c125d23-5d49-413c-8bf8-e38f4daa5b55",
    "6157b726-99bc-41fc-bfce-85730a0427f6",
    "9e4d513c-d4c5-4218-8f7e-418fd3c73b98",
    "e03a5b25-f929-416d-91b3-05abf4de6cf9",
    "5c5afe99-b49c-4d28-83af-dd9af3f6c1bf",
    "bbead6de-a032-4d99-8fc7-65ac10c79ccc",
    "0c5e4203-1f02-4fbd-8405-2dac72ab09e7",
    "4bbd8f4c-5a12-47eb-9b04-fa113063a506",
}
MOBILE_KEYWORDS = ("oak", "오크", "midas", "마이다스", "이천")


def get_token() -> str:
    raw = subprocess.check_output(
        ["python", "scripts/_extract_chrome_auth.py"], text=True, cwd=Path(__file__).resolve().parents[1]
    )
    return json.loads(raw)["token"]


def api_get(path: str, token: str) -> dict:
    req = urllib.request.Request(
        f"http://127.0.0.1:8000/api/v1{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode())
        if isinstance(body, dict) and "data" in body:
            return body["data"]
        return body


def head_size(url: str) -> int | None:
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=60) as resp:
            cl = resp.headers.get("Content-Length")
            return int(cl) if cl else None
    except Exception:
        return None


def main():
    token = get_token()
    payload = api_get("/map-reports/?limit=100", token)
    reports = payload.get("reports", []) if isinstance(payload, dict) else []

    by_client = {r["client_id"]: r for r in reports}

    migrated = []
    missing_local = []
    for cid in sorted(LOCAL_IDS):
        rec = by_client.get(cid)
        if not rec:
            missing_local.append(cid)
            continue
        pdf_url = rec.get("pdf_url") or ""
        img_url = rec.get("map_image_url") or ""
        pdf_abs = f"http://127.0.0.1:8000/{pdf_url.lstrip('/')}" if pdf_url else ""
        img_abs = f"http://127.0.0.1:8000/{img_url.lstrip('/')}" if img_url else ""
        pdf_size = head_size(pdf_abs) if pdf_abs else None
        img_ok = False
        if img_abs:
            try:
                urllib.request.urlopen(img_abs, timeout=30).read(64)
                img_ok = True
            except Exception:
                img_ok = False
        migrated.append(
            {
                "client_id": cid,
                "server_id": rec["id"],
                "work_date": rec["work_date"],
                "course_id": rec["course_id"],
                "pdf_url": pdf_url,
                "map_image_url": img_url,
                "pdf_bytes": pdf_size,
                "pdf_under_20mb": pdf_size is not None and pdf_size <= LIMIT,
                "pdf_fetchable": pdf_size is not None,
                "image_fetchable": img_ok,
            }
        )

    mobile = []
    for r in reports:
        hay = json.dumps(r, ensure_ascii=False).lower()
        if any(k.lower() in hay for k in MOBILE_KEYWORDS):
            mobile.append(
                {
                    "client_id": r["client_id"],
                    "server_id": r["id"],
                    "work_date": r["work_date"],
                    "course_id": r["course_id"],
                    "pdf_url": r.get("pdf_url"),
                    "map_image_url": r.get("map_image_url"),
                }
            )

    out = {
        "total_server_reports": len(reports),
        "migrated_found": len(migrated),
        "migrated_missing": missing_local,
        "migrated": migrated,
        "mobile_records": mobile,
        "all_migrated_under_20mb": all(m["pdf_under_20mb"] for m in migrated if m["pdf_bytes"]),
        "all_urls_working": all(m["pdf_fetchable"] and m["image_fetchable"] for m in migrated),
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
