#!/usr/bin/env python3
"""
Starter ingestion script for the Sobranie open-data dashboard.

Fetches the three datasets required by the IDSCS tender:
  - Пратенички прашања 2024-2028 (Parliamentary questions) — JSON
  - Мојот пратеник (MyMP — MP activity) — XLSX
  - Канцеларии за контакт (Citizen contact offices) — XLSX

Usage:
    pip install requests
    python fetch_data.py

Output:
    raw/pratenicki_prasanja_2024-2028.json
    raw/moj_pratenik_jan_juni_2025.xlsx
    raw/kancelarii.xlsx

Notes:
  - The dates in the questions JSON use the .NET legacy format "/Date(ms)/".
    We don't transform them here — that's the job of the processing layer.
  - The portal runs CKAN 2.9.5; you can also discover resources dynamically:
        GET https://opendata.sobranie.mk/api/3/action/package_show?id=<package-slug>
    This file uses direct resource URLs for clarity in V1.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import requests

DATASETS = [
    {
        "slug": "pratenicki_prasanja_2024-2028",
        "name": "Parliamentary questions 2024-2028",
        "url": (
            "https://opendata.sobranie.mk/dataset/"
            "9fe4f2b1-4a13-4db3-ae2b-45dea63d5a6c/resource/"
            "08807be2-300b-468f-b062-cf2074a22b10/download/"
            "pratenicki_prasanja_2024-2028.json"
        ),
        "filename": "pratenicki_prasanja_2024-2028.json",
        "format": "json",
    },
    {
        "slug": "moj_pratenik",
        "name": "MyMP periodic report (Jan-Jun 2025, report #32)",
        "url": (
            "https://opendata.sobranie.mk/dataset/"
            "d218754b-c28d-4ec7-b1ed-65845e4ed377/resource/"
            "1fca31cf-c8e8-488b-b411-523c962b7a6f/download/"
            "moj-pratenik-jan-juni-2025.xlsx"
        ),
        "filename": "moj-pratenik-jan-juni-2025.xlsx",
        "format": "xlsx",
    },
    {
        "slug": "kancelarii_kontakt_gragjani",
        "name": "Citizen contact offices",
        "url": (
            "https://opendata.sobranie.mk/dataset/"
            "1b110b47-823b-4cc7-9ca4-028acb1795b2/resource/"
            "2b4116eb-a2c0-47d6-b026-ec94a8ff1d53/download/"
            "kancelarii.xlsx"
        ),
        "filename": "kancelarii.xlsx",
        "format": "xlsx",
    },
]

CKAN_BASE = "https://opendata.sobranie.mk/api/3/action"
HEADERS = {"User-Agent": "idscs-dashboard-ingest/0.1 (+civic-tech)"}


def parse_dotnet_date(value: str | None) -> str | None:
    """
    Convert /Date(1776775955000)/ -> ISO-8601 string. Returns None if input is None.
    Raises if format is unrecognised.
    """
    if value is None:
        return None
    m = re.match(r"^/Date\((\d+)\)/$", value)
    if not m:
        raise ValueError(f"Unexpected date format: {value!r}")
    ms = int(m.group(1))
    return datetime.utcfromtimestamp(ms / 1000).isoformat() + "Z"


def fetch_one(dataset: dict, raw_dir: Path) -> None:
    out = raw_dir / dataset["filename"]
    print(f"  → fetching {dataset['name']}")
    print(f"    URL: {dataset['url']}")
    resp = requests.get(dataset["url"], headers=HEADERS, timeout=60)
    resp.raise_for_status()
    out.write_bytes(resp.content)
    size_kb = len(resp.content) / 1024
    print(f"    ✓ saved {out.name} ({size_kb:.1f} KB)")

    # For JSON, print a quick schema/health summary
    if dataset["format"] == "json":
        try:
            data = json.loads(resp.content)
            if isinstance(data, list) and data:
                first = data[0]
                print(f"    schema (first record keys): {list(first.keys())}")
                print(f"    record count: {len(data)}")
                # Quick health checks
                null_dates = sum(1 for r in data if r.get("SittingDate") is None)
                empty_answers = sum(
                    1 for r in data if not r.get("ShortAnswer") and r.get("Status") == "Одговорено"
                )
                print(f"    records with null SittingDate: {null_dates}")
                print(f"    'Одговорено' records with empty ShortAnswer: {empty_answers}")
        except Exception as e:
            print(f"    (could not introspect JSON: {e})")


def fetch_ckan_metadata(slug: str) -> dict | None:
    """
    Hit CKAN's package_show endpoint for the latest metadata (resource list,
    last update timestamp). Useful for cron jobs to detect new resources.
    """
    url = f"{CKAN_BASE}/package_show"
    try:
        r = requests.get(url, params={"id": slug}, headers=HEADERS, timeout=30)
        r.raise_for_status()
        body = r.json()
        if body.get("success"):
            return body["result"]
    except Exception as e:
        print(f"  ! metadata fetch failed for {slug}: {e}")
    return None


def main() -> int:
    root = Path(__file__).resolve().parent
    raw_dir = root / "raw"
    raw_dir.mkdir(exist_ok=True)

    print("=" * 70)
    print("IDSCS Sobranie Open Data — ingestion (V1)")
    print("=" * 70)

    for ds in DATASETS:
        print(f"\n[{ds['slug']}]")
        try:
            fetch_one(ds, raw_dir)
        except requests.HTTPError as e:
            print(f"    ✗ HTTP error: {e}")
        except Exception as e:
            print(f"    ✗ unexpected error: {e}")

    print("\n" + "=" * 70)
    print("CKAN metadata check (for cron detection of new resources)")
    print("=" * 70)
    for slug in ("pratenicki_prasanja_2024-2028", "ttepnodnheh-n3bewtaj-mojot-npatehnk", "kancelarii_kontakt_gragjani"):
        meta = fetch_ckan_metadata(slug)
        if meta:
            resources = meta.get("resources", [])
            print(f"  {slug}: {len(resources)} resource(s), modified {meta.get('metadata_modified')}")
        else:
            print(f"  {slug}: metadata not fetched")

    print("\nDone. Inspect raw/ folder for downloaded files.")
    print("Next steps: write a parser for each format and emit clean JSON into /public/data/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
