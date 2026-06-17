#!/usr/bin/env python3
"""
Sync Fast-F1 cache from local machine to Fly.io volume.

Run this script after each race weekend once the session is loaded locally.
It will detect new .ff1pkl files, upload them to the Fly.io backend volume,
and restart the backend to pick up the new data.

Usage:
    python scripts/sync_cache.py
    python scripts/sync_cache.py --dry-run
    python scripts/sync_cache.py --local-cache /path/to/fastf1/cache

Requirements:
    pip install requests
    flyctl installed and authenticated
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path


APP = "f1-telemetry-api"
REMOTE_BASE = "/data/fastf1"
API_BASE = "https://f1-telemetry-api.fly.dev"

SESSION_SLUG_TO_TYPE = {
    "Race": "R",
    "Qualifying": "Q",
    "Sprint": "S",
    "Sprint_Qualifying": "SQ",
    "Practice_1": "FP1",
    "Practice_2": "FP2",
    "Practice_3": "FP3",
}


def fly_sftp(commands: list[str]) -> str:
    """Run a batch of SFTP commands in a single fly sftp shell session."""
    input_str = "\n".join(commands) + "\n"
    result = subprocess.run(
        ["fly", "sftp", "shell", "--app", APP],
        input=input_str,
        capture_output=True,
        text=True,
        timeout=300,
    )
    return result.stdout + result.stderr


def ensure_machine_running() -> None:
    """Wake the backend machine if it's stopped (auto_stop_machines)."""
    result = subprocess.run(
        ["fly", "machine", "list", "--app", APP, "--json"],
        capture_output=True, text=True, timeout=30,
    )
    try:
        machines = json.loads(result.stdout)
        for m in machines:
            mid = m.get("id") or m.get("ID")
            state = m.get("state") or m.get("State", "")
            if mid and state in ("stopped", ""):
                print(f"  Starting machine {mid}…")
                subprocess.run(["fly", "machine", "start", mid, "--app", APP], timeout=30)
                time.sleep(5)
    except Exception:
        pass


def remote_ls(path: str) -> set[str]:
    out = fly_sftp([f"ls {path}"])
    results = set()
    for line in out.strip().splitlines():
        line = line.rstrip("/").strip()
        # Skip error messages and empty lines; keep only valid filenames/dirnames
        if not line:
            continue
        if any(kw in line.lower() for kw in ("error", "no started", "does not exist", "ls:", "put ", "chmod", "get ", ">")):
            continue
        results.add(line)
    return results


def event_name_from_slug(slug: str) -> str:
    """'2026-06-14_Barcelona_Grand_Prix' → 'Barcelona Grand Prix'"""
    parts = slug.split("_", 1)
    return parts[1].replace("_", " ") if len(parts) > 1 else slug


def session_type_from_slug(slug: str) -> str:
    """'2026-06-14_Race' → 'R'"""
    suffix = "_".join(slug.split("_")[3:]) if len(slug.split("_")) > 3 else slug.split("_")[-1]
    return SESSION_SLUG_TO_TYPE.get(suffix, "R")


def remote_dir_exists(path: str) -> bool:
    """Check if a remote directory exists by listing its parent."""
    parent = "/".join(path.rstrip("/").split("/")[:-1])
    dirname = path.rstrip("/").split("/")[-1]
    return dirname in remote_ls(parent)


def trigger_dir_creation(year: str, event_name: str, session_type: str, remote_dir: str) -> bool:
    """
    Hit the backend API so Fast-F1 creates the cache directory structure.
    The request will fail (data not on server), but the directory gets created.
    Polls until the remote directory appears (up to 30 s).
    """
    import urllib.request
    import urllib.parse
    encoded = urllib.parse.quote(event_name)
    url = f"{API_BASE}/sessions/{year}/{encoded}/{session_type}/laps"
    try:
        urllib.request.urlopen(urllib.request.Request(url), timeout=30)
    except Exception:
        pass

    # Poll until the SESSION directory itself appears (even if empty)
    for _ in range(15):
        time.sleep(2)
        try:
            if remote_dir_exists(remote_dir):
                return True
        except Exception:
            pass
    return False


def upload_session(
    year: str,
    event_slug: str,
    session_slug: str,
    session_dir: Path,
    dry_run: bool,
) -> int:
    remote_session = f"{REMOTE_BASE}/{year}/{event_slug}/{session_slug}"

    try:
        remote_files = remote_ls(remote_session)
    except Exception:
        remote_files = set()

    local_files = sorted(session_dir.glob("*.ff1pkl"))
    missing = [f for f in local_files if f.name not in remote_files]

    if not missing:
        print(f"    ✓ {session_slug} already in sync ({len(local_files)} files)")
        return 0

    print(f"    → {session_slug}: {len(missing)}/{len(local_files)} files to upload")

    if dry_run:
        for f in missing:
            print(f"      [dry-run] would upload {f.name}")
        return len(missing)

    # Create directory via API if it doesn't exist on the remote volume yet
    if not remote_dir_exists(remote_session):
        event_name = event_name_from_slug(event_slug)
        session_type = session_type_from_slug(session_slug)
        print(f"      Creating remote directory via API ({event_name} / {session_type})…")
        ok = trigger_dir_creation(year, event_name, session_type, remote_session)
        if not ok:
            print(f"      ⚠ Directory not created after 30 s — skipping {session_slug}")
            return 0

    # Batch all puts into one SFTP session
    cmds = [f"put {f} {remote_session}/{f.name}" for f in missing]
    out = fly_sftp(cmds)

    uploaded = out.count("bytes written")
    failed = [line for line in out.splitlines() if "does not exist" in line or "error" in line.lower()]

    for line in failed:
        filename = line.split("->")[0].replace("put ", "").strip().split("/")[-1]
        print(f"      ✗ {filename}")

    print(f"      ✓ {uploaded}/{len(missing)} files uploaded")
    return uploaded


def restart_backend() -> None:
    result = subprocess.run(
        ["fly", "machine", "list", "--app", APP, "--json"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    try:
        machines = json.loads(result.stdout)
        for m in machines:
            mid = m.get("id") or m.get("ID")
            if mid:
                subprocess.run(
                    ["fly", "machine", "restart", mid, "--app", APP],
                    check=True,
                    timeout=60,
                )
                print(f"  ✓ Machine {mid} restarted")
    except Exception as e:
        print(f"  ⚠ Could not restart: {e}")
        print("    Run manually: fly machine restart <id> --app f1-telemetry-api")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Fast-F1 cache to Fly.io")
    parser.add_argument(
        "--local-cache",
        type=Path,
        default=Path.home() / "fast-f1-backend/fast-f1-backend/.cache/fastf1",
        help="Path to local Fast-F1 cache directory",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be uploaded without doing it",
    )
    parser.add_argument(
        "--no-restart",
        action="store_true",
        help="Skip backend restart after upload",
    )
    args = parser.parse_args()

    if not args.local_cache.exists():
        print(f"Error: local cache not found at {args.local_cache}")
        print("Pass --local-cache /path/to/fastf1/cache")
        sys.exit(1)

    print(f"Local cache : {args.local_cache}")
    print(f"Remote      : {APP}:{REMOTE_BASE}")
    if args.dry_run:
        print("Mode        : dry-run\n")

    if not args.dry_run:
        print("── Ensuring backend machine is running ──")
        ensure_machine_running()

    total_uploaded = 0

    for year_dir in sorted(args.local_cache.iterdir()):
        if not year_dir.is_dir() or not year_dir.name.isdigit():
            continue
        year = year_dir.name
        print(f"\n── {year} ──")

        for event_dir in sorted(year_dir.iterdir()):
            if not event_dir.is_dir():
                continue
            event_slug = event_dir.name
            print(f"  {event_name_from_slug(event_slug)}")

            for session_dir in sorted(event_dir.iterdir()):
                if not session_dir.is_dir():
                    continue
                n = upload_session(year, event_slug, session_dir.name, session_dir, args.dry_run)
                total_uploaded += n

    print(f"\n── Summary ──")
    print(f"  Files uploaded: {total_uploaded}")

    if total_uploaded > 0 and not args.dry_run and not args.no_restart:
        print("\n── Restarting backend to clear in-memory session cache ──")
        restart_backend()
    elif total_uploaded > 0 and args.no_restart:
        print("\n⚠  Remember to restart the backend: fly machine restart <id> --app f1-telemetry-api")

    print("\nDone.")


if __name__ == "__main__":
    main()
