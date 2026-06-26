#!/usr/bin/env python3
"""Check the research template for common startup and handoff issues."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MAX_TRACKED_BYTES = 100 * 1024 * 1024

REQUIRED_FILES = [
    "README.md",
    "MEMORY.md",
    "AGENTS.md",
    "CLAUDE.md",
    ".github/copilot-instructions.md",
    "doc/PROJECT_STATUS.md",
    "doc/DECISIONS.md",
    "doc/DAILY_LOG.md",
    "doc/WORKLOG.md",
    "doc/ENVIRONMENT.md",
    "doc/NEW_PROJECT_CHECKLIST.md",
    "scripts/log_commit.py",
    "scripts/run_analysis.py",
    "profiling/template_analysis.Rmd",
    "profiling/template_notebook.ipynb",
    "examples/README.md",
    "examples/wright_fisher_selection_drift.Rmd",
    "requirements.txt",
]

REQUIRED_METADATA_LABELS = [
    "Principal investigator or project lead",
    "Biological system, organism, or study domain",
    "Data owner or steward",
    "Compute environment",
    "Expected deliverables",
    "Review status",
]


def git_output(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=REPO_ROOT, text=True).strip()


def check(condition: bool, message: str, failures: list[str], warnings: list[str], warning: bool = False) -> None:
    if condition:
        print(f"PASS {message}")
    elif warning:
        warnings.append(message)
        print(f"WARN {message}")
    else:
        failures.append(message)
        print(f"FAIL {message}")


def file_text(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text()


def check_required_files(failures: list[str], warnings: list[str]) -> None:
    for relative_path in REQUIRED_FILES:
        check((REPO_ROOT / relative_path).exists(), f"required file exists: {relative_path}", failures, warnings)


def check_metadata_contract(failures: list[str], warnings: list[str]) -> None:
    readme = file_text("README.md")
    for label in REQUIRED_METADATA_LABELS:
        check(f"- {label}:" in readme, f"README includes metadata field: {label}", failures, warnings)


def check_literate_defaults(failures: list[str], warnings: list[str]) -> None:
    files = ["README.md", "MEMORY.md", "AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"]
    combined = "\n".join(file_text(name) for name in files)
    check(".Rmd" in combined, "assistant docs mention .Rmd default", failures, warnings)
    check(".Rmd` or `.qmd" not in combined, "assistant docs no longer default to mixed Rmd/qmd", failures, warnings)


def check_slurm_contract(failures: list[str], warnings: list[str]) -> None:
    check((REPO_ROOT / "slurm-scripts").is_dir(), "slurm-scripts directory exists", failures, warnings)
    slurm_text = file_text("slurm-scripts/hcc_job_template.sh")
    match = re.search(r"python\s+(scripts/run_analysis\.py)\s+--input\s+(\S+)\s+--output\s+(\S+)", slurm_text)
    check(match is not None, "Slurm template hands off to scripts/run_analysis.py", failures, warnings)
    if match:
        check((REPO_ROOT / match.group(1)).exists(), f"Slurm handoff script exists: {match.group(1)}", failures, warnings)
        check((REPO_ROOT / match.group(2)).exists(), f"Slurm example input exists: {match.group(2)}", failures, warnings)


def check_large_tracked_files(failures: list[str], warnings: list[str]) -> None:
    try:
        tracked_files = [line for line in git_output("ls-files").splitlines() if line]
    except subprocess.CalledProcessError:
        check(False, "Git tracked-file list is available", failures, warnings, warning=True)
        return

    oversized = []
    tracked_largedata = []
    for relative_path in tracked_files:
        path = REPO_ROOT / relative_path
        if path.exists() and path.is_file() and path.stat().st_size > MAX_TRACKED_BYTES:
            oversized.append(relative_path)
        if relative_path.startswith("largedata/") and not relative_path.endswith(".gitkeep"):
            tracked_largedata.append(relative_path)

    check(not oversized, "no tracked files exceed 100 MB", failures, warnings)
    check(not tracked_largedata, "largedata contains only tracked keepers", failures, warnings)

    try:
        staged_files = [line for line in git_output("diff", "--cached", "--name-only").splitlines() if line]
    except subprocess.CalledProcessError:
        check(False, "Git staged-file list is available", failures, warnings, warning=True)
        return

    oversized_staged = []
    for relative_path in staged_files:
        path = REPO_ROOT / relative_path
        if path.exists() and path.is_file() and path.stat().st_size > MAX_TRACKED_BYTES:
            oversized_staged.append(relative_path)

    check(not oversized_staged, "no staged files exceed 100 MB", failures, warnings)


def check_daily_log_alignment(failures: list[str], warnings: list[str]) -> None:
    try:
        latest_hash = git_output("log", "-1", "--pretty=%h")
    except subprocess.CalledProcessError:
        check(False, "Git latest commit is available", failures, warnings, warning=True)
        return
    daily_log = file_text("doc/DAILY_LOG.md")
    check(latest_hash in daily_log, f"daily log mentions latest commit {latest_hash}", failures, warnings, warning=True)


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []

    print("Research template doctor\n")
    check_required_files(failures, warnings)
    check_metadata_contract(failures, warnings)
    check_literate_defaults(failures, warnings)
    check_slurm_contract(failures, warnings)
    check_large_tracked_files(failures, warnings)
    check_daily_log_alignment(failures, warnings)

    print("\nSummary")
    print(f"Failures: {len(failures)}")
    print(f"Warnings: {len(warnings)}")

    if failures:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
