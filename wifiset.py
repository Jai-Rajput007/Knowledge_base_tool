#!/usr/bin/env python3
"""
wifiset.py — point the whole dashboard at the Thor's current Wi-Fi (LAN) IP.

The Thor's Wi-Fi address is DHCP, so it changes whenever it reconnects or moves to
another network (a phone hotspot especially). Four env files carry that address; the
client dashboard also compiles it into its browser bundle, so a rebuild is required
before the new value actually takes effect.

Usage (run from anywhere, as the user that runs pm2):

    python3 wifiset.py 10.194.179.95     # set this IP, rebuild, restart
    python3 wifiset.py                   # use the machine's own Wi-Fi IP
    python3 wifiset.py 10.194.179.95 --dry-run     # show what would change
    python3 wifiset.py 10.194.179.95 --no-build    # edit files only
    python3 wifiset.py 10.194.179.95 --no-restart  # edit + build, don't restart pm2

What it touches (nothing else — the robot's own 192.168.123.x wired subnet is
separate and must never change with Wi-Fi):

    backend/.env                        AGX_IP, WAKEWORD_AGX_IP
    frontend/g1-dashboard/.env          NEXT_PUBLIC_API_URL   (host part only)
    frontend/g1-dashboard/.env.local    NEXT_PUBLIC_API_URL
    .env.local                          NEXT_PUBLIC_API_URL

Temporary helper: the two hardcoded IPs in navigation.py and app/api/wakewords/route.ts
should become 127.0.0.1 in the code, after which only these env files ever change.
"""

import argparse
import ipaddress
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# file -> keys to rewrite. "url" keys keep their scheme/port/path, only the host changes.
TARGETS: list[tuple[str, list[str], str]] = [
    ("backend/.env", ["AGX_IP", "WAKEWORD_AGX_IP"], "plain"),
    ("frontend/g1-dashboard/.env", ["NEXT_PUBLIC_API_URL"], "url"),
    ("frontend/g1-dashboard/.env.local", ["NEXT_PUBLIC_API_URL"], "url"),
    (".env.local", ["NEXT_PUBLIC_API_URL"], "url"),
]

RESTART_APPS = ["g1-backend", "g1-dashboard", "g1-super-admin"]

GREEN, YELLOW, RED, DIM, RESET = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"


def say(msg: str, colour: str = "") -> None:
    print(f"{colour}{msg}{RESET}" if colour else msg)


def detect_ip() -> str:
    """This machine's own LAN IPv4 (first non-loopback, non-docker, non-robot-subnet)."""
    out = subprocess.run(["ip", "-4", "-o", "addr", "show"], capture_output=True, text=True).stdout
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 4:
            continue
        iface, addr = parts[1], parts[3].split("/")[0]
        if iface == "lo" or iface.startswith(("docker", "br-", "veth", "l4tbr")):
            continue
        if addr.startswith("192.168.123."):        # the robot's wired DDS subnet — never this one
            continue
        return addr
    sys.exit(f"{RED}Could not detect a LAN IP — pass one explicitly: python3 wifiset.py <ip>{RESET}")


def valid_ip(value: str) -> str:
    try:
        ip = ipaddress.IPv4Address(value)
    except ipaddress.AddressValueError:
        sys.exit(f"{RED}'{value}' is not a valid IPv4 address.{RESET}")
    if value.startswith("192.168.123."):
        sys.exit(f"{RED}{value} is on the robot's wired subnet (192.168.123.x), not the Wi-Fi "
                 f"network. Use the address shown for wlP1p1s0.{RESET}")
    if ip.is_loopback:
        sys.exit(f"{RED}{value} is a loopback address — other devices could not reach the "
                 f"dashboard at that address.{RESET}")
    return value


def replace_host_in_url(url: str, new_ip: str) -> str:
    """http://1.2.3.4:8000/api/v1 -> http://<new_ip>:8000/api/v1 (quotes preserved by caller)."""
    return re.sub(r"(?<=//)[^/:]+", new_ip, url, count=1)


def rewrite(path: Path, keys: list[str], kind: str, new_ip: str, dry_run: bool) -> list[str]:
    """Rewrite `keys` in one env file. Returns human-readable change lines."""
    if not path.exists():
        say(f"  ! {path.relative_to(ROOT)} not found — skipped", YELLOW)
        return []

    original = path.read_text()
    text, changes = original, []

    for key in keys:
        pattern = re.compile(rf"^(\s*{re.escape(key)}\s*=\s*)(\"?'?)([^\s\"'#]*)(.*)$", re.MULTILINE)
        match = pattern.search(text)
        if not match:
            say(f"  ! {key} not found in {path.relative_to(ROOT)} — skipped", YELLOW)
            continue

        old_value = match.group(3)
        new_value = replace_host_in_url(old_value, new_ip) if kind == "url" else new_ip
        if old_value == new_value:
            say(f"  = {key} already {old_value}", DIM)
            continue

        text = pattern.sub(lambda m: f"{m.group(1)}{m.group(2)}{new_value}{m.group(4)}", text, count=1)
        changes.append(f"{key}: {old_value} -> {new_value}")

    if not changes:
        return []
    if dry_run:
        for c in changes:
            say(f"  ~ would set {c}", YELLOW)
        return changes

    backup = path.with_suffix(path.suffix + f".bak-{datetime.now():%Y%m%d-%H%M%S}")
    shutil.copy2(path, backup)                    # one-command rollback if anything looks wrong
    path.write_text(text)
    for c in changes:
        say(f"  + {c}", GREEN)
    say(f"    backup: {backup.name}", DIM)
    return changes


def run(cmd: list[str], what: str) -> None:
    say(f"\n>> {what}: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        sys.exit(f"{RED}{what} failed (exit {result.returncode}). "
                 f"Env files are already updated — fix the error and re-run "
                 f"./start.sh build manually.{RESET}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Point the dashboard at the Thor's current Wi-Fi IP.")
    parser.add_argument("ip", nargs="?", help="new Wi-Fi IP (default: this machine's own LAN IP)")
    parser.add_argument("--dry-run", action="store_true", help="show changes, write nothing")
    parser.add_argument("--no-build", action="store_true", help="skip ./start.sh build")
    parser.add_argument("--no-restart", action="store_true", help="skip the pm2 restart")
    args = parser.parse_args()

    new_ip = valid_ip(args.ip) if args.ip else detect_ip()
    if not args.ip:
        say(f"Detected this machine's LAN IP: {new_ip}", DIM)

    say(f"\nSetting the dashboard's Thor address to {GREEN}{new_ip}{RESET}"
        f"{'  (dry run)' if args.dry_run else ''}\n")

    total = 0
    for rel, keys, kind in TARGETS:
        say(f"{rel}")
        total += len(rewrite(ROOT / rel, keys, kind, new_ip, args.dry_run))

    if args.dry_run:
        say(f"\nDry run — {total} change(s) would be made, nothing written.", YELLOW)
        return

    if total == 0:
        say("\nEverything already points at this IP — nothing to rebuild.", GREEN)
        return

    if args.no_build:
        say("\nEnv files updated. Skipped the build (--no-build).", YELLOW)
        say("NEXT_PUBLIC_API_URL is compiled into the browser bundle, so the dashboard keeps "
            "using the OLD address until you run: ./start.sh build", YELLOW)
        return

    run(["./start.sh", "build"], "Rebuilding the dashboards")

    if args.no_restart:
        say("\nBuilt. Skipped the restart (--no-restart) — run "
            f"'pm2 restart {' '.join(RESTART_APPS)}' to serve the new build.", YELLOW)
        return

    run(["pm2", "restart", *RESTART_APPS], "Restarting services")

    say(f"\n{GREEN}Done.{RESET} The dashboard is now at "
        f"{GREEN}http://{new_ip}:3000{RESET} (super admin: http://{new_ip}:3001).")
    say("Devices must be on the same network as the Thor to open it.", DIM)


if __name__ == "__main__":
    main()
