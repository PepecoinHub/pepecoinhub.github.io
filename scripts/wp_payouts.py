#!/usr/bin/env python3
"""Weekly Pepe Guesser payout list, sent to a private Discord channel through a webhook.

Reads the open rewards (summed per address) from Supabase with the robot token and posts one ready line per
address, e.g. "send 12.5 PEP to P...", so the host only has to copy them into the tip bot.
It moves no coins and marks nothing as paid: after paying, the host marks the rewards in the PondOS host panel.

Env: WP_ROBOT_TOKEN (secret), WP_PAYOUT_WEBHOOK (secret, a Discord webhook URL),
     WP_PAYOUT_TEMPLATE (optional, default "send {amount} PEP to {address}").
The Actions log of a public repository is public: it never prints addresses, nicknames or the webhook.
"""
import json
import os
import pathlib
import re
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
UA = "PepecoinHubPayouts/1.0 (https://pepecoinhub.com/meme/)"
DEFAULT_TEMPLATE = "send {amount} PEP to {address}"


def rpc(name, args):
    js = (ROOT / "docs" / "games" / "js" / "config.js").read_text()
    url = re.search(r"supabaseUrl:\s*'([^']+)'", js).group(1)
    key = re.search(r"supabaseKey:\s*'([^']+)'", js).group(1)
    req = urllib.request.Request(f"{url}/rest/v1/rpc/{name}", data=json.dumps(args).encode(),
                                 headers={"apikey": key, "Content-Type": "application/json", "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"null")


def amount(x):
    s = f"{round(float(x), 2):.2f}".rstrip("0").rstrip(".")
    return s or "0"


def lines(rows, template):
    if "{address}" not in template or "{amount}" not in template:
        template = DEFAULT_TEMPLATE
    return [template.replace("{amount}", amount(r["pep"])).replace("{address}", r["address"]) for r in rows]


def post(hook, content):
    body = json.dumps({"content": content, "allowed_mentions": {"parse": []}}).encode()
    req = urllib.request.Request(hook, data=body, headers={"Content-Type": "application/json", "User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30):
                return
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                time.sleep(float(e.headers.get("Retry-After", "2")) + 0.5)
                continue
            raise


def main():
    token = os.environ.get("WP_ROBOT_TOKEN", "")
    hook = os.environ.get("WP_PAYOUT_WEBHOOK", "")
    if not token or not hook:
        print("WP_ROBOT_TOKEN or WP_PAYOUT_WEBHOOK is not set: nothing to do.")
        return
    template = os.environ.get("WP_PAYOUT_TEMPLATE") or DEFAULT_TEMPLATE
    d = rpc("gry_wp_robot_payouts", {"p_token": token})
    rows = d.get("rows") or []
    total = sum(float(r["pep"]) for r in rows)
    claims = sum(int(r["claims"]) for r in rows)
    if not rows:
        post(hook, "🐸 **Pepe Guesser payouts:** no open rewards this week." + (f" ({d.get('held')} held)" if d.get("held") else ""))
        print("No open rewards; sent a short note.")
        return
    head = [f"🐸 **Pepe Guesser payouts:** {len(rows)} addresses, {claims} rewards, **{amount(total)} PEP** in total."]
    if d.get("shared_addresses"):
        head.append(f"⚠ {d['shared_addresses']} address(es) were used by more than one player: check the host panel before you pay.")
    if d.get("held"):
        head.append(f"{d['held']} held reward(s) are not on the list.")
    head.append("One line per message below: long press → Copy Text → paste to the bot. "
                "After paying, mark them as paid in PondOS (Pepe Guesser host tools → Payouts).")
    post(hook, "\n".join(head))
    for line in lines(rows, template):
        time.sleep(1.2)   # Discord webhooks allow about 5 messages per 2 seconds
        post(hook, line)
    print(f"Sent {len(rows)} lines.")


if __name__ == "__main__":
    main()
