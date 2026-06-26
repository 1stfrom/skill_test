#!/bin/bash -l
#SBATCH -D /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test
#SBATCH -o /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_vcf_stats-%j.out
#SBATCH -e /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_vcf_stats-%j.err
#SBATCH -J popgen_chr10_skill_test_vcf_stats
#SBATCH -t 24:00:00
#SBATCH --ntasks=4
#SBATCH --mem=32G

set -euo pipefail
mkdir -p /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log

module load bcftools/1.17 vcftools/0.1 plink/2.0a1

VCF="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP/hmp321_282_agpv5_maf005_miss03_chr10.recode.vcf"
PREFIX="popgen_chr10_skill_test"
POP_A="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP/filtered_temporal.txt"
POP_B="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP/filtered_tropical.txt"
FST_PREFIX="popgen_chr10_skill_test_filtered_temporal_vs_filtered_tropical"

plink --vcf "$VCF" --make-bed --out "$PREFIX"
plink --bfile "$PREFIX" --freq --missing --hardy --het --out "$PREFIX"
plink --bfile "$PREFIX" --pca 10 --out "$PREFIX"
plink --bfile "$PREFIX" --indep-pairwise 100 10 0.1 --out "${PREFIX}_prune"
plink --bfile "$PREFIX" --extract "${PREFIX}_prune.prune.in" --make-bed --out "${PREFIX}_pruned"

vcftools --vcf "$VCF" --window-pi 25000 --window-pi-step 5000 --out "$PREFIX"
vcftools --vcf "$VCF" --weir-fst-pop "$POP_A" --weir-fst-pop "$POP_B" \
  --fst-window-size 25000 --fst-window-step 5000 --out "$FST_PREFIX"

awk 'NR == 1 {print; next} {if ($5 < 0) $5 = 0; print}' \
  "$FST_PREFIX.windowed.weir.fst" > "$FST_PREFIX.windowed_fixed.fst"
