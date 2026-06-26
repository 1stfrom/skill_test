#!/bin/bash -l
#SBATCH -D /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test
#SBATCH -o /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_report-%j.out
#SBATCH -e /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_report-%j.err
#SBATCH -J popgen_chr10_skill_test_report
#SBATCH -t 24:00:00
#SBATCH --ntasks=4
#SBATCH --mem=32G

set -euo pipefail
mkdir -p /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log

PREFIX="popgen_chr10_skill_test"
WINDOW="25000"
FST_PREFIX="popgen_chr10_skill_test_filtered_temporal_vs_filtered_tropical"
XPCLR_BASE="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test/xpclr_out/popgen_chr10_skill_test_xpclr"
REGIONS_FILE="/mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test/xpclr_regions.tsv"
SUMMARY="${PREFIX}.selection_scan_checkpoints.tsv"

report() { printf "%s\t%s\n" "$1" "$2" | tee -a "$SUMMARY"; }
printf "metric\tvalue\n" > "$SUMMARY"

report "xpclr_region_count" "$(awk 'NF && $1 !~ /^#/ {n++} END {print n+0}' "$REGIONS_FILE")"
report "xpclr_window_bp" "$WINDOW"
report "xpclr_step_bp" "5000"
report "xpclr_ld_cutoff" "0.7"
report "ld_decay_bp_used" "NA"

THETA_FILE="${PREFIX}.thetasWindow${WINDOW}.pestPG"
if [[ -s "$THETA_FILE" ]]; then
  awk 'BEGIN {OFS="	"}
    NR == 1 {for (i=1; i<=NF; i++) idx[$i]=i; next}
    idx["nSites"] && $idx["nSites"] > 0 {
      n++;
      if (idx["tP"]) sum_p += $idx["tP"] / $idx["nSites"];
      if (idx["tW"]) sum_w += $idx["tW"] / $idx["nSites"];
    }
    END {
      print "theta_windows", n+0;
      if (n > 0 && sum_p != "") print "mean_pairwise_theta_per_site", sum_p/n;
      if (n > 0 && sum_w != "") print "mean_watterson_theta_per_site", sum_w/n;
    }' "$THETA_FILE" | tee -a "$SUMMARY"
else
  report "theta_status" "missing:$THETA_FILE"
fi

FST_FILE="${FST_PREFIX}.windowed_fixed.fst"
if [[ -s "$FST_FILE" ]]; then
  awk 'BEGIN {OFS="	"}
    NR == 1 {
      for (i=1; i<=NF; i++) if ($i ~ /WEIGHTED_FST|MEAN_FST/) col=i;
      next
    }
    col && $col != "nan" && $col != "-nan" {n++; sum += $col; if (n == 1 || $col > max) max=$col}
    END {
      print "fst_windows", n+0;
      if (n > 0) {print "mean_windowed_fst", sum/n; print "max_windowed_fst", max}
    }' "$FST_FILE" | tee -a "$SUMMARY"
else
  report "fst_status" "missing:$FST_FILE"
fi

XPCLR_DIR="$(dirname "$XPCLR_BASE")"
XPCLR_STEM="$(basename "$XPCLR_BASE")"
if [[ -d "$XPCLR_DIR" ]]; then
  report "xpclr_output_files" "$(find "$XPCLR_DIR" -type f -name "${XPCLR_STEM}_*" | wc -l | awk '{print $1}')"
else
  report "xpclr_output_files" "0"
fi
