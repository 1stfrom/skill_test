# Research Plan: UAV Vegetation Indices For Genomic Prediction Of Maize Yield Traits (BGEM, 2023)

## Purpose

This plan defines the next phase of work for a maize genomic prediction project that incorporates UAV-derived vegetation indices to improve prediction accuracy for yield-related traits. The study uses a selection of BGEM lines grown in a 2023 field experiment, with both RGB and multispectral UAV image data. Image processing into plot-level vegetation indices is complete. The priority now is to refine the downstream statistical analysis, validate modeling choices, and prepare a manuscript-ready story that doubles as a reusable screening pipeline for future seasons.

## Study Scope

- **Population:** a selection of BGEM lines.
- **Trial:** one maize field experiment in 2023 (single site-year).
- **Genotype data:** marker data for the BGEM lines used in the trial.
- **Phenotype data:** plot-level field measurements for yield-related traits, plus any additional agronomic or stress-tolerance traits recorded.
- **UAV image data:** RGB and multispectral, across multiple flights spanning the growing season.
- **Image-derived features:** plot-level vegetation indices (VIs) calculated from RGB and multispectral bands; the specific VI set should be enumerated during Phase 1.
- **Deployment intent:** the resulting workflow should be reusable in future seasons for efficient screening of BGEM-class genotypes for high-performing yield lines.

## Current State

- Genotype, plot-level phenotype, and UAV imagery have been collected for the 2023 BGEM trial.
- Image processing has produced plot-level vegetation indices from RGB and multispectral data.
- The repository has been initialized from a research template. `largedata/genotype/` and `largedata/phenotype/` exist as empty placeholders; a `largedata/phenomics/` (or `largedata/vi/`) destination for the plot-level VI tables still needs to be created and populated.
- Working analysis scaffolding under `profiling/` is staged as `1.pheno/`, `2.geno/`, `3.GS/`. A `4.phenomics/` (or `4.vi/`) directory should be added before Phase 3.
- The immediate phase is analysis refinement and manuscript preparation, not raw image processing.

## Scope Limitations To State Up Front

- **Single site-year.** Cross-environment generalization (CV0 / G×E / multi-env BLUEs) is out of scope for the headline analysis and belongs in Discussion as a limitation and explicit future work.
- **One population.** Findings apply to BGEM-class germplasm; transferability to elite breeding pools should be framed cautiously.
- **VI-based phenomics only.** Plant-level traits derivable from imagery but not encoded as VIs (e.g., canopy structure from 3D reconstruction) are not part of this phase unless the project lead opts in.

## Decisions Required From Project Lead

Resolve these before substantial modeling. Each maps to a phase below; treat them as blocking review gates.

- **Target traits:** which yield-related traits are primary vs. secondary, and whether any drought-tolerance or disease-resistance traits recorded in 2023 are in scope. Exact field definitions and units (Phase 1).
- **Inclusion/exclusion rules:** which BGEM lines, plots, flights, and time points are kept; outlier policy (Phase 1).
- **VI set:** the final list of vegetation indices to carry forward (e.g., NDVI, GNDVI, NDRE from multispectral; ExG, VARI, GLI from RGB), and which sensor each index comes from (Phase 3).
- **Cross-validation scenario:** the primary scenario for headline results. With a single site-year, the realistic options are **CV1** (random plot/line folds within the trial) and **CV2** (leave-lines-out, predicting unseen genotypes). Proposed default: **CV2**, because it matches the breeder use case of screening new lines (Phase 2).
- **Stage-1 plot model:** within-trial spatial / design adjustment to derive genotype BLUEs/BLUPs from plot-level yield (row-column, AR1×AR1, or augmented-design model). This replaces multi-environment BLUEs since the trial is single-site-year (Phase 2).
- **Baseline genomic prediction model:** G-BLUP, rrBLUP, BayesB, or other (Phase 2).
- **Primary VI-assisted model:** the one headline comparison model (proposed: multi-kernel G+P-BLUP with a phenomic relationship kernel built from VIs) vs. secondary models also reported (Phase 4).
- **Software stack:** R (`BGLR`, `sommer`, `rrBLUP`, `asreml`/`sommer` for stage-1 spatial models) vs. Python, for reproducibility and HCC module pinning (Phase 2).
- **Claims scope:** how aggressively to interpret accuracy gains, biological mechanisms, and screening-pipeline deployment value (Phase 6).

## Human Review Gates

Pause for project lead review before finalizing or heavily automating these choices:

- Final target traits and yield-related trait definitions (including any stress traits in scope).
- Inclusion/exclusion rules for BGEM lines, plots, flights, time points, and outliers.
- Vegetation-index set carried into modeling and which sensor each index uses.
- Cross-validation scenario and its breeder-use-case interpretation.
- Choice of baseline genomic prediction model and VI-assisted model classes.
- Claims about prediction accuracy improvement, biological mechanisms, and screening-pipeline deployment value.
- Final figure set, table set, and manuscript narrative.

## Phase 1: Data Inventory And Analysis Readiness

Goal: produce a clear, auditable map of all analysis inputs for the 2023 BGEM trial.

Tasks:

- List the BGEM line set (number of lines, source, any subsetting) and the genotype/marker file backing them.
- List plot-level phenotype files for yield-related traits and any agronomic or stress-tolerance traits collected.
- List the UAV flight schedule: dates, sensors per flight (RGB vs. multispectral), flight altitude and resolution.
- List the vegetation-index tables produced from image analysis: which VIs, which sensor each VI is derived from, plot-level rows, units, and version date.
- Document field design: location, plot layout, replication, randomization (row-column coordinates, blocks, check plots).
- Document file locations, data owners, formats, row identifiers, trait names, units, and version dates.
- Confirm join fields across genotype, plot phenotype, plot metadata, and VI tables (plot ID is the natural key; verify that plot → line mapping is unique and complete).
- Check missingness, duplicate IDs, naming inconsistencies, and extreme values per VI and per flight date.
- Separate raw data, curated analysis inputs, and rebuildable intermediates. Place curated inputs under `largedata/{genotype,phenotype,phenomics}/` and keep rebuildable intermediates in `cache/`.
- Create a short data-readiness report in `reports/` or `profiling/1.pheno/`.

Deliverables:

- Data inventory table.
- Data QC summary covering markers, plot phenotypes, and per-flight VI completeness.
- Documented assumptions about IDs, units, trait definitions, and the field-design model that Phase 2 stage-1 analysis will use.

## Phase 2: Baseline Genomic Prediction Analysis

Goal: establish defensible genotype-only reference performance for the 2023 BGEM trial.

Tasks:

- **Stage-1 within-trial spatial / design model:** fit a row-column, AR1×AR1, or augmented-design model to plot-level yield and other trait observations, producing genotype BLUEs/BLUPs adjusted for spatial gradients and design effects. Place stage-1 scripts under `profiling/1.pheno/`. (Multi-environment BLUEs are not applicable — single site-year.)
- Compute and report narrow-sense heritability (h²) per trait from the genomic relationship matrix on the stage-1 inputs, so accuracy ceilings are interpretable.
- Build the genomic relationship matrix (VanRaden or equivalent) and run QC: marker call rate, MAF, sample-level missingness, PCA for population structure, related-individual checks. Place under `profiling/2.geno/`.
- Define the baseline model family in consultation with the project lead (see "Decisions Required"). Proposed default: G-BLUP.
- Build a reproducible genotype-only prediction workflow under `profiling/3.GS/`. Lock the CV folds once (proposed: CV2, leave-lines-out) so every downstream VI-assisted model reuses identical train/test splits.
- Estimate prediction accuracy for each target trait under the chosen CV scenario; optionally report CV1 as a secondary scenario.
- Summarize accuracy (predictive correlation between predicted GEBV and stage-1 BLUE/BLUP), bias (regression of observed on predicted), and uncertainty (across-fold and across-seed variability).

Deliverables:

- Stage-1 BLUE/BLUP table per trait, with the field-design model used.
- Per-trait heritability estimates with standard errors.
- Baseline genomic prediction script or R Markdown report.
- Baseline accuracy table.
- Initial figure showing genotype-only prediction performance by trait under the headline CV scenario.

## Phase 3: Vegetation-Index Feature Refinement

Goal: convert plot-level vegetation indices across flights into biologically meaningful, model-ready predictors at the genotype level.

Tasks:

- Stage analysis scripts under a new `profiling/4.phenomics/` (or `profiling/4.vi/`) directory; place curated feature tables in `largedata/phenomics/`.
- Enumerate the VI set: name, source bands (RGB vs. multispectral), formula, and biological rationale (greenness, biomass proxy, chlorophyll, water status, etc.).
- Lift VIs from plot level to genotype level using the same stage-1 within-trial spatial model used for phenotypes, so VIs and targets share the same conditioning scheme.
- Decide feature representation: per-flight VI values, temporal summaries (mean, max, slope), area-under-curve over the season, growth-stage-specific summaries, or selected dimensionality-reduced components.
- Evaluate missingness and flight-date coverage across plots and lines; flag any VI-by-flight cells with poor coverage.
- Compute VI–VI correlations within and across flights to identify redundancy; this informs whether to use individual VIs or composite scores.
- Avoid final feature selection until the CV scheme is locked, to prevent leakage from test-set information into feature choice.
- Document the prediction-time anchor for each candidate VI feature (earliest growth stage / flight date available before yield is observed) so leakage checks in Phase 5 are well-defined.

Deliverables:

- Model-ready genotype-level VI feature table.
- VI feature dictionary: name, sensor, formula, biological proxy, earliest valid prediction time.
- QC plots showing VI distributions, per-flight missingness, temporal coverage, and VI–VI correlation heatmap.

## Phase 4: VI-Assisted Prediction Models

Goal: compare genomic prediction models with and without UAV vegetation-index information.

Headline comparison (proposed; needs project-lead confirmation):

- **Primary contrast:** genotype-only baseline vs. one multi-kernel model with separate genomic (G) and phenomic (P) relationship matrices, where the P kernel is built from the genotype-level VI feature table. This is the Figure 4 headline.
- **Secondary models reported for context:** VI-only, genotype + VIs as fixed covariates, and one multi-trait / secondary-trait model treating early-season VIs as a secondary trait that helps predict end-season yield.

Candidate model classes for human review:

- Genotype-only baseline (G-BLUP).
- VI-only prediction model (phenomic kernel only).
- Genotype + VIs as fixed-effect covariates.
- Multi-kernel G+P-BLUP with separate genomic and VI relationship matrices.
- Multi-trait / secondary-trait model where early-season VIs help predict yield observed at the end of the season.

Note: G×E / multi-environment models are out of scope (single 2023 site-year). They belong in Discussion as future work.

Tasks:

- Implement a small set of agreed model classes rather than an overly broad model search.
- Use identical train/test splits across model classes (reuse the Phase 2 CV folds).
- Report prediction accuracy improvement relative to the genotype-only baseline, with uncertainty (across-fold and across-seed standard errors).
- Evaluate whether VIs help consistently across traits and across CV folds.
- Run a VI-shuffled permutation control for at least one model (permute the line→VI mapping) — confirms gains are signal, not extra parameters.
- Track computational cost and the wall-clock time needed to retrain the headline model on a new season, since the pipeline must be deployable.

Deliverables:

- Model comparison report.
- Accuracy improvement table with uncertainty.
- Manuscript-ready figure comparing baseline and VI-assisted models.

## Phase 5: Validation, Sensitivity, And Robustness

Goal: ensure claims are stable and not artifacts of one split, preprocessing choice, or flight subset.

Tasks:

- Repeat the headline CV scenario with multiple random seeds and reasonable fold counts.
- Test sensitivity to outlier filtering, VI scaling, and VI feature subsets (e.g., RGB-only VIs, multispectral-only VIs, single growth-stage VIs).
- Test sensitivity to which flights are included — does the conclusion change if a single noisy flight is dropped?
- Check for time-leakage: confirm that no VI used for prediction comes from a flight that occurs after the trait being predicted was measured.
- Confirm that the validation scheme matches the claimed breeder use case (screening unseen BGEM lines).
- Identify traits where VIs do not improve prediction and document them honestly.

Deliverables:

- Sensitivity analysis summary.
- Supplemental accuracy table broken down by VI subset and flight subset.
- Clear statement of robust and non-robust findings, including any traits where the headline gain disappears.

## Phase 6: Manuscript Development And Pipeline Packaging

Goal: turn the validated analysis into a polished manuscript and into a screening pipeline reusable for future seasons.

Tasks:

- Draft the central message: what UAV vegetation indices add to genomic prediction of yield-related traits in maize BGEM lines, when in the season they help, and why it matters for breeding pipelines.
- Build a figure plan before polishing individual plots.
- Prepare methods text for: the BGEM trial and field design, genotyping, UAV flight schedule and sensors, VI extraction, stage-1 spatial model, baseline G-BLUP, VI-assisted models, and validation.
- Prepare results text around the headline model comparison, trait-specific patterns, the accuracy-vs-flight-timing story, and practical implications for screening.
- Prepare discussion text covering biological interpretation of helpful VIs, single-site-year limitation, transferability to other germplasm, deployment value, and future work (multi-environment, multi-year, integration with reaction-norm models).
- Assemble supplementary tables for data summary, model settings, and sensitivity analyses.
- **Pipeline packaging:** ensure the genotype-level VI table, stage-1 model, GRM build, and headline G+P-BLUP can be re-run on a new season's data with documented inputs and configuration.

Deliverables:

- Manuscript outline.
- Main figures and tables.
- Supplementary figures and tables.
- Polished manuscript draft in `reports/` or another agreed location.
- A runnable, documented pipeline (R Markdown or scripts) that takes the curated inputs from `largedata/` and reproduces the headline result end-to-end.

## Proposed Manuscript Figure Set

- Figure 1: Study overview — BGEM lines in the 2023 field trial, UAV flights with RGB and multispectral sensors, VI extraction, genomic prediction, and validation.
- Figure 2: Data summary — trait distributions, per-flight VI distributions, flight schedule along the growing season.
- Figure 3: Baseline genotype-only G-BLUP prediction accuracy for yield-related traits, under the headline CV scenario.
- Figure 4: Prediction accuracy comparison — genotype-only baseline vs. VI-only vs. multi-kernel G+P-BLUP, across target traits.
- Figure 5: Prediction accuracy as a function of UAV flight timing — accuracy from VIs available up to each flight date, isolating when in the season UAV data starts contributing predictive signal.
- Figure 6: Trait-specific value of VI features — which VIs contribute most for which traits, including honest negatives.
- Supplemental figures: QC summaries, per-flight missingness, VI–VI correlation heatmap, sensitivity analyses by VI/flight subset, and the VI-shuffled permutation control.

## Near-Term Work Plan

1. Fill the README metadata fields with confirmed project lead, data steward, compute environment, and deliverable expectations.
2. Create a data inventory document for genotype, phenotype, phenomics, and metadata inputs.
3. Confirm target traits, environments, and prediction scenarios with the project lead.
4. Implement or organize the baseline genotype-only model workflow.
5. Convert processed phenomics outputs into a documented model-ready feature table.
6. Run a first controlled comparison of genotype-only, phenomics-only, and combined models.
7. Review results with the project lead before drafting final claims.
8. Build manuscript figures and tables from locked analysis outputs.

## Indicative Timeline

Calendar weeks are placeholders pending project-lead confirmation; phases overlap where work is independent.

- Weeks 1–2: Phase 1 (data inventory and QC for the 2023 BGEM trial).
- Weeks 2–4: Phase 2 (stage-1 spatial model, heritability, baseline G-BLUP).
- Weeks 3–5: Phase 3 (VI feature refinement); can run in parallel with Phase 2 once the stage-1 model is settled.
- Weeks 5–7: Phase 4 (model comparison).
- Weeks 7–9: Phase 5 (validation, sensitivity, robustness).
- Weeks 8–12: Phase 6 (manuscript drafting and pipeline packaging).

## Immediate Next Step

Prepare a project-specific data inventory and analysis-readiness report for the 2023 BGEM trial, then schedule human review of the "Decisions Required From Project Lead" block above before substantial modeling begins.
