#!/usr/bin/env python3
"""Fetch and report OpenRouter model metadata and normalized token pricing.

The OpenRouter models endpoint quotes token prices in USD per token.  This
utility multiplies each token-based rate by 1,000,000, making prices directly
comparable in USD per million tokens.

Examples (PowerShell):
    python "Model Routing/openrouter_model_catalog.py"
    python "Model Routing/openrouter_model_catalog.py" --only-input-models
    python "Model Routing/openrouter_model_catalog.py" --format json --output gemini-models.json
    python "Model Routing/openrouter_model_catalog.py" --model google/gemini-4-argon

With no model arguments, the program lists every currently available Google
Gemini, DeepSeek, and Anthropic Claude model in the live OpenRouter catalog.
Pass one or more ``--model`` options (or ``--model-file``) to supply a list
of model names.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections.abc import Iterable, Mapping
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


MODELS_URL = "https://openrouter.ai/api/v1/models"
ONE_MILLION = Decimal("1000000")
DEFAULT_FAMILY_PREFIXES = ("google/gemini", "deepseek/", "anthropic/claude")

# The names supplied in the initial request.  They double as a ready-to-run
# example when a comparison against just those IDs is wanted.
EXAMPLE_MODEL_IDS = (
    "google/gemini-3.8-flash",
    "google/gemini-3-flash-preview",
    "google/gemini-3.1-flash-lite",
    "google/gemini-3.7-flash",
    "google/gemini-2.5-flash-lite",
)

# These OpenRouter fields are token-billed rates, expressed in USD/token.
TOKEN_PRICING_KEYS = (
    ("prompt", "input_usd_per_million_tokens"),
    ("completion", "output_usd_per_million_tokens"),
    ("input_cache_read", "cache_read_usd_per_million_tokens"),
    ("input_cache_write", "cache_write_usd_per_million_tokens"),
    ("internal_reasoning", "reasoning_usd_per_million_tokens"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch OpenRouter model data and show context windows plus USD per million token pricing."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--model",
        action="append",
        default=[],
        metavar="ID_OR_NAME",
        help="Model ID or display name to look up; repeat for a list.",
    )
    parser.add_argument(
        "--model-file",
        type=Path,
        metavar="PATH",
        help="UTF-8 text file containing one model ID or display name per line.",
    )
    parser.add_argument(
        "--only-input-models",
        action="store_true",
        help="Report only supplied models instead of every model in the selected family.",
    )
    parser.add_argument(
        "--family-prefix",
        action="append",
        default=None,
        metavar="PREFIX",
        help=(
            "ID prefix used to expand the live catalog; repeat to include multiple families. "
            "Defaults to Google Gemini, DeepSeek, and Anthropic Claude."
        ),
    )
    parser.add_argument(
        "--format",
        choices=("table", "json", "csv"),
        default="table",
        help="Report format.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        metavar="PATH",
        help="Write the report to this file instead of standard output.",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("OPENROUTER_API_KEY"),
        help="Optional OpenRouter API key (defaults to OPENROUTER_API_KEY).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30,
        metavar="SECONDS",
        help="Network request timeout.",
    )
    return parser.parse_args()


def read_model_file(path: Path) -> list[str]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise RuntimeError(f"Could not read model list {path}: {error}") from error

    # Permit comments and blank lines so a hand-maintained list remains tidy.
    return [line.strip() for line in lines if line.strip() and not line.lstrip().startswith("#")]


def fetch_models(api_key: str | None, timeout: float) -> list[dict[str, Any]]:
    headers = {"Accept": "application/json", "User-Agent": "openrouter-model-catalog/1.0"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    request = Request(MODELS_URL, headers=headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.load(response)
    except HTTPError as error:
        message = error.read().decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"OpenRouter returned HTTP {error.code}: {message}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach {MODELS_URL}: {error.reason}") from error
    except TimeoutError as error:
        raise RuntimeError(f"OpenRouter request timed out after {timeout:g} seconds.") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("OpenRouter returned invalid JSON.") from error

    models = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(models, list):
        raise RuntimeError("Unexpected OpenRouter response: expected a top-level 'data' model list.")
    return [model for model in models if isinstance(model, dict)]


def money_per_million(value: Any, max_decimal_places: int | None = None) -> str | None:
    """Convert an OpenRouter USD/token price to a compact USD/million string."""
    if value is None:
        return None
    try:
        amount = Decimal(str(value)) * ONE_MILLION
    except (InvalidOperation, ValueError):
        return None
    if not amount.is_finite():
        return None
    if max_decimal_places is not None:
        try:
            quantum = Decimal("1").scaleb(-max_decimal_places)
            amount = amount.quantize(quantum, rounding=ROUND_HALF_UP)
        except InvalidOperation:
            return None
    return format(amount.normalize(), "f")


def select_models(
    catalog: Iterable[dict[str, Any]],
    requested_names: Iterable[str],
    family_prefixes: Iterable[str],
    only_requested: bool,
) -> tuple[list[dict[str, Any]], list[str]]:
    models = list(catalog)
    requested = list(dict.fromkeys(name.strip() for name in requested_names if name.strip()))
    id_index = {str(model.get("id", "")).casefold(): model for model in models}
    name_index = {str(model.get("name", "")).casefold(): model for model in models}
    found_requested: list[dict[str, Any]] = []
    missing: list[str] = []

    for name in requested:
        match = id_index.get(name.casefold()) or name_index.get(name.casefold())
        if match is None:
            missing.append(name)
        elif match not in found_requested:
            found_requested.append(match)

    if only_requested:
        selected = found_requested
    else:
        normalized_prefixes = tuple(prefix.casefold() for prefix in family_prefixes if prefix.strip())
        selected = [
            model
            for model in models
            if str(model.get("id", "")).casefold().startswith(normalized_prefixes)
        ]

        # If a requested model is outside the expanded family, retain it too.
        selected.extend(model for model in found_requested if model not in selected)

    return sorted(selected, key=lambda model: str(model.get("id", "")).casefold()), missing


def normalize_model(model: Mapping[str, Any]) -> dict[str, Any]:
    pricing = model.get("pricing")
    pricing = pricing if isinstance(pricing, Mapping) else {}
    architecture = model.get("architecture")
    architecture = architecture if isinstance(architecture, Mapping) else {}
    input_modalities = architecture.get("input_modalities")
    input_modalities = [str(item) for item in input_modalities] if isinstance(input_modalities, list) else []
    output_modalities = architecture.get("output_modalities")
    output_modalities = [str(item) for item in output_modalities] if isinstance(output_modalities, list) else []

    record: dict[str, Any] = {
        "id": model.get("id"),
        "provider": str(model.get("id", "")).partition("/")[0] or None,
        "name": model.get("name"),
        "context_length_tokens": model.get("context_length"),
        "max_completion_tokens": model.get("top_provider", {}).get("max_completion_tokens")
        if isinstance(model.get("top_provider"), Mapping)
        else None,
        "modality": architecture.get("modality"),
        "input_modalities": input_modalities,
        "output_modalities": output_modalities,
        "capability_tags": [
            *(f"input:{modality}" for modality in input_modalities),
            *(f"output:{modality}" for modality in output_modalities),
        ],
    }
    for source_key, output_key in TOKEN_PRICING_KEYS:
        # Keep published precision except for cache read/write rates, which
        # are intentionally rounded to at most three decimal places.
        decimal_places = 3 if source_key in {"input_cache_read", "input_cache_write"} else None
        record[output_key] = money_per_million(pricing.get(source_key), decimal_places)

    extra_pricing = {
        key: value
        for key, value in pricing.items()
        if key not in {source_key for source_key, _ in TOKEN_PRICING_KEYS}
    }
    # Values such as web_search and request are not necessarily token-priced,
    # so preserve their API values instead of incorrectly multiplying by 1M.
    record["other_pricing_usd_as_published"] = extra_pricing
    return record


def compact(value: Any, limit: int = 30) -> str:
    text = "N/A" if value is None or value == "" else str(value)
    return f"{text[: limit - 3]}..." if len(text) > limit else text


def table_report(records: list[dict[str, Any]]) -> str:
    rows = [
        (
            compact(record["id"], 42),
            compact(record["provider"], 12),
            compact(record["context_length_tokens"], 13),
            compact(record["input_usd_per_million_tokens"], 20),
            compact(record["output_usd_per_million_tokens"], 20),
            compact(record["cache_read_usd_per_million_tokens"], 20),
            compact(record["cache_write_usd_per_million_tokens"], 20),
            compact(record["reasoning_usd_per_million_tokens"], 20),
            compact(", ".join(record["capability_tags"]), 52),
        )
        for record in records
    ]
    headers = (
        "Model ID",
        "Provider",
        "Context",
        "Input / 1M",
        "Output / 1M",
        "Cache R / 1M",
        "Cache W / 1M",
        "Reasoning / 1M",
        "Capabilities",
    )
    widths = [max(len(header), *(len(row[index]) for row in rows)) for index, header in enumerate(headers)]

    def make_row(row: tuple[str, ...]) -> str:
        return " | ".join(cell.ljust(widths[index]) for index, cell in enumerate(row))

    divider = "-+-".join("-" * width for width in widths)
    output = [make_row(headers), divider, *(make_row(row) for row in rows)]
    output.append(f"\n{len(records)} model(s). Prices are USD per 1,000,000 tokens; N/A means not published.")
    return "\n".join(output) + "\n"


def json_report(records: list[dict[str, Any]]) -> str:
    return json.dumps(records, indent=2, ensure_ascii=False) + "\n"


def csv_report(records: list[dict[str, Any]]) -> str:
    if not records:
        return ""
    json_columns = {"input_modalities", "output_modalities", "capability_tags", "other_pricing_usd_as_published"}
    columns = [key for key in records[0] if key not in json_columns] + [
        "input_modalities",
        "output_modalities",
        "capability_tags",
        "other_pricing_usd_as_published",
    ]
    from io import StringIO

    stream = StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=columns)
    writer.writeheader()
    for record in records:
        row = dict(record)
        for column in json_columns:
            row[column] = json.dumps(row[column], sort_keys=True)
        writer.writerow(row)
    return stream.getvalue()


def main() -> int:
    args = parse_args()
    requested = list(args.model)
    if args.model_file:
        try:
            requested.extend(read_model_file(args.model_file))
        except RuntimeError as error:
            print(f"Error: {error}", file=sys.stderr)
            return 2

    if args.only_input_models and not requested:
        print("--only-input-models requires at least one --model or --model-file entry.", file=sys.stderr)
        return 2

    try:
        catalog = fetch_models(args.api_key, args.timeout)
    except RuntimeError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    family_prefixes = args.family_prefix or DEFAULT_FAMILY_PREFIXES
    selected, missing = select_models(catalog, requested, family_prefixes, args.only_input_models)
    records = [normalize_model(model) for model in selected]
    for name in missing:
        print(f"Warning: requested model not found in the live catalog: {name}", file=sys.stderr)
    if not records:
        print("No models matched the selected criteria.", file=sys.stderr)
        return 1

    report = {
        "table": table_report,
        "json": json_report,
        "csv": csv_report,
    }[args.format](records)
    if args.output:
        try:
            args.output.write_text(report, encoding="utf-8", newline="")
        except OSError as error:
            print(f"Error: could not write {args.output}: {error}", file=sys.stderr)
            return 1
        print(f"Wrote {len(records)} model(s) to {args.output}")
    else:
        print(report, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
