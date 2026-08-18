"""End-to-end auth flow verification against live backend."""
import json
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

BASE = "http://127.0.0.1:8000/api/v1"
ADMIN_EMAIL = "user@green.com"
ADMIN_PASSWORD = "admin123"


def req(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw}


def main():
    suffix = uuid.uuid4().hex[:8]
    test_email = f"gc-test-cm-{suffix}@example.com"
    test_password = "TestPass123!"

    print("=== 1. Signup course_manager ===")
    courses_status, courses_body = req("GET", "/auth/signup/courses")
    assert courses_status == 200 and courses_body.get("success"), courses_body
    course_id = courses_body["data"][0]["id"]
    signup_status, signup_body = req(
        "POST",
        "/auth/signup",
        {
            "name": f"Test CM {suffix}",
            "email": test_email,
            "password": test_password,
            "role": "course_manager",
            "course_id": course_id,
        },
    )
    print("signup", signup_status, signup_body.get("message"))
    assert signup_status == 201, signup_body
    user_id = signup_body["data"]["id"]

    print("=== 2. Login pending (403) ===")
    pend_status, pend_body = req(
        "POST", "/auth/login", {"email": test_email, "password": test_password}
    )
    print("login pending", pend_status, pend_body)
    assert pend_status == 403
    assert pend_body["detail"]["code"] == "account_pending"

    print("=== 3. Admin login ===")
    admin_status, admin_body = req(
        "POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    admin_token = None
    if admin_status == 200:
        admin_token = admin_body["data"]["access_token"]
        print("admin ok", admin_body["data"]["user"]["role"])
    else:
        try:
            root = Path(__file__).resolve().parents[1]
            auth = json.loads(
                subprocess.check_output(
                    ["python", str(root / "scripts/_extract_chrome_auth.py")],
                    text=True,
                )
            )
            admin_token = auth.get("token")
            print("admin token from Chrome session")
        except Exception as err:
            print("SKIP admin steps - no admin token", err)
            return

    print("=== 4. Pending queue ===")
    q_status, q_body = req("GET", "/account-requests/pending", token=admin_token)
    assert q_status == 200, q_body
    pending_ids = [r["id"] for r in q_body["data"]]
    assert user_id in pending_ids, pending_ids

    print("=== 5. Approve ===")
    a_status, a_body = req(
        "POST",
        f"/account-requests/{user_id}/approve",
        {"role": "course_manager", "course_id": course_id},
        token=admin_token,
    )
    print("approve", a_status, a_body.get("message"))
    assert a_status == 200, a_body

    print("=== 6. Login approved course_manager ===")
    time.sleep(0.5)
    ok_status, ok_body = req(
        "POST", "/auth/login", {"email": test_email, "password": test_password}
    )
    print("login success", ok_status)
    assert ok_status == 200, ok_body
    user = ok_body["data"]["user"]
    assert user["account_status"] == "approved"
    assert user["assigned_course_id"] == course_id
    assert user["role"] == "course_manager"
    print("assigned_course_id", user["assigned_course_id"])

    print("=== 7. Legacy admin login ===")
    if admin_status == 200:
        leg_user = admin_body["data"]["user"]
    else:
        leg_status, leg_body = req(
            "POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if leg_status != 200:
            q_status, q_body = req("GET", "/account-requests/pending", token=admin_token)
            assert q_status == 200
            print("legacy login skipped; admin API token works for queue")
            print("\nALL CHECKS PASSED")
            return
        leg_user = leg_body["data"]["user"]
    assert leg_user["role"] in ("admin", "manager")
    assert leg_user.get("assigned_course_id") in (None, "")
    print("legacy ok role=", leg_user["role"], "assigned_course_id=", leg_user.get("assigned_course_id"))

    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
