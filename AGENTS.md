# Research Project Agent Instructions

This repository is a portable research template. Treat the repository itself as the durable project memory.

This is a human-in-the-loop research project. When your work affects research direction, methodology, or data interpretation, pause and flag the decision for human review before proceeding.

## README And MEMORY Rule

- `README.md` is the human-facing project guide and should be edited when a new project starts.
- `MEMORY.md` is the stable template memory contract and should not be casually rewritten for project-specific needs.
- Only change `MEMORY.md` when intentionally maintaining the template itself.

## Read First

Before major work, review:

1. `README.md`
2. `MEMORY.md`
3. `doc/PROJECT_STATUS.md`
4. `doc/DECISIONS.md`
5. `doc/ENVIRONMENT.md`
6. `doc/WORKLOG.md`

After meaningful work, update the relevant file in `doc/`. After each commit, append one matching record to `doc/DAILY_LOG.md`.

## Coding And Research Preferences

- Prefer R and Python.
- Prefer `.Rmd` for reproducible research and `.ipynb` for interactive Python when it is the best fit.
- Keep code fully documented, reproducible, and human readable.
- Favor clear biological or methodological naming over short clever names.
- Keep scripts runnable from the project root whenever possible.
- Put assumptions, inputs, outputs, and parameters near the top of each script.

## Directory Conventions

- `data/` contains source data and small tracked reference files. Keep individual files under 100 MB whenever possible.
- `largedata/` contains files larger than 100 MB and other large local data that should not be committed.
- `cache/` contains rebuildable intermediates.
- `lib/` contains reusable helper code.
- `profiling/` contains exploratory analyses, notebooks, and literate documents.
- `graphs/` contains figures and related outputs.
- `reports/` contains polished rendered outputs.
- `doc/` contains plans, status, decisions, environment notes, and work logs.
- `slurm-scripts/` contains HCC batch scripts.
- `slurm-log/` contains HCC log files and should normally stay out of Git.

## HCC Expectations

- Follow the lab's HCC workflow guidance.
- Always check the runtime context before starting work. If you are on HCC and do not already have a Slurm allocation, request or obtain a compute node before doing compute work.
- Do not assume heavy jobs should run on the login node.
- On HCC, do not proceed with compute work from the login or head node. Use `srun --pty bash` for interactive work or `sbatch` for batch work.
- Keep Slurm scripts focused on execution and keep scientific logic in R or Python code.
- Preserve enough logging to debug failed cluster jobs.
- Before using software on HCC, first check the system-wide modules stack with `module avail`.
- For project R jobs on HCC, use `R/4.3` unless Nathan explicitly approves a different R version.
- If an active instruction, Slurm wrapper, or run note specifies a different HCC R module for future work, update it to `R/4.3`.
- Before every Slurm job submission, check that required modules and packages are available. For R jobs, verify `R/4.3` and the job-specific R packages before `sbatch`.
- When a module is used, document the exact module name and version that was loaded, for example `module load R/4.3`.
- If the required software is not available through modules, then check `$HOME/bin` before assuming it is unavailable.
- Treat `largedata/` as better suited to HCC working storage than long-term archival storage.
- Large inactive files on HCC may be removed after about three months, so durable raw data should also exist in a safer long-term location.
- Document local versus HCC differences in `doc/ENVIRONMENT.md`.

## Version Control

- GitHub is the authoritative history for tracked code and documentation.
- Do not commit files larger than 100 MB. Store them in `largedata/` and keep them Git-ignored.
- Avoid committing large generated files unless they are intentional deliverables.
- When a method changes, record the change in `doc/DECISIONS.md`.
- When a task ends, leave a concrete next step in `doc/PROJECT_STATUS.md`.
- After each commit, run `python3 scripts/log_commit.py` when available, or manually add one `doc/DAILY_LOG.md` entry with the commit hash, summary, touched files, impact, and next step.
