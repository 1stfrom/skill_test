#!/bin/bash -l
#SBATCH -D /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test
#SBATCH -o /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_xpclr-%j.out
#SBATCH -e /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_xpclr-%j.err
#SBATCH -J popgen_chr10_skill_test_xpclr
#SBATCH -t 24:00:00
#SBATCH --ntasks=4
#SBATCH --mem=32G
#SBATCH --array=1-1%4

set -euo pipefail
mkdir -p /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log

module load xpclr/1.1

VCF="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP/hmp321_282_agpv5_maf005_miss03_chr10.recode.vcf"
POP_A="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP/filtered_temporal.txt"
POP_B="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP/filtered_tropical.txt"
REGIONS_FILE="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test/xpclr_regions.tsv"
XPCLR_OUT_BASE="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test/xpclr_out/popgen_chr10_skill_test_xpclr"

mkdir -p "$(dirname "$XPCLR_OUT_BASE")"

REGION_LINE=$(awk -v task="$SLURM_ARRAY_TASK_ID" 'NF && $1 !~ /^#/ {i++; if (i == task) {print; exit}}' "$REGIONS_FILE")
if [[ -z "$REGION_LINE" ]]; then
  echo "No region found for SLURM_ARRAY_TASK_ID=$SLURM_ARRAY_TASK_ID" >&2
  exit 1
fi
read -r REGION_CHR REGION_START REGION_STOP <<< "$REGION_LINE"

REGION_ARGS=(--chr "$REGION_CHR")
REGION_LABEL="$REGION_CHR"
if [[ "${REGION_START:-NA}" != "NA" && "${REGION_STOP:-NA}" != "NA" ]]; then
  REGION_ARGS+=(--start "$REGION_START" --stop "$REGION_STOP")
  REGION_LABEL="${REGION_CHR}_${REGION_START}_${REGION_STOP}"
fi

xpclr \
  --out "${XPCLR_OUT_BASE}_${REGION_LABEL}" \
  --input "$VCF" \
  --format vcf \
  --samplesA "$POP_A" \
  --samplesB "$POP_B" \
  "${REGION_ARGS[@]}" \
  --ld 0.7 \
  --maxsnps 200 \
  --minsnps 200 \
  --size 25000 \
  --step 5000
