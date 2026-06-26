# Environment Notes

## Purpose

Document how the project runs locally, on HCC, and through GitHub.

## Local Development

- Use the repository root as the working directory for scripts and reports.
- Prefer project-local environments and explicit package dependencies.
- Keep large downloaded or temporary data outside tracked Git history unless it is intentionally versioned.
- Do not keep files larger than 100 MB in `data/`. Move them to `largedata/` and keep them out of Git.

## R And Python

- Prefer R for statistical analysis, visualization, and literate reporting.
- On HCC, use the `R/4.3` module for project R jobs unless Nathan explicitly approves a different R version.
- Prefer Python when it is the better tool for modeling, data engineering, or notebook-based experimentation.
- Keep reusable logic in `.R` or `.py` scripts when possible, and use notebooks or R Markdown for orchestration and interpretation.
- Use `.Rmd` as the default literate analysis format.
- Record R package management decisions here when a project adopts `renv`, system modules, or another environment strategy.
- Record Python package dependencies in `requirements.txt` or a project-specific environment file when dependencies are added.

## HCC Cluster

- User HCC login account for this project: `nathanma@swan.hcc.unl.edu`.
- HCC authentication requires the user's password and verification option 1; do not assume advisor account access for interactive SSH.
- Interactive SSH workflow: start `ssh nathanma@swan.hcc.unl.edu`, let the user type the password directly, then enter verification option `1` when prompted. Wait a few seconds for the user-side verification to complete before expecting the login shell.
- Remote HCC file changes require explicit user approval. Do not create, edit, or delete files on HCC without approval from Nathan.
- Keep heavy computation off the HCC head node.
- Detect whether a script is running locally or inside a remote Slurm job before starting compute work.
- If you are on HCC without a `SLURM_JOB_ID`, stop and request a compute node before doing compute work.
- Refuse to run compute steps when no `SLURM_JOB_ID` is present; use `srun --pty bash` for interactive sessions or submit the job with `sbatch` so it lands on a compute node.
- Store reproducible batch scripts in `slurm-scripts/`.
- Keep Slurm scripts thin. Ideally they should just declare resources, prepare the environment, and call one real Bash, Python, R, or other project script.
- Put scientific logic and most command-line options in the actual analysis script rather than embedding them in the Slurm wrapper.
- Store job logs in `slurm-log/`.
- Check that the modules system is available in each job, inspect system-wide software with `module avail`, then load and report the required modules.
- Before every Slurm submission, preflight the modules and packages that the job will use. For R jobs, check `module avail R/4.3`, load `R/4.3`, and run a light `Rscript` package-availability check for the job-specific packages before `sbatch`.
- Record the exact software module and version used in the job script or session notes, for example `module load R/4.3`.
- The baseline GBLUP job currently requires `data.table`, `readxl`, and `rrBLUP` under `R/4.3`; Nathan reported installing `rrBLUP` on 2026-06-10 after it was missing from the R environment.
- If a required tool is not available from the modules stack, check `$HOME/bin` before building or installing a separate copy.
- Use `largedata/` for large working files, especially when the project is running on HCC.
- Treat HCC large-file space as temporary working storage rather than permanent archival storage.
- Large inactive files on HCC may be purged after about three months, so important raw data should also be stored in a backed-up long-term location.
- Document modules, environments, paths, and resource requests inside each batch script.
- Refer to the HCC docs for more submission details, including GPU jobs and array jobs: https://hcc.unl.edu/docs/

Suggested path roles adapted from lab practice:

- `$HOME`: personal configuration and small tools
- `$WORK`: active computation and rebuildable outputs
- `$COMMON`: shared code and resources used across systems

Current shared BGEM genotype data location:

- `/mnt/nrdstor/jyanglab/shared/maize/BGEM`

Current personal HCC project checkout used by the genotype inventory and
baseline GBLUP jobs:

- `/mnt/nrdstor/jyanglab/nathanma/projects/UAV-for-GS`

HCC-run project code should document this checkout path and the shared BGEM data
path near the top of each Slurm wrapper and the analysis script that wrapper
calls. As of 2026-06-18, this path record is present in:

- `slurm-scripts/summarize_bgem_genotypes.sh`
- `scripts/summarize_bgem_genotypes.py`
- `slurm-scripts/baseline_gblup.sh`
- `scripts/run_baseline_gblup.R`

When submitting project jobs from a personal HCC checkout, set `PROJECT_ROOT` to
that checkout path if it differs from the default embedded in an older Slurm
wrapper.

## GitHub

- Use GitHub as the authoritative history for code and tracked documentation.
- Keep heavy generated outputs out of Git unless they are deliberate deliverables.
- Write commit messages that describe the scientific or engineering change clearly.
