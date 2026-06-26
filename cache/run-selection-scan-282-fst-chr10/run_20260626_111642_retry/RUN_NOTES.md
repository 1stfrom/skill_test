# Fst Selection Scan Run Notes

- HCC project path: `/mnt/nrdstor/jyanglab/nathanma/projects/skill_test`
- Output directory: `cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry`
- Run time: `2026-06-26T11:18:11-05:00`
- Host: `c2736.swan.hcc.unl.edu`
- Slurm job: `16220886`
- Input VCF: `largedata/SNP/hmp321_282_agpv5_maf005_miss03_chr10.recode.vcf`
- Population A: temporal, `largedata/SNP/filtered_temporal.txt`, 124/124 IDs present in VCF
- Population B: tropical, `largedata/SNP/filtered_tropical.txt`, 53/53 IDs present in VCF
- Chromosome scanned: chr10 only, because only the chr10 hmp321_282 VCF was present in `largedata`
- VCF samples: 271; individuals kept by vcftools: 177
- SNP checkpoint: total=1249712, chr10=1249712
- Window/step: 25000 bp / 5000 bp
- Module: `vcftools/0.1`

Raw output is preserved at:

- `cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry/temporal_vs_tropical_chr10_25kb5kb.windowed.weir.fst`
- `cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry/temporal_vs_tropical_chr10_25kb5kb.weir.fst`
- `cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry/temporal_vs_tropical_chr10_25kb5kb.log`

Derived summaries:

- `cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry/checkpoints.tsv`
- `cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry/fst_summary.tsv`
- `cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry/top_weighted_fst_windows.tsv`
- `cache/run-selection-scan-282-fst-chr10/run_20260626_111642_retry/temporal_vs_tropical_chr10_25kb5kb.windowed_nonnegative.weir.fst`
