# Phenomics-Assisted Genomic Selection In Maize

This project studies how UAV-derived phenomics data can be incorporated into genomic selection models to improve prediction accuracy for yield-related traits in maize. The data have been collected, and image data analysis has been completed. The current work is to refine the statistical analysis, compare modeling strategies, and prepare a polished manuscript.

## Project Snapshot

- Research question: Can phenomics features improve genomic selection prediction accuracy for maize yield-related traits beyond genotype-only models?
- Main data sources: maize genotype data, field phenotype records for yield-related traits, and processed UAV/image-derived phenomics traits.
- Primary languages: R and Python.
- Main outputs: reproducible analysis reports, model comparison tables, publication-quality figures, and a manuscript.
- Current phase: analysis refinement, model validation, and manuscript preparation.

## Required Project Metadata

- Principal investigator or project lead: to be confirmed.
- Biological system, organism, or study domain: maize genomic selection with phenomics-assisted prediction.
- Data owner or steward: to be confirmed.
- Compute environment: local and/or HCC, to be confirmed before compute-heavy modeling.
- Expected deliverables: finalized analysis workflow, manuscript figures/tables, polished manuscript, and documented reproducible code.
- Review status: planning; model choices and interpretation require human review.

## Current Research Priorities

1. Confirm the analysis-ready data inventory and provenance for genotype, phenotype, and phenomics inputs.
2. Define baseline genomic selection models and phenomics-assisted model classes for comparison.
3. Establish cross-validation and prediction scenarios that match the biological question.
4. Quantify prediction accuracy gains, uncertainty, trait-specific behavior, and practical value.
5. Prepare manuscript-ready figures, tables, methods text, and supplementary materials.

See `doc/RESEARCH_PLAN.md` for the working plan and review gates.

## Notes For Collaborators

Use the repository root as the working directory. Keep source data and small tracked reference files in `data/`, large local working files in `largedata/`, exploratory analyses in `profiling/`, reusable helper code in `lib/`, figures in `graphs/`, rendered reports in `reports/`, and project memory in `doc/`.

Major methodological choices should be recorded in `doc/DECISIONS.md`. At the end of substantial work, update `doc/PROJECT_STATUS.md` and `doc/WORKLOG.md`.

## Template Memory

The stable template rules and shared agent-memory contract live in `MEMORY.md`.

Keep `MEMORY.md` stable unless intentionally maintaining the template itself.

## Template Checks

Run this from the repository root after setup changes or before a handoff:

```bash
python3 scripts/doctor.py
```

## License

Free and open source, licensed under [GPLv3](LICENSE). This repository is being adapted for a maize phenomics-assisted genomic selection research project.
