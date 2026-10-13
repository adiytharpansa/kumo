#!/usr/bin/env python3
"""Jalankan wrangler dengan kredensial konektor custom.cloudflare.

Surrogate hsurr:* diambil sesaat dari authd dan diteruskan ke proses
wrangler lewat environment (tidak dicetak, tidak disimpan ke berkas).
Token asli tidak pernah disentuh skrip ini.

Pakai: python3 cf.py <perintah wrangler...>   mis. python3 cf.py deploy
"""
import json
import os
import subprocess
import sys
import urllib.request

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, dynamic_credential_entry, read_json_response

API = "https://api.cloudflare.com/client/v4"
HOSTS = ["api.cloudflare.com"]
CRED = "custom.cloudflare"


def api_get(path):
    req = urllib.request.Request(API + path, method="GET")
    add_surrogate_to_request(req, CRED, allowed_hosts=HOSTS)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return read_json_response(resp)


def main():
    if len(sys.argv) < 2:
        print("usage: cf.py <wrangler args...>")
        return 2
    entry = dynamic_credential_entry(CRED, "access_token")
    surrogate = entry["surrogate"]
    acc = (api_get("/accounts").get("result") or [{}])[0].get("id", "")
    env = dict(os.environ)
    env["CLOUDFLARE_API_TOKEN"] = surrogate
    if acc:
        env["CLOUDFLARE_ACCOUNT_ID"] = acc
    env.setdefault("WRANGLER_SEND_METRICS", "false")
    cmd = ["npx", "wrangler"] + sys.argv[1:]
    proc = subprocess.run(cmd, env=env, cwd=os.path.dirname(os.path.abspath(__file__)))
    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())
