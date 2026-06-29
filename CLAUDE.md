# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

IDSCS Parliamentary Open Data Dashboard — a public-facing bilingual (MK + ALB) dashboard visualising three Sobranie open datasets. Built by Дарјан Раденковиќ (physical person / Zhar Ptiza). Tender deadline was 17 May 2026; implementation runs May–June 2026 with a July 2026 launch and data refresh support until March 2027.

Full brief: `docs/PROJECT_BRIEF.md` — read it before making architectural decisions.

## Stack

- **Frontend:** Astro 5 + React islands + Tailwind CSS v4 + Recharts + Leaflet
- **Data pipeline:** Python 3 (requests, pandas, openpyxl, rapidfuzz) — `fetch_data.py` fetches, `scripts/process.py` transforms
- **i18n:** MK + ALB + ENG, strings in `src/i18n/{mk,al,en}.json` (see Translations workflow below)
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

**Source of truth = the active assembly of 120 MPs**, fetched from `kancelarii.sobranie.mk/api/mps` where `statusId == True`. Written to `public/data/mps_active.json` keyed by `parliamentUserId` UUID. All MP-level data is scoped to these 120.

Join approach (in `process.py`):
- **Канцеларии → UUID** (`Идентификатор на пратеник` == API `parliamentUserId`): exact, 46/46.
- **MyMP + Questions → name**: deterministic `norm_name()` (accent-strip, token-sort, drop Latin part) + an explicit `NAME_OVERRIDES` table for ~5 spelling variants. **No fuzzy matching** — it caused cross-person false positives (e.g. minister `Николоски Александар` → active `Александра Николовска`). The build prints any unmatched row so new variants are caught and added to the table.

## Pipeline commands

```bash
# Install dependencies (one-time)
pip3 install requests openpyxl pandas

# Fetch/refresh all 3 datasets into raw/
python3 fetch_data.py

# Process raw data into public/data/*.json (also fetches the active roster +
# downloads MP photos/party logos into public/mp-media/ — needs network)
python3 scripts/process.py
```

## Frontend commands

```bash
npm install
npm run dev        # dev server at http://localhost:4321
npm run build      # static build into dist/
npm run preview    # preview the build

# Refresh data:
# python3 fetch_data.py && python3 scripts/process.py
# Deploy: repo is connected to Netlify — push to main (GitHub: darjanr/idscs-dashboard)
# auto-builds & deploys. netlify.toml holds build config + security headers/CSP.
# (Manual fallback: npm run build, then drag dist/ to app.netlify.com/drop)

# NOTE: node/npm are not on PATH by default — load nvm first:
#   export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
```

## Translations workflow (MK / AL / EN — single source of truth)

The site is trilingual. **MK lives at the site root**, AL under `src/pages/al/*`, EN under
`src/pages/en/*` — all plain static pages (Astro 6 would not prerender a `[lang]` dynamic
route, so don't reintroduce one). The МК/АЛ/EN toggle is in `Nav.astro`.

Two kinds of translatable text:
- **UI strings** → `src/i18n/{mk,al,en}.json` (read via `t(lang, "key")`; arrays/structured
  content via `dict(lang)`).
- **Data values** (MP names, party names) → `src/i18n/mp_names.json` + `src/i18n/parties.json`,
  rendered through `tName(lang, cyrillic)` / `tParty(lang, cyrillic)` / `partyAcr(...)` from
  `src/i18n/translate.ts`. MK returns the original Cyrillic; AL/EN look up the map and fall
  back to the original. MP names are seeded from the roster API's `nameAl`/`nameEn`; party
  names are curated. Institution names are intentionally NOT translated.

**`translations.xlsx` is the editable single source of truth** for the client to verify
(tabs: UI text, Parties, MP names — MK/AL/EN columns). Round-trip:

```bash
python3 scripts/i18n_export.py   # locale/map JSON -> translations.xlsx
# client edits translations.xlsx, returns it
python3 scripts/i18n_import.py   # translations.xlsx -> regenerates the JSON files
npm run build                    # then commit
```

The JSON files are generated artifacts; edit text in the xlsx (or the JSON) and re-run the
round-trip. New MP added on data refresh: re-run export (prefills from API), then import.

## Modules and build order

Build in this order — each depends on the previous:

1. **Python pipeline** (`scripts/process.py`) — fetches the active 120 roster, parses all 3 datasets, joins (UUID + name overrides), scopes MP data to the 120, downloads photos/logos to `public/mp-media/`, outputs `mps_active.json`, `questions.json`, `mymp.json`, `kancelarii.json`, `mp_profiles.json`, `office_coords.json`, `meta.json`
2. **Questions module** — richest and most complex; validates the pipeline design
3. **MyMP module** — depends on same pipeline patterns
4. **Канцеларии module** — simplest; long format already clean
5. **MP Profile cross-view** — depends on all three datasets being joined in the pipeline
6. **MK+ALB translations** — applied across all modules; use i18n keys from the start, never hardcode Macedonian strings directly in components
7. **Export, accessibility, polish**

## Design

Navy (`#1a2e5a`) header + teal/cyan (`#0d9488`) charts. Header logo = DDI (funder, in a white chip); footer partner strip = CIVICUS → Metamorphosis → TechSoup → Digital Activism → IDSCS; hero uses the white-line parliament illustration (`public/parliament.svg`). Colours are client-approved — do not change. WCAG 2.1 AA, mobile-first.

## Chart download

`ChartDownload` component (`src/components/ChartDownload.tsx`) + `src/lib/chartExport.ts` give a per-visual PNG/CSV menu. PNG uses **`html2canvas-pro`** (NOT `html2canvas` — the original throws on Tailwind v4's `oklch()` colours). The control marks itself `data-html2canvas-ignore`; mark pagination/controls the same so they're excluded from the screenshot. PNG needs same-origin images — that's why photos are self-hosted in `public/mp-media/`.

## Key numbers (for sanity checks)

- **Active assembly: 120 MPs** (everything is scoped to these). MyMP report has 116 of them with Jan–Jun 2025 data; 4 joined after the period (shown but flagged).
- Total questions: 657 (record kept complete) | 647 from active MPs | top asker Сали Мурати — 99
- Канцеларии: 46 office-holders (44 active + 2 former MPs)
- The 12 zero-attendance names in the raw MyMP report are ministers/PM (mandate frozen) — excluded.
- Top citizen issue: Работен однос и права — 183 cases
