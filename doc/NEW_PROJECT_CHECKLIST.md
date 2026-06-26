# New Project Checklist

Use this checklist when copying the template into a real research project.

## Project Identity

- [ ] Rename the project in `README.md`.
- [ ] Replace the project snapshot with the real research question, data sources, languages, outputs, and current phase.
- [ ] Fill the required project metadata in `README.md`.
- [ ] Remove or archive example analyses that are not relevant to the new project.

## Human Review Gates

- [ ] Confirm the research question with the project lead.
- [ ] Confirm primary data sources and data-use constraints with the data owner or steward.
- [ ] Confirm the first analysis strategy before automated modeling or interpretation.
- [ ] Record method-changing decisions in `doc/DECISIONS.md`.

## Environment

- [ ] Document local paths, HCC paths, modules, and project-local environments in `doc/ENVIRONMENT.md`.
- [ ] Decide whether work will run locally, on HCC, or both.
- [ ] If using HCC, verify the runtime context before compute work.
- [ ] If using HCC, check system-wide modules with `module avail`, record exact loaded module versions, then check `$HOME/bin` only if modules do not provide the tool.
- [ ] Keep large working data in `largedata/` and outside Git history.

## Reproducible Analysis

- [ ] Use `.Rmd` as the default literate analysis format.
- [ ] Use `.ipynb` only when interactive Python exploration is the better fit.
- [ ] Keep assumptions, inputs, outputs, and parameters near the top of scripts and reports.
- [ ] Make scripts runnable from the repository root.
- [ ] Keep reusable helpers in `lib/`.

## Git And Project Memory

- [ ] Initialize fresh Git history for the copied project.
- [ ] Create or connect the private GitHub repository when needed.
- [ ] Update `doc/PROJECT_STATUS.md` with current state and next step.
- [ ] Add the first project-specific entry to `doc/WORKLOG.md`.
- [ ] Keep one `doc/DAILY_LOG.md` entry per commit.
- [ ] Run `python3 scripts/doctor.py` before the first handoff.
