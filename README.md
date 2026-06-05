# Пратеничка активност — Parliamentary Open Data Dashboard

Interactive bilingual (MK + ALB) dashboard visualising three open datasets from the Assembly of the Republic of North Macedonia, mandate 2024–2028. Built for **IDSCS** (Institute for Democracy "Societas Civilis") by Дарјан Раденковиќ / Zhar Ptiza.

---

## Modules

| Route | Description |
|---|---|
| `/` | Homepage with KPI summary and module navigation |
| `/questions` | Parliamentary questions — 657 questions, institution answer rates, party breakdown, timeline |
| `/mymp` | MP activity — attendance, discussions, laws, amendments, committees (Jan–Jun 2025) |
| `/offices` | Citizen contact offices — cases, meetings, events, initiatives across 46 MP offices |
| `/profile` | Unified MP profile — all three datasets joined per MP, sortable grid with detail popup |
| `/methodology` | Data sources, limitations and refresh process |

Both MK and ALB language versions are available at `/` and `/al/` respectively.

---

## Data sources

All three raw datasets live in `raw/` and are fetched via `fetch_data.py`. Processed JSON is written to `public/data/` by `scripts/process.py` and read at build time by Astro pages — nothing is fetched at runtime.

| File | Format | Records |
|---|---|---|
| `raw/pratenicki_prasanja_2024-2028.json` | JSON | 657 questions |
| `raw/moj-pratenik-jan-juni-2025.xlsx` | XLSX, 3-row header | 133 MPs |
| `raw/kancelarii.xlsx` | XLSX, tidy/long | 610 rows, 46 MPs |

MP photos, party names and party logos are fetched live from the `kancelarii.sobranie.mk` API (`/api/mps`, `/api/parties`) during the pipeline run and embedded into the processed JSON.

---

## Stack

- **Frontend:** Astro 5 (static output) + React islands (`client:load`) + Tailwind CSS v4
- **Charts:** Recharts (BarChart, LineChart, PieChart)
- **Map:** Leaflet (office locations)
- **i18n:** Custom `t(lang, "key")` helper — strings in `src/i18n/mk.ts` and `src/i18n/al.ts`
- **Data pipeline:** Python 3 — `scripts/process.py`

---

## Commands

### Frontend

```bash
npm install
npm run dev        # dev server at http://localhost:4321
npm run build      # static build → dist/
npm run preview    # preview the build locally
```

### Data pipeline

```bash
# Install Python dependencies (one-time)
pip3 install requests openpyxl pandas rapidfuzz

# Fetch all 3 raw datasets into raw/
python3 fetch_data.py

# Process raw data → public/data/*.json
python3 scripts/process.py

# Then rebuild the frontend
npm run build
```

---

## Deployment

The build output is a fully static site in `dist/`. Deploy by dragging the `dist/` folder to [netlify.com/drop](https://netlify.com/drop) for an instant public URL, or use any static host (GitHub Pages, Vercel, Surge, etc.).

---

## Project structure

```
idscs-dashboard/
├── public/
│   ├── data/               # Processed JSON (output of scripts/process.py)
│   │   ├── questions.json
│   │   ├── mymp.json
│   │   ├── kancelarii.json
│   │   ├── mp_profiles.json
│   │   └── meta.json
│   └── sobranie-logo.svg   # Parliament logo (from www.sobranie.mk)
├── raw/                    # Raw datasets (not committed — fetched by fetch_data.py)
├── scripts/
│   └── process.py          # Data pipeline: parse, normalise, join, output JSON
├── src/
│   ├── components/         # React island components (one per page module)
│   ├── i18n/               # MK + ALB translation strings
│   ├── layouts/Layout.astro
│   └── pages/              # Astro pages (index, questions, mymp, offices, profile, methodology)
├── fetch_data.py           # Downloads raw datasets
└── CLAUDE.md               # Guidance for Claude Code
```

---

## Key data notes

- **Questions dates:** `.NET /Date(unix_ms)/` format — parsed by `parse_dotnet_date()` in `fetch_data.py`. 168 records have `null SittingDate`.
- **MyMP XLSX:** 3-row header; parse with `header=3, sheet_name="IE 1"`. Always use header names, never column index.
- **Name normalisation:** Three different name formats across datasets. MP UUID from `kancelarii.xlsx` is the primary join key; fuzzy match (threshold 80) used for Questions ↔ MyMP joins.
- **Party/photo coverage:** 657/657 questions annotated with party and photo via the `kancelarii.sobranie.mk` API.
