#!/usr/bin/env python3
"""Small runnable analysis placeholder for template smoke tests and Slurm handoffs."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a minimal reproducible template analysis.")
    parser.add_argument("--input", required=True, help="Path to a small CSV input file.")
    parser.add_argument("--output", required=True, help="Path for the text report to write.")
    return parser.parse_args()


def read_values(input_path: Path) -> list[float]:
    with input_path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        if "value" not in (reader.fieldnames or []):
            raise ValueError(f"{input_path} must contain a 'value' column.")
        return [float(row["value"]) for row in reader]


def write_report(output_path: Path, input_path: Path, values: list[float]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mean_value = sum(values) / len(values) if values else float("nan")
    output_path.write_text(
        "\n".join(
            [
                "Template analysis report",
                f"Input: {input_path}",
                f"Rows: {len(values)}",
                f"Mean value: {mean_value:.4f}",
                "Next: replace this placeholder with project-specific analysis after human review.",
            ]
        )
        + "\n"
    )


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file does not exist: {input_path}")

    values = read_values(input_path)
    write_report(output_path, input_path, values)
    print(f"Wrote template analysis report to {output_path}")


if __name__ == "__main__":
    main()
