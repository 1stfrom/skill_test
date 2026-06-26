#!/usr/bin/env python3
"""Visualize windowed Fst results from a vcftools `.windowed.weir.fst` file.

Assumptions:
- Input is a tabular vcftools windowed Fst file with CHROM, BIN_START, BIN_END,
  N_VARIANTS, WEIGHTED_FST, and MEAN_FST columns.
- WEIGHTED_FST is the primary statistic for the Manhattan-style plot.
- Positions are plotted at window midpoints. For multi-chromosome files,
  chromosomes are placed on cumulative offsets.

Outputs:
- A Manhattan-style Fst PNG and PDF.
- A top-window zoom PNG.
- A top-window TSV and summary TSV.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator
import numpy as np
import pandas as pd


DEFAULT_INPUT = (
    "cache/run-selection-scan-popgen-test/"
    "popgen_chr10_filtered_temporal_vs_filtered_tropical_25kb_5kb."
    "windowed_fixed.weir.fst"
)
DEFAULT_OUTDIR = "graphs/fst_scan"
DEFAULT_PREFIX = "popgen_chr10_filtered_temporal_vs_filtered_tropical_25kb_5kb"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default=DEFAULT_INPUT, help="Windowed Fst file.")
    parser.add_argument("--outdir", default=DEFAULT_OUTDIR, help="Output directory.")
    parser.add_argument("--prefix", default=DEFAULT_PREFIX, help="Output filename prefix.")
    parser.add_argument(
        "--value-column",
        default="WEIGHTED_FST",
        help="Fst statistic to plot; falls back to MEAN_FST if unavailable.",
    )
    parser.add_argument(
        "--threshold-quantile",
        type=float,
        default=0.99,
        help="Quantile threshold to draw and highlight.",
    )
    return parser.parse_args()


def chrom_sort_key(chrom: object) -> tuple[int, str]:
    text = str(chrom).replace("chr", "").replace("Chr", "")
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    if text.isdigit():
        return (0, f"{int(text):012d}")
    return (1, text)


def format_chrom_label(chrom: object) -> str:
    text = str(chrom).replace("chr", "").replace("Chr", "")
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text


def load_fst(path: Path, value_column: str) -> tuple[pd.DataFrame, str]:
    fst = pd.read_csv(path, sep=r"\s+")
    required = {"CHROM", "BIN_START", "BIN_END", "N_VARIANTS"}
    missing = required.difference(fst.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    if value_column not in fst.columns:
        if "MEAN_FST" in fst.columns:
            value_column = "MEAN_FST"
        else:
            raise ValueError(f"{value_column} and MEAN_FST are both missing.")

    fst[value_column] = pd.to_numeric(fst[value_column], errors="coerce")
    for column in ("BIN_START", "BIN_END", "N_VARIANTS"):
        fst[column] = pd.to_numeric(fst[column], errors="coerce")

    fst = (
        fst.dropna(subset=["CHROM", "BIN_START", "BIN_END", "N_VARIANTS", value_column])
        .query("N_VARIANTS > 0")
        .copy()
    )
    fst["BP"] = fst["BIN_START"] + (fst["BIN_END"] - fst["BIN_START"]) / 2
    chrom_order = sorted(fst["CHROM"].unique(), key=chrom_sort_key)
    chrom_rank = {chrom: rank for rank, chrom in enumerate(chrom_order)}
    fst["chrom_rank"] = fst["CHROM"].map(chrom_rank)
    fst = fst.sort_values(["chrom_rank", "BP"]).reset_index(drop=True)

    offsets = []
    running = 0.0
    for chrom in chrom_order:
        chrom_mask = fst["CHROM"] == chrom
        chrom_max = fst.loc[chrom_mask, "BP"].max()
        offsets.append({"CHROM": chrom, "offset": running, "center": running + chrom_max / 2})
        running += chrom_max
    offset_df = pd.DataFrame(offsets)
    fst = fst.merge(offset_df[["CHROM", "offset"]], on="CHROM", how="left")
    fst["BP_cum"] = fst["BP"] + fst["offset"]
    return fst, value_column


def write_tables(
    fst: pd.DataFrame,
    outdir: Path,
    prefix: str,
    value_column: str,
    threshold_quantile: float,
) -> tuple[Path, Path, float]:
    threshold = float(fst[value_column].quantile(threshold_quantile))
    top = fst.sort_values(value_column, ascending=False).head(25).copy()
    top.insert(0, "rank", np.arange(1, len(top) + 1))
    top_path = outdir / f"{prefix}_top_windows.tsv"
    top[
        ["rank", "CHROM", "BIN_START", "BIN_END", "N_VARIANTS", value_column, "MEAN_FST"]
    ].to_csv(top_path, sep="\t", index=False)

    summary_path = outdir / f"{prefix}_visualization_summary.tsv"
    summary = pd.DataFrame(
        [
            ("windows_plotted", len(fst)),
            ("value_column", value_column),
            ("threshold_quantile", threshold_quantile),
            ("threshold_value", threshold),
            ("mean_value", float(fst[value_column].mean())),
            ("min_value", float(fst[value_column].min())),
            ("max_value", float(fst[value_column].max())),
            ("top_window_chrom", format_chrom_label(top.iloc[0]["CHROM"])),
            ("top_window_start", int(top.iloc[0]["BIN_START"])),
            ("top_window_end", int(top.iloc[0]["BIN_END"])),
            ("top_window_value", float(top.iloc[0][value_column])),
        ],
        columns=["metric", "value"],
    )
    summary.to_csv(summary_path, sep="\t", index=False)
    return top_path, summary_path, threshold


def plot_manhattan(
    fst: pd.DataFrame,
    outdir: Path,
    prefix: str,
    value_column: str,
    threshold: float,
) -> tuple[Path, Path]:
    chrom_info = (
        fst.groupby("CHROM", sort=False)
        .agg(center=("BP_cum", "median"), chrom_rank=("chrom_rank", "first"))
        .reset_index()
        .sort_values("chrom_rank")
    )
    above = fst[value_column] >= threshold

    fig, ax = plt.subplots(figsize=(12, 4.8), constrained_layout=True)
    ax.scatter(
        fst.loc[~above, "BP_cum"] / 1e6,
        fst.loc[~above, value_column],
        s=8,
        c="#3a6ea5",
        alpha=0.55,
        linewidths=0,
        label="Windows",
    )
    ax.scatter(
        fst.loc[above, "BP_cum"] / 1e6,
        fst.loc[above, value_column],
        s=14,
        c="#d55e00",
        alpha=0.9,
        linewidths=0,
        label="Top 1%",
    )
    ax.axhline(threshold, color="#b2182b", linestyle="--", linewidth=1.1)
    ax.text(
        0.995,
        threshold,
        f" 99th percentile = {threshold:.3f}",
        transform=ax.get_yaxis_transform(),
        color="#8f1d2c",
        va="bottom",
        ha="right",
        fontsize=9,
    )
    if len(chrom_info) == 1:
        chrom_label = format_chrom_label(chrom_info.iloc[0]["CHROM"])
        ax.set_xlabel(f"Chromosome {chrom_label} position (Mb)")
        ax.xaxis.set_major_locator(MaxNLocator(nbins=8))
    else:
        ax.set_xticks(chrom_info["center"] / 1e6)
        ax.set_xticklabels([format_chrom_label(chrom) for chrom in chrom_info["CHROM"]])
        ax.set_xlabel("Chromosome")
    ax.set_ylabel(value_column)
    ax.set_title("Windowed Fst: filtered temporal vs filtered tropical")
    ax.yaxis.set_major_locator(MaxNLocator(nbins=6))
    ax.grid(axis="y", color="#dddddd", linewidth=0.7)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(loc="upper left", frameon=False, markerscale=1.5)

    png_path = outdir / f"{prefix}_fst_manhattan.png"
    pdf_path = outdir / f"{prefix}_fst_manhattan.pdf"
    fig.savefig(png_path, dpi=300)
    fig.savefig(pdf_path)
    plt.close(fig)
    return png_path, pdf_path


def plot_top_zoom(
    fst: pd.DataFrame,
    outdir: Path,
    prefix: str,
    value_column: str,
    threshold: float,
) -> Path:
    top = fst.sort_values(value_column, ascending=False).iloc[0]
    chrom = top["CHROM"]
    chrom_label = format_chrom_label(chrom)
    center = top["BP"]
    zoom_bp = 2_000_000
    region = fst[
        (fst["CHROM"] == chrom)
        & (fst["BP"] >= center - zoom_bp)
        & (fst["BP"] <= center + zoom_bp)
    ].copy()

    fig, ax = plt.subplots(figsize=(10, 4.8), constrained_layout=True)
    ax.plot(region["BP"] / 1e6, region[value_column], color="#3a6ea5", linewidth=1)
    ax.scatter(region["BP"] / 1e6, region[value_column], s=10, color="#3a6ea5", alpha=0.65)
    ax.scatter([top["BP"] / 1e6], [top[value_column]], s=42, color="#d55e00", zorder=3)
    ax.axhline(threshold, color="#b2182b", linestyle="--", linewidth=1.1)
    ax.set_xlabel(f"Chromosome {chrom_label} position (Mb)")
    ax.set_ylabel(value_column)
    ax.set_title(
        f"Top Fst region: chr{chrom_label}:{int(top['BIN_START']):,}-{int(top['BIN_END']):,}"
    )
    ax.grid(axis="y", color="#dddddd", linewidth=0.7)
    ax.spines[["top", "right"]].set_visible(False)

    png_path = outdir / f"{prefix}_fst_top_region_zoom.png"
    fig.savefig(png_path, dpi=300)
    plt.close(fig)
    return png_path


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    fst, value_column = load_fst(input_path, args.value_column)
    top_path, summary_path, threshold = write_tables(
        fst, outdir, args.prefix, value_column, args.threshold_quantile
    )
    png_path, pdf_path = plot_manhattan(fst, outdir, args.prefix, value_column, threshold)
    zoom_path = plot_top_zoom(fst, outdir, args.prefix, value_column, threshold)

    print(f"input={input_path}")
    print(f"plot_png={png_path}")
    print(f"plot_pdf={pdf_path}")
    print(f"zoom_png={zoom_path}")
    print(f"summary={summary_path}")
    print(f"top_windows={top_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
