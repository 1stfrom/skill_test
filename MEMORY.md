# Stable Template And Agent Memory

Do not casually rewrite this file when starting a new project from the template.

This file is the stable memory contract for the repository. It defines the shared workflow and structure that human collaborators and AI assistants rely on across copied projects.

## What This Template Does

This template keeps project memory in plain Markdown files inside the repository so humans, GitHub Copilot, Claude Code, and Codex can all work from the same source of truth.

The goal is simple:

- humans stay in control of research direction and interpretation
- assistants help with coding, documentation, and routine project maintenance
- project context stays portable instead of being trapped inside one AI tool

## Core Tracking Files

Review these files regularly.

| File | Purpose | Typical update time |
|------|---------|---------------------|
| `doc/PROJECT_STATUS.md` | What is done, what is active, what is next | After a phase changes |
| `doc/DECISIONS.md` | Important choices and why they were made | When direction or method changes |
| `doc/DAILY_LOG.md` | One human-readable record per commit | After each commit |
| `doc/WORKLOG.md` | Session notes and handoff context | End of a work session |
| `doc/ENVIRONMENT.md` | Local, HCC, and GitHub setup notes | When environment details change |
| `doc/NEW_PROJECT_CHECKLIST.md` | Startup checklist for a copied project | When a new project starts |
| `AGENTS.md` | Shared assistant rules and coding expectations | Only when template behavior changes |

## Directory Layout

| Directory | Purpose |
|-----------|---------|
| `data/` | Source data and small tracked reference files, ideally under 100 MB per file |
| `largedata/` | Files over 100 MB and other large local working data kept out of Git |
| `cache/` | Rebuildable intermediate files |
| `lib/` | Shared helper functions |
| `profiling/` | Exploratory analysis, notebooks, and literate method development |
| `graphs/` | Figures and visualization outputs |
| `reports/` | Rendered outputs for review or sharing |
| `doc/` | Status, decisions, environment notes, and logs |
| `slurm-scripts/` | HCC batch scripts |
| `slurm-log/` | HCC stdout and stderr logs |

Embedded template concepts:

### Project layout principles

- Keep each top-level directory single-purpose so collaborators can predict where things belong.
- Store source data in `data/`, rebuildable intermediates in `cache/`, reusable code in `lib/`, exploratory work in `profiling/`, and rendered outputs in `reports/` or `graphs/`.
- Keep project memory and planning documents in `doc/` so scientific decisions and project state remain visible.
- Separate scientific code from execution wrappers such as Slurm submission scripts.
- Prefer layouts where important outputs can be regenerated rather than treated as irreplaceable black boxes.

### HCC workflow principles

- Use the cluster for heavy computation and keep the login or head node for setup, inspection, and light coordination work.
- Keep batch job scripts in `slurm-scripts/` and write their stdout and stderr to `slurm-log/`.
- Document modules, environments, resource requests, and expected inputs directly in the batch script or in `doc/ENVIRONMENT.md`.
- Treat large working storage as temporary operational space, not your only archival copy of important data.
- Think of path roles this way: `$HOME` for personal setup, `$WORK` for active compute outputs, and `$COMMON` for shared resources used across systems.

## Research Workflow

### 1. Decide before you automate

Before substantial new work, review `doc/PROJECT_STATUS.md` and `doc/DECISIONS.md`. If the work changes research direction, methodology, or interpretation, a human should decide before an assistant proceeds.

### 2. Keep analysis reproducible

- Prefer R and Python.
- Prefer `.Rmd` for reproducible reports and method development.
- Use `.ipynb` when interactive Python work is genuinely the better fit.
- Put assumptions, inputs, outputs, and parameters near the top of each file.
- Keep one main purpose per script or notebook.
- Write scripts so they can be rerun from the project root.

### 3. Keep the repository light

- Do not put files larger than 100 MB in `data/`.
- Put files larger than 100 MB in `largedata/` and keep them out of Git.
- Treat `largedata/` as working storage, not archival storage.
- On HCC, inactive large files may be purged after about three months, so durable raw data should also live in a safer long-term location.

### 4. Record work as you go

After each commit, append one matching entry to `doc/DAILY_LOG.md` with the helper `python3 scripts/log_commit.py` or by editing the file directly.

Each entry should include:

- commit hash
- summary of what changed
- main files touched
- result or impact
- next concrete step

At the end of a work session, update `doc/WORKLOG.md` if a future collaborator or assistant would benefit from the context.

## Memory Website

A lightweight Node.js site is included for browsing project memory and logs in a human-friendly way.

Run it from the repository root:

```bash
npm start
```

Then open:

- `http://localhost:3000/`
- `http://localhost:3000/daily-log`

The site reads the tracked Markdown files directly.

## Minimum Project Metadata

Every project created from this template should fill in these README fields before analysis work begins:

- Principal investigator or project lead
- Biological system, organism, or study domain
- Data owner or steward
- Compute environment
- Expected deliverables
- Review status

## Assistant Configuration

These files define assistant behavior:

| File | Used by |
|------|---------|
| `AGENTS.md` | Shared rules for all assistants |
| `CLAUDE.md` | Claude Code |
| `.github/copilot-instructions.md` | GitHub Copilot |

For normal project startup, edit `README.md` for project-specific context and leave this file stable. Change this file only when you intentionally want to change the template's shared assistant workflow.
