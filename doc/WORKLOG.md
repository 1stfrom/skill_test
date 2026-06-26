# Work Log

## Purpose

Keep short dated notes so a researcher or AI assistant can resume work quickly.

## 2026-06-26

- Scanned the skill testing checkout at `/Users/nathanma/Documents/skill_test`.
- Confirmed the repository is a research-template project adapted for maize phenomics-assisted genomic selection and that all tracked project files currently appear as untracked in Git.
- Inspected `https://github.com/1stfrom/POPGEN` through `git`; the Codex skill path is `Selection_scan/Codex/run-selection-scan`.
- Confirmed `/Users/nathanma/.codex/skills/run-selection-scan` already matches the POPGEN Codex skill at commit `39cc722f0b7f7ed0588b6f28eb4a701f1c66c7cd`, so no reinstall or overwrite was needed.
- Tested the `run-selection-scan` skill against the active HCC Termius session. Runtime context was `pc2025.swan.hcc.unl.edu`, Slurm job `16214704`, working data directory `/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP`.
- Verified `bcftools/1.17`, `vcftools/0.1`, `plink/1.90`, `plink/2.0a1`, `plinkseq/0.10`, and `xpclr/1.1` are available through HCC modules; loaded `bcftools/1.17` for read-only VCF checks.
- Checkpointed the test VCF `hmp321_282_agpv5_maf005_miss03_chr10.recode.vcf`: 271 VCF samples, first chromosome `10`, 1,249,712 total variants, and all variants on chromosome 10. Filtered sample lists matched the VCF exactly (`filtered_temporal.txt`: 124/124, `filtered_tropical.txt`: 53/53).
- Generated local HCC-oriented selection-scan templates in `cache/run-selection-scan-popgen-test/` using `filtered_temporal.txt` as samplesA/object group, `filtered_tropical.txt` as samplesB/reference group, chromosome 10, 25 kb windows, 5 kb steps, XP-CLR LD cutoff 0.7, and one whole-chromosome XP-CLR array region. The scripts have not been copied to HCC or submitted.
- Ran the focused HCC Fst scan interactively with `vcftools/0.1` inside Slurm job `16214704`: `filtered_temporal.txt` versus `filtered_tropical.txt`, 25 kb windows, 5 kb steps. Outputs are under `/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test/fst_scan/`.
- Fst result summary: 29,557 windows, 177 kept individuals, global mean Fst 0.082102, global weighted Fst 0.10103, window mean weighted Fst 0.09674263916, max weighted Fst 0.546364. A negative-clamped companion file and top-window table were written alongside the raw `.windowed.weir.fst` file.
- After the Fst output was written, a post-processing `sort | head` command under `pipefail` caused the interactive Slurm shell to exit with code 141 and returned Termius to `login1.swan`; no further compute was run after leaving the allocation.
- Visualized the downloaded Fst result locally using the updated `run-selection-scan` guidance: `WEIGHTED_FST`, window midpoints, and a 99th percentile threshold. Added reproducible plotting script `scripts/visualize_fst_result.py` and wrote figures plus tables under `graphs/fst_scan/`.
- Generated a standalone HTML Fst slide report at `reports/fst-scan-slides/index.html`, copied the rendered Fst figures into `reports/fst-scan-slides/assets/`, and added the dashboard route `/slides/fst-scan/` in `server.js`.
- Re-ran the HCC chr10 Fst selection scan for the `hmp321_282` genotype resource on compute node `c2736.swan.hcc.unl.edu` inside Slurm job `16220886`. Used `vcftools/0.1`, `largedata/SNP/hmp321_282_agpv5_maf005_miss03_chr10.recode.vcf`, `filtered_temporal.txt` as group A, `filtered_tropical.txt` as group B, 25 kb windows, and 5 kb steps. Outputs are under `/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry/`.
- The rerun kept 177 of 271 VCF individuals, with filtered sample-list membership matching exactly (`filtered_temporal.txt`: 124/124, `filtered_tropical.txt`: 53/53). SNP checkpoint was 1,249,712 total variants, all on chr10. Window summary from the raw `.windowed.weir.fst` output: 29,557 numeric windows, mean weighted Fst 0.0967426, 99th percentile weighted Fst 0.360897, max weighted Fst 0.546364 at chr10:76,270,001-76,295,000.
- Preserved raw outputs and HCC run notes in the rerun directory: `temporal_vs_tropical_chr10_25kb5kb.windowed.weir.fst`, `temporal_vs_tropical_chr10_25kb5kb.weir.fst`, `temporal_vs_tropical_chr10_25kb5kb.log`, `checkpoints.tsv`, `fst_summary.tsv`, `top_weighted_fst_windows.tsv`, and `RUN_NOTES.md`. Full genome-wide selection scanning still needs chr1-9 VCFs or a whole-genome VCF staged in HCC `largedata/`.
