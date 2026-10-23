import glob
import os

import httpx

BASE = "http://127.0.0.1:8001"
EMAIL = "test@example.com"
PASSWORD = "testpass123"

with httpx.Client(timeout=60) as c:
    r = c.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    r.raise_for_status()
    headers = {"Authorization": "Bearer " + r.json()["token"]}
    files = sorted(glob.glob(os.path.join("jobs", "*.txt")))
    ok = 0
    for path in files:
        expected = os.path.basename(path).rsplit("_", 1)[0]
        text = open(path, encoding="utf-8").read()
        r = c.post(f"{BASE}/roles/detect", headers=headers, data={"text": text})
        r.raise_for_status()
        got = r.json()
        hit = got["role"] == expected
        ok += hit
        print("OK  " if hit else "MISS", os.path.basename(path), "->", got["role"],
              got["confidence"], got["default_template"])
    print(f"{ok}/{len(files)} correct")
