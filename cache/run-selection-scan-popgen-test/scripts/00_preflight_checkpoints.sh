#!/bin/bash -l
#SBATCH -D /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test
#SBATCH -o /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_preflight-%j.out
#SBATCH -e /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_preflight-%j.err
#SBATCH -J popgen_chr10_skill_test_preflight
#SBATCH -t 24:00:00
#SBATCH --ntasks=4
#SBATCH --mem=32G

set -euo pipefail
mkdir -p /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log

module load bcftools/1.17

VCF="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP/hmp321_282_agpv5_maf005_miss03_chr10.recode.vcf"
BAM_LIST="bam_list.txt"
POP_A="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP/filtered_temporal.txt"
POP_B="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/largedata/SNP/filtered_tropical.txt"
REGIONS_FILE="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test/xpclr_regions.tsv"
PREFIX="popgen_chr10_skill_test"
SCAN_CHR="10"
SUMMARY="${PREFIX}.preflight_checkpoints.tsv"

report() { printf "%s\t%s\n" "$1" "$2" | tee -a "$SUMMARY"; }
count_list() { awk 'NF && $1 !~ /^#/ {n++} END {print n+0}' "$1"; }

printf "metric\tvalue\n" > "$SUMMARY"
report "pop_a_sample_list" "$POP_A"
report "pop_b_sample_list" "$POP_B"
report "pop_a_requested_samples" "$(count_list "$POP_A")"
report "pop_b_requested_samples" "$(count_list "$POP_B")"
report "bam_list" "$BAM_LIST"
if [[ -s "$BAM_LIST" ]]; then report "bam_count" "$(count_list "$BAM_LIST")"; else report "bam_count" "0"; fi
report "xpclr_regions" "$REGIONS_FILE"
report "xpclr_region_count" "$(count_list "$REGIONS_FILE")"
report "xpclr_ld_cutoff" "0.7"
report "ld_decay_bp_used" "NA"
report "window_selection" "manual/default windowing"
report "xpclr_window_bp" "25000"
report "xpclr_step_bp" "5000"
report "xpclr_min_snps" "200"
report "xpclr_max_snps" "200"
report "xpclr_chunk_size" "5000000"
report "xpclr_chunk_overlap" "25000"
report "slurm_array_concurrency" "4"

if [[ -s "$VCF" ]]; then
  bcftools query -l "$VCF" > "${PREFIX}.vcf.samples.txt"
  report "vcf_samples" "$(awk 'NF {n++} END {print n+0}' "${PREFIX}.vcf.samples.txt")"
  report "pop_a_samples_in_vcf" "$(comm -12 <(awk 'NF && $1 !~ /^#/ {print $1}' "$POP_A" | sort -u) <(sort -u "${PREFIX}.vcf.samples.txt") | wc -l | awk '{print $1}')"
  report "pop_b_samples_in_vcf" "$(comm -12 <(awk 'NF && $1 !~ /^#/ {print $1}' "$POP_B" | sort -u) <(sort -u "${PREFIX}.vcf.samples.txt") | wc -l | awk '{print $1}')"
  report "vcf_total_variant_records" "$(bcftools view -H "$VCF" | awk 'END {print NR+0}')"
  if [[ "$SCAN_CHR" != "from_regions_file" ]]; then
    report "vcf_records_on_scan_chr" "$(bcftools view -H "$VCF" | awk -v chr="$SCAN_CHR" '$1 == chr {n++} END {print n+0}')"
  else
    report "vcf_records_on_scan_chr" "not_counted_regions_file"
  fi
else
  report "vcf_status" "missing_or_empty:$VCF"
fi
