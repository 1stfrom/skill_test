#!/bin/bash -l
#SBATCH -D /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test
#SBATCH -o /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_angsd-%j.out
#SBATCH -e /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_angsd-%j.err
#SBATCH -J popgen_chr10_skill_test_angsd
#SBATCH -t 24:00:00
#SBATCH --ntasks=4
#SBATCH --mem=32G

set -euo pipefail
mkdir -p /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log

module load samtools angsd

REFERENCE="reference.fa"
BAM_LIST="bam_list.txt"
PREFIX="popgen_chr10_skill_test"

samtools faidx "$REFERENCE"

angsd -bam "$BAM_LIST" \
  -doMaf 1 -doMajorMinor 1 -uniqueOnly 1 \
  -minMapQ 30 -minQ 20 -minInd 6 \
  -doSaf 1 -anc "$REFERENCE" -GL 2 \
  -out "$PREFIX" -P 4

realSFS "$PREFIX.saf.idx" -fold 1 -P 4 > "$PREFIX.sfs"
realSFS saf2theta "$PREFIX.saf.idx" -outname "$PREFIX" -sfs "$PREFIX.sfs" -fold 1 -P 4
thetaStat do_stat "$PREFIX.thetas.idx" -win 25000 -step 5000 -outnames "$PREFIX.thetasWindow25000"

angsd -bam "$BAM_LIST" \
  -minMapQ 30 -minQ 20 -GL 2 \
  -doMajorMinor 1 -doMaf 1 -SNP_pval 2e-6 \
  -doIBS 1 -doCounts 1 -doCov 1 -makeMatrix 1 \
  -minMaf 0.05 -out "$PREFIX" -P 4
