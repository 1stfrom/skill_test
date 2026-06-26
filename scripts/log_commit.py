#!/usr/bin/env python3
"""Append or update an entry in doc/DAILY_LOG.md from the latest Git commit."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DAILY_LOG = REPO_ROOT / "doc" / "DAILY_LOG.md"


def git_output(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=REPO_ROOT, text=True).strip()


def latest_commit() -> dict[str, str]:
    parts = git_output("log", "-1", "--date=short", "--pretty=format:%H\t%h\t%ad\t%s")
    full_hash, short_hash, date, subject = parts.split("\t", 3)
    files = git_output("diff-tree", "--no-commit-id", "--name-only", "-r", full_hash)
    file_list = [line.strip() for line in files.splitlines() if line.strip()]
    return {
        "full_hash": full_hash,
        "short_hash": short_hash,
        "date": date,
        "subject": subject,
        "files": ", ".join(f"`{name}`" for name in file_list) if file_list else "`none recorded`",
    }


def load_daily_log() -> str:
    return DAILY_LOG.read_text()


def save_daily_log(text: str) -> None:
    DAILY_LOG.write_text(text.rstrip() + "\n")


def replace_pending_entry(text: str, commit: dict[str, str]) -> tuple[str, bool]:
    marker = "- Commit: `pending`"
    if marker not in text:
        return text, False

    updated = text.replace(marker, f"- Commit: `{commit['short_hash']}`", 1)
    updated = updated.replace(
        "- Next: replace the `pending` hash in this entry after the commit if strict hash recording is needed.",
        "- Next: review whether the next action in this entry is still current, then revise it if needed.",
        1,
    )
    return updated, True


def append_entry(text: str, commit: dict[str, str], args: argparse.Namespace) -> str:
    title = args.title or commit["subject"].lower()
    summary = args.summary or commit["subject"]
    impact = args.impact or "Document the practical effect of this commit."
    next_step = args.next_step or "Describe the next concrete step."
    files = args.files or commit["files"]

    if f"- Commit: `{commit['short_hash']}`" in text:
        return text

    entry = f"""

## {commit['date']} - {title}

- Commit: `{commit['short_hash']}`
- Summary: {summary}
- Files: {files}
- Results or impact: {impact}
- Next: {next_step}
"""
    return text.rstrip() + entry + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Update doc/DAILY_LOG.md from the latest Git commit.")
    parser.add_argument("--title", help="Short title for the daily log heading.")
    parser.add_argument("--summary", help="One or two sentence summary for the entry.")
    parser.add_argument("--files", help="Override the auto-detected file list.")
    parser.add_argument("--impact", help="Describe the result or impact of the commit.")
    parser.add_argument("--next-step", help="Describe the next concrete step.")
    parser.add_argument(
        "--mode",
        choices=["auto", "append", "update-pending"],
        default="auto",
        help="auto updates the first pending entry if present, otherwise appends a new one.",
    )
    args = parser.parse_args()

    commit = latest_commit()
    text = load_daily_log()

    if args.mode in {"auto", "update-pending"}:
        updated_text, changed = replace_pending_entry(text, commit)
        if changed:
            save_daily_log(updated_text)
            print(f"Updated pending daily-log entry with commit {commit['short_hash']}")
            return
        if args.mode == "update-pending":
            print("No pending entry found.")
            return

    updated_text = append_entry(text, commit, args)
    if updated_text == text:
        print(f"Daily log already contains commit {commit['short_hash']}")
        return

    save_daily_log(updated_text)
    print(f"Appended daily-log entry for commit {commit['short_hash']}")


if __name__ == "__main__":
    main()
