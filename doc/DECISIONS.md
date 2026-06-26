# Decisions

## Purpose

Record important project decisions and the reasoning behind them. Keep entries short and dated. Use this format:

- **Decision**: what you chose to do
- **Why**: the reasoning behind it
- **Alternatives considered**: what else you looked at (optional)
- **Status**: active / superseded / revisit by [date]

## 2026-03-29

### Stable template memory moved to `MEMORY.md`

- Decision: move the stable template and agent-memory guidance out of `README.md` and into `MEMORY.md`.
- Why: this keeps `README.md` lightweight and human-friendly while preserving a stable shared memory contract for assistants.
- Alternatives considered: keeping the stable section inside `README.md`, but that made the main project guide heavier and more confusing for new projects.
- Status: active

### README split into editable and stable sections

- Decision: make the top of `README.md` project-specific and human-facing, and keep a stable lower section for template memory and shared workflow rules.
- Why: new projects should be easy for people to customize without accidentally breaking the memory structure that assistants rely on.
- Alternatives considered: moving all stable instructions out of `README.md`, but keeping the stable section in the same file makes the boundary visible and easy to follow.
- Status: active

### README restructured for human readers

- Decision: rewrite README.md as a human-friendly project guide; move agent/memory system details out of the README.
- Why: the old README was written for AI assistants. Humans reading the repo need to understand the research workflow, directory layout, and how to track progress — not the memory system architecture.
- Alternatives considered: creating a separate MEMORY.md index file, but the existing `AGENTS.md` + `CLAUDE.md` + `.github/copilot-instructions.md` already serve that role.
- Status: active

### Dashboard prioritizes research tracking over agent config

- Decision: reorder the project website navigation to lead with Status, Decisions, and Daily Log; move Agent Rules to the end.
- Why: human researchers visiting the site care about project state and decisions first, not agent configuration.
- Status: active

### Durable memory stays in the repository

- Decision: use tracked Markdown files as the main project memory layer.
- Why: repository memory is portable across Copilot, Claude Code, Codex, GitHub, and local workflows.

### Shared instruction file is `AGENTS.md`

- Decision: use `AGENTS.md` as the cross-tool source of truth and keep thin adapter files for individual assistants.
- Why: this keeps conventions synchronized and reduces duplication.

### Research-first coding defaults

- Decision: prefer R and Python, with `.Rmd` as the default literate analysis format and `.ipynb` when interactive Python work is appropriate.
- Why: this supports reproducible research while fitting common lab workflows.

### Large-file rule

- Decision: files larger than 100 MB should not be kept in `data/` or committed to Git. They belong in `largedata/`.
- Why: this keeps the repository lightweight, copyable, and aligned with Git hosting limits and good project hygiene.

### HCC large-data caveat

- Decision: treat `largedata/` as working storage that fits HCC usage, not as the only copy of important large files.
- Why: inactive large files on HCC may be purged after about three months, so durable raw data should also live in a safer long-term location.

### HCC workflow is explicit

- Decision: keep cluster execution details in dedicated Slurm scripts and preserve logs separately.
- Why: this improves reproducibility, debugging, and handoff between local and cluster execution.

## 2026-04-01

### Slurm jobs must self-check runtime and avoid head-node compute

- Decision: add a starter Slurm template that reports whether it is running locally or in a remote Slurm job, refuses to do compute work without a Slurm allocation, and verifies module setup before execution.
- Why: this makes the "do not run heavy work on the HCC head/login node" rule executable rather than just documented, while giving future projects a safer default job wrapper.
- Alternatives considered: documenting the rule only in Markdown, but that leaves too much room for accidental misuse.
- Status: active

### Slurm wrappers should stay thin

- Decision: keep Slurm job files minimal and prefer a one-line handoff to the real Bash, Python, R, or other compute script.
- Why: this keeps resource requests and execution environment separate from scientific logic, which improves reproducibility, debugging, and reuse across local and HCC runs.
- Alternatives considered: embedding more analysis logic directly in the Slurm script, but that makes jobs harder to test and maintain.
- Status: active

## 2026-04-02

### HCC software discovery order is standardized

- Decision: require HCC work to verify runtime first, obtain a compute-node allocation before doing compute work, check system-wide software with `module avail`, record the exact loaded module version, and only then fall back to `$HOME/bin` if the software is not provided by modules.
- Why: this creates a predictable order for environment setup, reduces accidental login-node work, and makes software provenance easier to reproduce across local, interactive, and batch runs.
- Alternatives considered: relying on ad hoc shell habits or checking `$PATH` first, but that makes HCC behavior less reproducible and easier to mis-document.
- Status: active

## 2026-05-10

### `.Rmd` is the default literate workflow

- Decision: use `.Rmd` as the default reproducible analysis format for future projects created from this template.
- Why: the lab workflow already favors R for statistical analysis and reporting, and one default reduces startup ambiguity for humans and AI assistants.
- Alternatives considered: defaulting to `.qmd` or a mixed `.Rmd`/`.qmd` workflow, but that adds a format choice before a new project has real analysis needs.
- Status: active

### `slurm-scripts/` remains the HCC script directory

- Decision: keep the directory name `slurm-scripts/`.
- Why: it is explicit, already documented across the template, and avoids a broad rename with little practical benefit.
- Alternatives considered: renaming it to `slurm/`, but the shorter name is less descriptive.
- Status: active

### Minimum project metadata is standardized

- Decision: require README metadata fields for principal investigator or project lead, biological system or study domain, data owner or steward, compute environment, expected deliverables, and review status.
- Why: these fields give humans and AI assistants enough shared context to start work without over-specifying project-specific details.
- Alternatives considered: a larger metadata schema, but that would make project startup heavier than needed.
- Status: active

## 2026-05-19

### Project initialized for maize phenomics-assisted genomic selection

- Decision: adapt this repository for a maize research project focused on incorporating UAV-derived phenomics data into genomic selection models for yield-related traits.
- Why: data collection and image analysis are complete, and the project now needs reproducible downstream modeling, validation, and manuscript preparation.
- Alternatives considered: continuing to treat the repository as a generic template, but that would leave collaborators without project-specific research direction.
- Status: active; detailed model choices require human review before substantial modeling.

### Use a staged plan before final model selection

- Decision: proceed through data inventory, genotype-only baseline modeling, phenomics feature refinement, controlled model comparison, validation, and manuscript preparation.
- Why: this keeps methodological decisions auditable and reduces the risk of information leakage or over-interpreting a single model comparison.
- Alternatives considered: jumping directly to combined phenomics-genomics models, but that would make it harder to separate data-readiness issues from real prediction gains.
- Status: active; target traits, validation scenarios, and primary model classes need project lead confirmation.

### Use diagnostic filtering only for first VI plots

- Decision: for the first VI visualization report, summarize raw values but omit non-finite values and values with absolute magnitude greater than 1000 from the plotting layer only.
- Why: multispectral ratio indices such as `VARI` and `ARVI` can produce extreme values when denominators approach zero, and those values make date-wise plots unreadable while still needing to remain visible in diagnostics.
- Alternatives considered: plotting all raw values, but a small number of unstable denominator values would compress most panels; filtering the source data, but that would prematurely change analysis inputs.
- Status: active for exploratory plotting only; final VI preprocessing for modeling requires human review.

## 2026-05-20

### Treat nitrogen strata separately for VI temporal summaries

- Decision: compute VI temporal summaries separately for High N and Low N.
- Why: the current VI files show complete confounding between nitrogen treatment and field section (`NW` / `SW`), so a single combined stage-1 analysis would obscure treatment-specific trajectories and section effects.
- Alternatives considered: fitting one combined model with nitrogen as a fixed effect, but the design confounding would make that term absorb field-section differences.
- Status: active for VI feature preparation; interpretation of treatment differences remains a human-review point.

### Drop the partial Aug 2 VI flight from temporal features

- Decision: exclude the Aug 2 flight from downstream VI temporal feature construction.
- Why: Aug 2 appears only for SW / Low N and has about 10% of a typical row count, making it an incomplete out-of-design flight for temporal summaries.
- Alternatives considered: retaining Aug 2 with missingness flags, but that would introduce an uneven time point only in Low N.
- Status: active for temporal feature construction.

### Prefix VI names by sensor before modeling

- Decision: treat same-named RGB and multispectral VI columns as distinct traits using sensor prefixes such as `RGB_VARI` and `MS_VARI`.
- Why: shared formulas can have different scales and stability depending on whether they use RGB byte-scaled bands or calibrated multispectral reflectance.
- Alternatives considered: merging same-name VIs across sensors, but that would collapse non-equivalent measurements.
- Status: active.

### Winsorize unstable multispectral VARI and ARVI for temporal features

- Decision: for multispectral `VARI` and `ARVI`, replace denominator-failure values with missing when `|value| > 1000`, then winsorize surviving finite values at the 1st and 99th percentiles within each sensor × nitrogen × VI stratum.
- Why: these indices showed denominator-instability values up to about 1e11, while stable values remain on a much smaller biological scale.
- Alternatives considered: dropping the traits entirely, but they may still contain useful signal after transparent stabilization; using only raw winsorization, but the 1st/99th percentile can still be distorted when many denominator failures are present.
- Status: active for exploratory temporal features; revisit before final genomic prediction model lock.

### Use six manual agronomic traits with extreme outliers masked

- Decision: for manual agronomic trait QC, analyze six traits from `2023_BGEM_pheno_transformed_raw.xlsx`: ear weight, total kernel weight, 20-kernel weight, derived cob weight (`CW = Ear Weight - Total Kernel Weight`), cob length, and cob diameter. Set trait values beyond the 3 x IQR outer fence to `NA`; also set impossible derived cob weights below zero to `NA`.
- Why: the updated workbook provides total kernel weight directly, and the project lead requested cob weight as an additional derived trait. Masking only extreme values keeps the QC descriptive while preventing impossible or highly implausible measurements from dominating plots and summaries.
- Alternatives considered: retaining all raw values with flags only, but the requested analysis explicitly removes extreme outliers as `NA`; using the milder 1.5 x IQR fence, but that would mask many plausible tail observations.
- Status: active for agronomic QC; masked records remain exported for field-sheet review.

## 2026-06-10

### Pin HCC R jobs to `R/4.3`

- Decision: use the HCC `R/4.3` module for project R jobs unless Nathan explicitly approves a different R version.
- Why: Nathan's HCC R environment and installed package set are tied to R 4.3, including the newly installed `rrBLUP` package needed for the baseline GBLUP job.
- Alternatives considered: keeping the previous baseline wrapper default of `R/4.4`, but that did not match the available project package environment.
- Status: active

### Preflight modules and packages before Slurm submission

- Decision: before each Slurm submission, verify that the required HCC modules and job-specific R packages are available.
- Why: missing packages such as `rrBLUP` should be caught before a queued batch job starts or fails mid-run.
- Status: active

### Match BGEM phenotype `gneo` IDs to imputed VCF sample IDs

- Decision: for the genotype-only BGEM baseline, use the phenotype workbook `gneo` column as the genotype identifier and map phenotype cross labels such as `BGEM-0056-S X Mo17` to VCF sample labels such as `BGEM-0056-S/Mo17`.
- Why: the workbook's numeric `ID` and plot-level `ID_full` fields are not the model-ready genotype IDs, while the imputed hybrid/inbred VCF uses slash-separated cross names for hybrid samples.
- Alternatives considered: exact matching only, but that drops valid hybrid samples because the phenotype workbook and VCF use different cross separators.
- Status: active for the first genotype-only baseline; sample matching should be reviewed before final model lock.
