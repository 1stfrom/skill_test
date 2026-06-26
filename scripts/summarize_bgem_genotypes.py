#!/usr/bin/env python3
"""
Summarize BGEM genotype input files from the project root.

Inputs:
- A BGEM genotype directory containing VCF/VCF.GZ files and companion metadata.

HCC path record:
- Project checkout used on HCC:
  /mnt/nrdstor/jyanglab/nathanma/projects/UAV-for-GS
- Shared BGEM data location resolved through largedata/genotype/BGEM:
  /mnt/nrdstor/jyanglab/shared/maize/BGEM
- This script is normally launched by slurm-scripts/summarize_bgem_genotypes.sh
  with absolute paths derived from PROJECT_ROOT.

Outputs:
- file_inventory.tsv: file sizes and paths.
- vcf_header_summary.tsv: VCF header-level counts and sample counts.
- vcf_samples/*.samples.txt: one sample ID per line for each VCF.
- xlsx_inventory.tsv: workbook sheet names and dimensions when .xlsx files exist.
- Optional bcftools stats files and a compact bcftools_stats_summary.tsv.

Parameters:
- Use --run-bcftools-stats only inside a Slurm job because it scans the VCFs.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree


def human_size(num_bytes: int) -> str:
    value = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if value < 1024 or unit == "TB":
            return f"{value:.2f} {unit}"
        value /= 1024
    return f"{num_bytes} B"


def safe_stem(path: Path) -> str:
    name = path.name
    for suffix in (".vcf.gz", ".vcf.bgz", ".vcf"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", name)


def iter_files(input_dir: Path) -> list[Path]:
    return sorted(path for path in input_dir.rglob("*") if path.is_file())


def write_file_inventory(files: list[Path], input_dir: Path, outdir: Path) -> None:
    output = outdir / "file_inventory.tsv"
    with output.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            delimiter="\t",
            fieldnames=[
                "RelativePath",
                "ResolvedPath",
                "Extension",
                "SizeBytes",
                "SizeHuman",
            ],
        )
        writer.writeheader()
        for path in files:
            try:
                size = path.stat().st_size
            except OSError:
                size = 0
            writer.writerow(
                {
                    "RelativePath": str(path.relative_to(input_dir)),
                    "ResolvedPath": str(path.resolve()),
                    "Extension": "".join(path.suffixes),
                    "SizeBytes": size,
                    "SizeHuman": human_size(size),
                }
            )


def open_text_auto(path: Path):
    if path.name.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return path.open("r", encoding="utf-8", errors="replace")


def summarize_vcf_header(path: Path, sample_dir: Path) -> dict[str, str | int]:
    contigs = 0
    filters = 0
    infos = 0
    formats = 0
    samples: list[str] = []

    with open_text_auto(path) as handle:
        for line in handle:
            if line.startswith("##contig="):
                contigs += 1
            elif line.startswith("##FILTER="):
                filters += 1
            elif line.startswith("##INFO="):
                infos += 1
            elif line.startswith("##FORMAT="):
                formats += 1
            elif line.startswith("#CHROM"):
                fields = line.rstrip("\n").split("\t")
                samples = fields[9:] if len(fields) > 9 else []
                break

    sample_output = sample_dir / f"{safe_stem(path)}.samples.txt"
    with sample_output.open("w") as handle:
        for sample in samples:
            handle.write(f"{sample}\n")

    return {
        "VcfFile": path.name,
        "RelativePath": str(path),
        "SizeBytes": path.stat().st_size,
        "SizeHuman": human_size(path.stat().st_size),
        "ContigHeaderCount": contigs,
        "FilterHeaderCount": filters,
        "InfoHeaderCount": infos,
        "FormatHeaderCount": formats,
        "SampleCount": len(samples),
        "FirstSample": samples[0] if samples else "",
        "LastSample": samples[-1] if samples else "",
        "SampleListFile": str(sample_output),
    }


def write_vcf_header_summary(vcf_files: list[Path], outdir: Path) -> None:
    sample_dir = outdir / "vcf_samples"
    sample_dir.mkdir(parents=True, exist_ok=True)
    rows = [summarize_vcf_header(path, sample_dir) for path in vcf_files]
    output = outdir / "vcf_header_summary.tsv"
    fieldnames = [
        "VcfFile",
        "RelativePath",
        "SizeBytes",
        "SizeHuman",
        "ContigHeaderCount",
        "FilterHeaderCount",
        "InfoHeaderCount",
        "FormatHeaderCount",
        "SampleCount",
        "FirstSample",
        "LastSample",
        "SampleListFile",
    ]
    with output.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, delimiter="\t", fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def parse_xlsx_dimension(sheet_xml: bytes) -> str:
    root = ElementTree.fromstring(sheet_xml)
    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    dimension = root.find("main:dimension", namespace)
    return dimension.attrib.get("ref", "") if dimension is not None else ""


def write_xlsx_inventory(xlsx_files: list[Path], input_dir: Path, outdir: Path) -> None:
    output = outdir / "xlsx_inventory.tsv"
    with output.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            delimiter="\t",
            fieldnames=["Workbook", "SheetXml", "Dimension"],
        )
        writer.writeheader()
        for workbook in xlsx_files:
            with zipfile.ZipFile(workbook) as archive:
                sheet_xmls = sorted(
                    name
                    for name in archive.namelist()
                    if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
                )
                for sheet_xml in sheet_xmls:
                    writer.writerow(
                        {
                            "Workbook": str(workbook.relative_to(input_dir)),
                            "SheetXml": sheet_xml,
                            "Dimension": parse_xlsx_dimension(archive.read(sheet_xml)),
                        }
                    )


def run_bcftools_stats(vcf_files: list[Path], outdir: Path) -> None:
    stats_dir = outdir / "bcftools_stats"
    stats_dir.mkdir(parents=True, exist_ok=True)
    summary_rows: list[dict[str, str]] = []

    for path in vcf_files:
        stats_output = stats_dir / f"{safe_stem(path)}.bcftools_stats.txt"
        with stats_output.open("w") as handle:
            subprocess.run(
                ["bcftools", "stats", str(path)],
                check=True,
                stdout=handle,
                stderr=subprocess.PIPE,
                text=True,
            )

        row = {"VcfFile": path.name, "StatsFile": str(stats_output)}
        with stats_output.open() as handle:
            for line in handle:
                if not line.startswith("SN\t0\t"):
                    continue
                parts = line.rstrip("\n").split("\t")
                if len(parts) >= 4:
                    key = parts[2].rstrip(":")
                    row[key] = parts[3]
        summary_rows.append(row)

    keys = ["VcfFile", "StatsFile"]
    for row in summary_rows:
        for key in row:
            if key not in keys:
                keys.append(key)

    with (outdir / "bcftools_stats_summary.tsv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, delimiter="\t", fieldnames=keys)
        writer.writeheader()
        writer.writerows(summary_rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Summarize BGEM genotype files.")
    parser.add_argument("--input-dir", default="largedata/genotype/BGEM")
    parser.add_argument("--outdir", default="cache/genotype/bgem_summary")
    parser.add_argument(
        "--run-bcftools-stats",
        action="store_true",
        help="Run bcftools stats on every VCF. This scans the full genotype files.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir).resolve()
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    if args.run_bcftools_stats and not os.environ.get("SLURM_JOB_ID"):
        print(
            "Refusing to run --run-bcftools-stats without SLURM_JOB_ID.",
            file=sys.stderr,
        )
        return 2

    files = iter_files(input_dir)
    vcf_files = [
        path
        for path in files
        if path.name.endswith((".vcf", ".vcf.gz", ".vcf.bgz"))
    ]
    xlsx_files = [path for path in files if path.name.endswith(".xlsx")]

    write_file_inventory(files, input_dir, outdir)
    write_vcf_header_summary(vcf_files, outdir)
    if xlsx_files:
        write_xlsx_inventory(xlsx_files, input_dir, outdir)
    if args.run_bcftools_stats:
        run_bcftools_stats(vcf_files, outdir)

    print(f"Wrote BGEM genotype summary outputs to {outdir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
