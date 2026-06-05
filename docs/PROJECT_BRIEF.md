# IDSCS Parliamentary Open Data Dashboard — Project Brief

> Single source of truth for the proposal and the implementation.
> Maintained by Darjan Radenkovikj. Last updated: 14 May 2026.

---

## 0. TL;DR

IDSCS published a tender (call doc dated 6 May 2026, deadline **17 May 23:59**) for a public dashboard built on **`opendata.sobranie.mk`** — the Sobranie's CKAN 2.9.5 open data portal. Three required datasets: parliamentary questions, MP activity ("Мојот пратеник"), and citizen-contact-office work. Execution May–June 2026, public launch July 2026. Budget: **€4,000 gross / €3,600 net** (confirmed 14 May).

Applicant: **Darjan Radenkovikj** as physical person (for tax reasons), referencing Zhar Ptiza projects led by him as portfolio.

Submission: `contact@idscs.org.mk` with subject `Понуда за изработка на dashboard за парламентарни отворени податоци`.

---

## 0.1 Meeting outcomes — 14 May 2026 (CONFIRMED)

| Item | Decision |
|---|---|
| Budget | €4,000 gross / €3,600 net (tax included in gross) |
| Hosting & domain | IDSCS has **separate budget** — NOT included in our offer |
| License | **Open data confirmed** — no license restrictions on any dataset |
| Source code | **Public GitHub repo** from day one |
| Data refresh | **No live feed.** Manual or scheduled refresh 2–3× until March 2027 (roughly monthly or quarterly). Can be manual or GitHub Actions cron — TBD. |
| Brandbook | IDSCS designer will send brandbook — we adapt to it |
| Languages | **MK + ALB** (Macedonian + Albanian). English is NOT required. |
| Target audience | General public first; design must also be adoptable by the Sobranie |
| Post-project hosting | IDSCS will try to move to Sobranie website after project period |
| Reference project | `https://kancelarii.sobranie.mk/dashboard` — already hosted on sobranie.mk (same citizen-office data) |
| Post-launch support | Until **March 2027** (includes 2–3 data refreshes) |
| Pre-submission questions | Sent to aleksandra@idscs.org.mk 14 May ✓ |

---

## 1. Tender summary

### Scoring (max 100)
| Criterion | Points |
|---|---|
| Technical approach & methodology | **40** |
| Relevant experience | **25** |
| Financial offer | **25** |
| Timeline realism & support offered | **10** |

→ The technical-approach section is where the bid is won. We win by showing we've actually opened the data.

### Mandatory deliverables
1. Functional dashboard in test environment
2. Final version deployed online
3. Integration of at least the 3 named datasets
4. Interactive filters, search, visualisations
5. Data export / download
6. Technical documentation (structure, code, update process, maintenance)
7. Short user guide for IDSCS team
8. Testing support and corrections from feedback
9. Basic post-launch tech support (until March 2027 per meeting)

---

## 2. The data — confirmed findings from real data

### 2.1 Parliamentary Questions (`pratenicki_prasanja_2024-2028`)
- **657 records** | **590 answered (90%)** | **57 pending**
- **30 unique sessions** (session 18 through 101)
- **168 records** (26%) have `null SittingDate` — submitted, not yet assigned to session
- **5 "Одговорено"** with empty `ShortAnswer` — source data quality issue
- **91 null `ToInstitution`** — addressed to independent bodies (e.g. State Election Commission)
- Dates: `.NET /Date(ms)/` format — custom parser required
- Last portal update: **10 May 2026** (very fresh)
- License: **Open (confirmed)**

**Top institutions by volume:**
| Institution | Questions |
|---|---|
| Претседател на Владата | 110 |
| Животна средина и просторно планирање | 44 |
| Економија и труд | 41 |
| Образование и наука | 39 |
| Култура и туризам | 39 |

**Top MPs by questions:**
Сали Мурати (99), Халил Снопче (35), Јованка Тренчевска (28), Рина Ајдари (27), Бисера Костадиновска Стојчевска (21)

### 2.2 MyMP — `moj-pratenik-jan-juni-2025.xlsx`
- **133 MPs**, period **Jan–Jun 2025**, report #32
- **25 columns** in two groups: СЕДНИЦИ (plenary) + РАБОТНИ ТЕЛА (committees)
- Schema uses 3-row header with internal short codes — header-name parser required
- Last portal update: **November 2025** (stale — flag in UI)
- License: **CC0 / Open (confirmed)**

**Column map (code → meaning):**
| Code | Meaning |
|---|---|
| `pris` | Plenary sessions attended |
| `opr` | Excused absences |
| `unexcused` | Unexcused absences |
| `izla1–4` | Discussions, replies, procedural, committee discussions |
| `g11/g12` | Laws co-signed, amendments |
| `przak/aman` | Proposed laws, amendments (committee work) |
| `pras1` | Parliamentary questions asked |
| `kom1–3` | Committee member: count, sessions held, attendance |
| `kom11–33` | Committee deputy member: count, sessions held, attendance |

**Interesting data points:**
- Сали Мурати: 41 questions in H1 2025 alone (99 total in full term dataset)
- **81 of 133 MPs asked zero questions** in H1 2025
- Average plenary attendance: 46.4/56 sessions (82.8%)
- Max attendance: 56/56 (7 MPs with perfect attendance)

### 2.3 Канцеларии — `kancelarii.xlsx`
- **610 rows**, long/tidy format — clean and joinable
- **46 MPs** (not all 120 — only those with active contact offices), **7 parties**
- **8 statistical categories:** case type, age bracket, gender, ethnicity, totals, meetings, events, submitted initiatives
- MP UUID identifier present — reliable join key
- Last portal update: **January 2026**
- License: **Open (confirmed)**

**Top MPs by citizen cases:** Кире Божиновски (47), Биљана Кузманоска (46), Петар Ристески (46), Драган Ковачки (45)

**Case type breakdown (total across all MPs):**
Labor rights (183), Transport/infrastructure (104), Environment (64), Social services (59), Legal aid (52), Healthcare (45), Education (45)

**Party split:** ВМРО-ДПМНЕ dominates (577 of ~664 total cases) — all other parties combined: ~87

**Note:** The reference dashboard `https://kancelarii.sobranie.mk/dashboard` already covers this dataset in detail (see §3.1 below). Our dashboard must complement, not duplicate it. Importantly: **IDSCS themselves implemented that dashboard** (with NDI + Center for Change Management) — they know exactly what they want built next.

---

## 2.4 Reference dashboard — `kancelarii.sobranie.mk/dashboard` (confirmed from PDF)

**Built by:** IDSCS + NDI + Center for Change Management (for Sobranie). IDSCS is the client AND the implementer of this reference.

**Design language:** Navy header (#1a2e5a range) + teal/cyan accent charts. Clean white cards with shadows. MP profile photos. Institutional, government-compatible.

**Navigation tabs:** КАНЦЕЛАРИИ | ЗАКАЖИ СРЕДБА | СТАТИСТИКИ | ЗА ПРОЕКТОТ | КОНТАКТ. Language toggle: MK only currently.

**What it already shows (СТАТИСТИКИ page):**
- 4 KPI tiles: случаи (cases), средби (meetings), иницијативи, настани
- Ranked list of MPs by case volume (with photos)
- Bar chart: cases by age group
- Donut: cases by gender
- Bar chart: cases by ethnicity
- Icon grid: cases by topic area (транспорт, работен однос, социјални, правна помош, животна средина, здравство, образование, домување, финансии...)
- Line chart: cases over time (May 2025 – May 2026)
- Filter bar: by MP / by party / by mandate

**What it does NOT have:**
- Parliamentary questions module
- MyMP plenary/committee activity
- Cross-dataset MP profile (questions + activity + citizen cases combined)
- Albanian language
- Party-level comparison aggregates
- "Parliament vs. Citizens" narrative

→ **Our dashboard adds everything it's missing. We don't rebuild what exists.**

---

## 3. Cross-dataset join analysis

### Name normalization
Three different name formats across datasets:
- **Questions:** `"Сали Мурати"` (First Last, Cyrillic)
- **MyMP:** `"МУРАТИ САЛИ"` or `"АЗИЗИ АДНАН/AZIZI ADNAN"` (LAST FIRST, bilingual for Albanian MPs)
- **Канцеларии:** `"Александар Јамалов"` (First Last, Cyrillic) — also has UUID

### Join coverage
| Join | Match rate | Notes |
|---|---|---|
| Кancelarii ↔ Questions | 23/46 (50%) | 23 MPs with offices asked zero questions |
| Кancelarii ↔ MyMP | 43/46 (93%) | 3 compound surnames need fuzzy match |
| Questions ↔ MyMP | ~87% | Normalization handles most; Albanian names trickiest |

### Cross-reference features enabled
1. **MP Profile page** (killer feature): For any MP — questions asked, plenary attendance, committee work, citizen office cases, all on one screen
2. **"Active in parliament but silent on citizen issues"** — MPs with high attendance + questions but zero office cases
3. **"Citizen-first MPs"** — high office caseload but few parliamentary questions
4. **Party-level aggregates** — average activity metrics per party (available from Канцеларии)
5. **Topic correlation** — do MPs raise in parliament the same topics citizens bring to their offices? (e.g. labor rights = top citizen issue AND top question theme)
6. **Per-session question trends** — questions across sessions 18–101 over time

---

## 4. Technical architecture (updated post-meeting)

### Stack
**Frontend:** Astro + React islands + Tailwind CSS + Chart.js / Recharts
**Translations:** i18next or Astro i18n — MK + ALB (no English for launch)
**Data layer:** Static JSON in `/public/data/`, generated by Python ingestion script
**Ingestion:** Python (pandas + openpyxl + requests) — runs manually or via GitHub Actions cron
**Hosting:** To be handled by IDSCS (separate budget, eventual sobranie.mk migration)
**Repo:** Public GitHub, handed over to IDSCS

### Refresh model (confirmed post-meeting)
- No live API feed
- **2–3 data refreshes until March 2027** (roughly monthly or quarterly)
- Either manual (`python ingest.py` → commit → deploy) or GitHub Actions scheduled cron
- IDSCS/Sobranie staff can trigger it — document clearly in user guide

### Pipeline
```
Python ingestion (manual or cron)
    ├─ fetch CKAN package_show → detect new resources
    ├─ parse .NET dates, normalize MP names, dedupe
    ├─ join datasets by normalized MP name
    └─ write /public/data/*.json
Astro build → deploy to IDSCS hosting
```

### Design
- IDSCS brandbook incoming — adapt colors/typography to it
- Institutional, clean — must be adoptable by Sobranie (ref: `kancelarii.sobranie.mk/dashboard`)
- MK primary language, ALB parallel — all UI strings in both
- Mobile-first responsive
- WCAG 2.1 AA

---

## 5. Functionality scope

### MVP (committed)
1. Ingestion of 3 datasets with name normalization join
2. **Questions module:** charts by MP, by ministry, answered/pending, timeline by session, searchable table, click-through detail
3. **MyMP module:** MP activity cards, comparative charts, attendance metrics
4. **Канцеларии module:** Cases by MP, by category, by demographics — complements (not duplicates) `kancelarii.sobranie.mk/dashboard`
5. **MP Profile cross-view** — unified view per MP across all 3 datasets
6. Searchable/filterable tables throughout
7. CSV + JSON export of filtered views
8. MK + ALB full translation
9. Responsive + WCAG 2.1 AA basics
10. Methodology page (data quality notes, staleness dates, source links)
11. Open-source repo + docs handed over

### Differentiators (committed — win the 40 technical points)
12. **Cross-dataset MP profile** — questions + attendance + citizen cases on one screen
13. **"Parliament vs. Citizens" narrative** — do questions match what citizens bring to offices?
14. **Party comparison aggregates**
15. Compare 2020-2024 vs 2024-2028 terms for questions
16. Architecture documented for adding any of the other 26 Sobranie datasets
17. Embeddable chart snippets (iframe) for journalists

### Phase 2 / future (mentioned, not committed)
- English UI
- Email/RSS alerts for new questions by ministry
- Public API re-exposing cleaned data
- Annotated data stories

---

## 6. Timeline

| Week | Dates | Milestone |
|---|---|---|
| W1 | May 19–25 | Kick-off, repo + brandbook, ingestion + name normalization script, Astro shell |
| W2 | May 26–Jun 1 | Questions module complete (charts + table + filters) |
| W3 | Jun 2–8 | MyMP + Канцеларии modules; MP profile cross-view |
| W4 | Jun 9–15 | Map/location view; MK+ALB translations; export; accessibility audit |
| W5 | Jun 16–22 | Staging deploy, IDSCS review + feedback iteration |
| W6 | Jun 23–29 | Final corrections, docs, user guide, handover |
| Buffer | Jun 30 – Jul | Polish, public launch coordination |
| Support | Jul – Mar 2027 | 2–3 data refreshes + bug fixes |

---

## 7. Financial proposal

| Phase / item | EUR |
|---|---|
| Discovery, architecture, data audit | 400 |
| Ingestion pipeline (CKAN + XLSX + name join) | 700 |
| Frontend: Questions module | 700 |
| Frontend: MyMP module | 500 |
| Frontend: Канцеларии module | 400 |
| Cross-dataset MP profile view | 400 |
| MK+ALB translations | 200 |
| Accessibility, responsive, polish | 300 |
| Documentation + user guide | 200 |
| Testing, staging, handover | 200 |
| **Total gross** | **4,000** |
| **Net (after tax)** | **~3,600** |

Hosting: **€0 from this budget** — IDSCS covers separately.
Payment: 30% on signing / 40% on staging delivery / 30% on final acceptance.
Support period: until March 2027 (includes 2–3 data refreshes).

---

## 8. Portfolio — what we lead with

1. **IDSCS — FDI Dashboard** — same client, same problem class, recent. Reference letter from IDSCS President.
2. **PPTI — Political Party Transparency Index (IDEA SEE / WFD)** — Western Balkans political transparency, interactive comparative dashboard.
3. **BCSDN Monitoring Matrix** — static annual report → interactive dashboard.
4. **SOS Children's Village donation analytics** — internal dashboard tracking the full donation programme in North Macedonia: donors, donations, pledges, churn rate, trends, paid/unpaid, percentages — enabling the donations team to optimise revenue and make data-driven decisions.
5. **State Audit Office E-learning Platform (WFD)** — public-sector digital tool, full delivery lifecycle.

Role framing: **"Project Lead and Creative Director, delivered under Zhar Ptiza."**

---

## 9. Open items

- [x] SOS Children's Village case study — donation programme analytics (donors, churn, pledges, trends, paid/unpaid) for NMK team
- [x] Legal name: **Дарјан Раденковиќ**
- [ ] Tax/VAT declaration wording
- [ ] Bank details for payment schedule wording
- [ ] IDSCS brandbook (incoming from their designer)
- [ ] Reference dashboard `kancelarii.sobranie.mk/dashboard` — inspect design language for Sobranie-compatible aesthetic
- [ ] Confirm refresh cadence: monthly cron or manual trigger?

---

## 10. Workflow (agreed)

1. **Write proposal** → submit by 17 May
2. **Build demo/prototype** with proposed functionalities → send to IDSCS for feedback
3. **Iterate on feedback** → build live version
4. **Deploy** to IDSCS hosting → handover
5. **2–3 data refreshes** until March 2027

---

## 11. File map

```
/Users/darjan/Desktop/IDSCS MP/
├── PROJECT_BRIEF.md                              ← this file
├── README-2.md                                   ← quick-start for Claude Code
├── fetch_data.py                                 ← ingestion script
├── pratenicki_prasanja_2024-2028.sample.json     ← sample records
├── WFD - Bid for Communication Services.pdf      ← Zhar Ptiza proposal reference (style/structure)
└── raw/                                          ← downloaded live data
    ├── pratenicki_prasanja_2024-2028.json        ← 657 records
    ├── moj-pratenik-jan-juni-2025.xlsx           ← 133 MPs, Jan-Jun 2025
    └── kancelarii.xlsx                           ← 46 MPs, 610 rows, tidy format
```
