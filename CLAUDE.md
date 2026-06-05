# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

IDSCS Parliamentary Open Data Dashboard — a public-facing bilingual (MK + ALB) dashboard visualising three Sobranie open datasets. Built by Дарјан Раденковиќ (physical person / Zhar Ptiza). Tender deadline was 17 May 2026; implementation runs May–June 2026 with a July 2026 launch and data refresh support until March 2027.

Full brief: `docs/PROJECT_BRIEF.md` — read it before making architectural decisions.

## Stack

- **Frontend:** Astro 5 + React islands + Tailwind CSS v4 + Recharts + Leaflet
- **Data pipeline:** Python 3 (requests, pandas, openpyxl, rapidfuzz) — `fetch_data.py` fetches, `scripts/process.py` transforms
- **i18n:** MK + ALB, strings in `src/i18n/mk.ts` and `src/i18n/al.ts`
- **Hosting:** Static build deployed to Netlify (drag-and-drop `dist/`)
- **Repo:** Public GitHub, handed over to IDSCS at end

## Data sources

All three datasets are downloaded to `raw/` via `fetch_data.py`. Do not hardcode resource URLs in the frontend — always read from the processed JSON in `public/data/`.

| File | Format | Records | Last updated |
|---|---|---|---|
| `raw/pratenicki_prasanja_2024-2028.json` | JSON | 657 | 10 May 2026 |
| `raw/moj-pratenik-jan-juni-2025.xlsx` | XLSX, 3-row header | 133 MPs | Nov 2025 |
| `raw/kancelarii.xlsx` | XLSX, tidy/long | 610 rows, 46 MPs | Jan 2026 |

## Critical data quirks

**Questions JSON:** Dates are `.NET /Date(unix_ms)/` format — use `parse_dotnet_date()` in `fetch_data.py`, not any standard parser. 168 records have `null SittingDate` (not yet assigned to a session). 91 records have `null ToInstitution` (addressed to independent bodies — bucket as "Друго/Tjetër").

**MyMP XLSX:** Has a 3-row header. Row 4 contains short internal codes (`pris`, `izla1`, `g11`...). Always parse by header name, never by column index — the column order can change between report issues. Read with `header=3, sheet_name="IE 1"`, then drop the last column (empty). 133 data rows, not 134 (one is a repeat header).

**Канцеларии XLSX:** Clean tidy/long format. Has MP UUID (`Идентификатор на пратеник`) — use this as the primary join key where possible.

## Name normalisation (cross-dataset join)

Three different name formats across datasets:
- Questions: `"Сали Мурати"` (Firstname Lastname, Cyrillic)
- MyMP: `"МУРАТИ САЛИ"` or `"МУРАТИ САЛИ/MURATI SALI"` for Albanian MPs (LASTNAME FIRSTNAME, bilingual)
- Канцеларии: `"Сали Мурати"` (Firstname Lastname) + UUID

Normalisation approach: strip Albanian part (after `/`), split LASTNAME FIRSTNAME, reverse and capitalise. Achieves 93% match Канцеларии↔MyMP. Remaining ~7% need fuzzy match by surname. The MP UUID in Канцеларии is the most reliable join key — use it wherever possible and fall back to name normalisation only for Questions↔MyMP joins.

## Pipeline commands

```bash
# Install dependencies (one-time)
pip3 install requests openpyxl pandas rapidfuzz

# Fetch/refresh all 3 datasets into raw/
python3 fetch_data.py

# Process raw data into public/data/*.json
python3 scripts/process.py
```

## Frontend commands

```bash
npm install
npm run dev        # dev server at http://localhost:4321
npm run build      # static build into dist/
npm run preview    # preview the build

# Full redeploy workflow:
# python3 fetch_data.py && python3 scripts/process.py && npm run build
# then drag dist/ to Netlify
```

## Modules and build order

Build in this order — each depends on the previous:

1. **Python pipeline** (`scripts/process.py`) — parses all 3 datasets, normalises names, joins, outputs `public/data/questions.json`, `public/data/mymp.json`, `public/data/kancelarii.json`, `public/data/mp_profiles.json`
2. **Questions module** — richest and most complex; validates the pipeline design
3. **MyMP module** — depends on same pipeline patterns
4. **Канцеларии module** — simplest; long format already clean
5. **MP Profile cross-view** — depends on all three datasets being joined in the pipeline
6. **MK+ALB translations** — applied across all modules; use i18n keys from the start, never hardcode Macedonian strings directly in components
7. **Export, accessibility, polish**

## Design

IDSCS will provide a brandbook. Until received, use a neutral palette. The reference design language (from `kancelarii.sobranie.mk/dashboard`, built by IDSCS/NDI) uses a dark navy header and teal/cyan charts — our dashboard can follow a similar institutional aesthetic. Must be WCAG 2.1 AA compliant and mobile-first.

## Key numbers (for sanity checks)

- Total questions: 657 | Answered: 590 | Pending: 57
- Questions sessions: 18 to 101 (30 unique sessions)
- MPs in MyMP: 133 | MPs asking 0 questions in H1 2025: 81 (61%)
- Top MP by questions (full term): Сали Мурати — 99
- Top institution: Претседател на Владата — 110 questions
- Канцеларии MPs: 46 of ~120 total MPs
- Top citizen issue: Работен однос и права — 183 cases
