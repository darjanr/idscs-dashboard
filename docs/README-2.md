# IDSCS Parliamentary Open Data Dashboard

Working folder for the IDSCS tender bid + implementation.

## Read first
👉 **`docs/PROJECT_BRIEF.md`** — everything about the tender, the data, the
architecture, the open questions, and the open items. Single source of truth.

## Folder map
- `docs/PROJECT_BRIEF.md` — master brief (start here)
- `data-samples/pratenicki_prasanja_2024-2028.sample.json` — real records from the portal, for offline schema reference
- `scripts/fetch_data.py` — working ingestion starter. Run it to pull all 3 required datasets to `scripts/raw/`.

## Quick start when you open this in Claude Code

```bash
cd scripts
pip install requests openpyxl pandas
python fetch_data.py
# Then inspect raw/ — especially the two XLSX files we haven't peeked into yet.
```

## Status
- ✅ Tender analysed; scoring strategy in brief
- ✅ Sobranie open-data portal mapped (29 datasets across 5 groups)
- ✅ Three required datasets identified, URLs locked, JSON schema confirmed from real data
- ⏳ XLSX schemas (MyMP, Канцеларии) — pending local download & inspection
- ⏳ Proposal document — not yet drafted (per Darjan: plan first, draft after meeting confirms budget)
- ⏳ Pre-submission clarification questions to Aleksandra@idscs — draft in brief §9

## Key dates
- **14 May 2026** (today): deadline to send clarification questions to IDSCS
- **17 May 2026, 23:59**: deadline to submit proposal
- **May–June 2026**: execution window
- **July 2026**: public launch
