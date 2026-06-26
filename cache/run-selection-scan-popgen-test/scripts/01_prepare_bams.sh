#!/bin/bash -l
#SBATCH -D /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/cache/run-selection-scan-popgen-test
#SBATCH -o /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_prep_bams-%j.out
#SBATCH -e /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log/popgen_chr10_skill_test_prep_bams-%j.err
#SBATCH -J popgen_chr10_skill_test_prep_bams
#SBATCH -t 24:00:00
#SBATCH --ntasks=4
#SBATCH --mem=32G

set -euo pipefail
mkdir -p /mnt/nrdstor/jyanglab/nathanma/projects/skill_test/slurm-log

module load bwa samtools picard

# samples.tsv columns: sample_id<TAB>read1.fastq.gz<TAB>read2.fastq.gz
SAMPLES_TSV="samples.tsv"
REFERENCE="reference.fa"
OUTDIR="bam"

mkdir -p "$OUTDIR"
bwa index "$REFERENCE"

while IFS=$'	' read -r sample read1 read2; do
  [[ -z "${sample:-}" || "$sample" == sample* ]] && continue
  bwa mem -t 4 "$REFERENCE" "$read1" "$read2" \
    | samtools view -bSh - \
    | samtools sort -o "$OUTDIR/${sample}.sorted.bam" -
  samtools index "$OUTDIR/${sample}.sorted.bam"
done < "$SAMPLES_TSV"

find "$OUTDIR" -name '*.sorted.bam' | sort > "bam_list.txt"
