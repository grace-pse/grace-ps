"""
Reboot the OVH VPS via the OVH management API.

Why: when the session's egress IP is fail2ban'd at the VPS firewall, no
SSH/SCP/HTTPS reaches the host. A reboot flushes in-memory iptables and
fail2ban state, restoring access. Containers come back automatically
(`restart: unless-stopped`).

App credentials are reused from the sibling `ovh_dns.py` script (same OVH
account). VPS scope needs its own consumer key — DNS-scoped CK won't
authorise `/vps/*` calls. CK is saved to `~/.ovh-csmp-ck-vps`; safe to
re-run.

Usage:
  python scripts/ovh-vps-reboot.py request-ck   # one-time setup
  python scripts/ovh-vps-reboot.py whoami       # sanity check (list VPS)
  python scripts/ovh-vps-reboot.py reboot       # do it
"""

import os
import sys
import time

import ovh

ENDPOINT = "ovh-eu"
APP_KEY = "9fd35722fa7d5b81"
APP_SECRET = "7037104f2d531bd8026f50d85a1e63a2"
CK_FILE = os.path.expanduser("~/.ovh-csmp-ck-vps")
VPS_NAME = "vps-c1113ded.vps.ovh.net"


def load_ck():
    if os.path.exists(CK_FILE):
        with open(CK_FILE) as f:
            v = f.read().strip()
            if v:
                return v
    return None


def save_ck(ck):
    with open(CK_FILE, "w") as f:
        f.write(ck)
    os.chmod(CK_FILE, 0o600)


def make_client(ck=None):
    return ovh.Client(
        endpoint=ENDPOINT,
        application_key=APP_KEY,
        application_secret=APP_SECRET,
        consumer_key=ck,
    )


def cmd_request_ck():
    """Request a new consumer key with VPS scope and print the
    validation URL. User clicks it, accepts in the OVH UI, then re-runs
    `whoami` or `reboot`."""
    client = make_client(ck=None)
    rules = [
        {"method": "GET", "path": "/vps/*"},
        {"method": "POST", "path": "/vps/*"},
    ]
    res = client.request_consumerkey(rules)
    save_ck(res["consumerKey"])
    print("Consumer key saved to", CK_FILE)
    print()
    print("OPEN THIS URL IN YOUR BROWSER AND CLICK ACCEPT:")
    print()
    print("   ", res["validationUrl"])
    print()
    print("Then re-run: python scripts/ovh-vps-reboot.py whoami")


def cmd_whoami():
    ck = load_ck()
    if not ck:
        print("No consumer key — run `request-ck` first.")
        sys.exit(1)
    client = make_client(ck)
    services = client.get("/vps")
    print("VPS services on this account:", services)
    if VPS_NAME not in services:
        print(f"WARNING: expected {VPS_NAME} not in list")
        sys.exit(2)
    info = client.get(f"/vps/{VPS_NAME}")
    print("Status:", info.get("state"), "· Display name:", info.get("displayName"))


def cmd_reboot():
    ck = load_ck()
    if not ck:
        print("No consumer key — run `request-ck` first.")
        sys.exit(1)
    client = make_client(ck)
    print(f"Rebooting {VPS_NAME} ...")
    task = client.post(f"/vps/{VPS_NAME}/reboot")
    print("Reboot task:", task)
    print()
    print("Watch task progress (will show 'done' when finished):")
    task_id = task.get("id")
    if not task_id:
        return
    for _ in range(30):
        time.sleep(10)
        try:
            t = client.get(f"/vps/{VPS_NAME}/tasks/{task_id}")
            print("  ", t.get("state"), "·", t.get("progress"), "%")
            if t.get("state") in ("done", "error", "cancelled"):
                break
        except Exception as e:
            print("  poll failed:", e)
            break


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "request-ck":
        cmd_request_ck()
    elif cmd == "whoami":
        cmd_whoami()
    elif cmd == "reboot":
        cmd_reboot()
    else:
        print("Unknown command:", cmd)
        sys.exit(1)


if __name__ == "__main__":
    main()
