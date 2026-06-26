# Project Status

## Purpose

Check here first to understand where the maize phenomics-assisted genomic selection project stands. This file tracks what has been done, what is active, and what should happen next.

## Completed

- Initialized the repository from the portable research template.
- Established shared instruction files for Codex, Claude Code, and GitHub Copilot.
- Set up repository-native tracking files for status, decisions, environment notes, work logs, and daily commit journal.
- Created a project-facing README for the maize phenomics-assisted genomic selection study.
- Added `doc/RESEARCH_PLAN.md` with the forward plan for analysis refinement, model comparison, validation, and manuscript preparation.
- Data collection is reported as complete.
- Image data analysis is reported as complete.
- Added a first VI interpretation and plotting report at `profiling/1.pheno/01_vi_trait_interpretation.Rmd`.
- Rendered date-wise High N and Low N VI plots to `graphs/vi_by_nitrogen_date/`.
- Wrote VI inventory, summary, diagnostic, and plot-manifest tables to `cache/vi/`.
- Added `profiling/1.pheno/02_vi_temporal_features.Rmd` for genotype-level VI trajectories, temporal feature candidates, and AUC-based VI redundancy checks.
- Added `profiling/1.pheno/03_vi_current_results_slides.Rmd` and rendered `reports/vi_current_results_slides.html` plus `reports/vi_current_results_slides.pptx` to summarize the current VI results.
- Added and revised `profiling/1.pheno/05_vi_trait_qc_round2.Rmd` plus the live `/slides/vi-qc-round2/` deck for check-genotype greenness QC, BGEM strata summaries, and paired-date VI heterosis checks.
- Added `profiling/1.pheno/06_vi_agronomic_correlation_qc.Rmd` to test within-nitrogen genotype-level VI x agronomic trait correlations against a genotype-shuffled null.
- Completed the first HCC genotype-only GBLUP baseline job (`15826155`) under `R/4.3`; summary report is in `reports/07_baseline_gblup_hcc_summary.md` with a standalone HTML rendering at `reports/07_baseline_gblup_hcc_summary.html`.
- Added an HTML slide-deck version of the baseline GBLUP report at `reports/baseline-gblup-slides/index.html`, served from the dashboard as `/slides/baseline-gblup/`.
- Ran the HCC chr10 Fst selection scan for the `hmp321_282` genotype resource using filtered temporal versus filtered tropical groups; outputs and checkpoint summaries are under `/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry/`.

## In Progress

- Transitioning from data generation and image analysis into statistical analysis refinement and manuscript preparation.
- Interpreting the extracted VI traits before deciding which traits and dates should move into genomic selection models.
- Starting BGEM genotype data inventory on HCC. Header-level Slurm summary job `15318343` completed on compute node `c2016`; outputs are under `cache/genotype/bgem_summary/`. First-round genotype inventory report added at `profiling/2.geno/01_bgem_genotype_inventory.Rmd` with slide deck `reports/01_bgem_genotype_inventory_slides.html`.
- Reviewing the first genotype-only GBLUP baseline outputs before using them as the reference for phenomics-only and combined genotype-plus-phenomics model comparisons.

## Next Steps

1. Confirm README metadata: project lead, data steward, compute environment, and expected deliverables.
2. Review the BGEM genotype summary outputs from Slurm job `15318343`, then decide whether to run full `bcftools stats` scans on the large VCF files.
3. Review `reports/07_baseline_gblup_hcc_summary.html`, `reports/baseline-gblup-slides/index.html`, and the HCC outputs in `cache/gs_baseline_gblup/`, especially sample matching and trait-specific accuracy.
4. Confirm target yield-related traits and prediction scenarios with the project lead before final model comparison.
5. Review the VI plots, temporal trajectories, and redundancy heatmaps.
6. Decide which VI traits, temporal feature representation, missing-date handling rule, and redundancy-pruning threshold should be retained for model-ready phenomics features.
7. Compare genotype-only, phenomics-only, and combined prediction models using agreed validation splits, with the HCC GBLUP baseline as the first reference.
8. Review preliminary results with the project lead before final manuscript claims.
9. For a genome-wide 282-population selection scan, stage chr1-9 VCFs or a whole-genome VCF in HCC `largedata/`, then rerun the Fst workflow across all chromosomes.

## Open Questions

- Which yield-related traits are the final manuscript targets?
- Which years, environments, populations, and field trials are in scope?
- Which validation scenarios best match the intended use case: within-environment, across-environment, across-year, sparse testing, early-season prediction, or another design?
- Which baseline and phenomics-assisted genomic selection models should be treated as the primary manuscript models?
- Will compute-heavy modeling run locally, on HCC, or both?
- Should unstable VI ratio values be filtered, winsorized, transformed, or retained with diagnostic flags before modeling?
- Should RGB greenness indices be dropped from headline screening predictors or re-extracted with exposure / segmentation normalization, given the round-2 check-genotype HN-vs-LN direction reversal?
- If RGB VIs show significant within-N genotype-ranking correlations with agronomic traits, should selected RGB temporal features be retained as within-treatment predictors while excluding them from direct N-treatment-response interpretation?
