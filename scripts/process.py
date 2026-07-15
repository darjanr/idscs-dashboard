#!/usr/bin/env python3
"""
process.py — transforms raw downloaded datasets into clean JSON for the dashboard.

Single source of truth for "who is an MP" is the ACTIVE ASSEMBLY of 120 members,
fetched from kancelarii.sobranie.mk/api/mps where statusId == True. Every MP-level
output (mymp.json, mp_profiles.json) is scoped to those 120. The questions record is
kept complete (657) but each question is tagged with the matched MP and an active flag.

Input:  ../raw/*.json and ../raw/*.xlsx  (fetched by fetch_data.py)
Output: ../public/data/mps_active.json   (the canonical 120-MP roster)
        ../public/data/questions.json
        ../public/data/mymp.json
        ../public/data/kancelarii.json
        ../public/data/mp_profiles.json
        ../public/data/meta.json

Run:
    pip3 install pandas openpyxl rapidfuzz requests
    python3 scripts/process.py
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

KANCELARII_API = "https://kancelarii.sobranie.mk"
PHOTO_BASE = f"{KANCELARII_API}/uploads/mp-pictures/"
HEADERS = {"User-Agent": "idscs-dashboard/1.0"}

# ---------------------------------------------------------------------------
# Paths  — read raw from the repo's own raw/ folder (reproducible build)
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
PUBLIC_DATA = ROOT / "public" / "data"
PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Name normalisation + fuzzy matching
# ---------------------------------------------------------------------------

_DOTNET_RE = re.compile(r"^/Date\((\d+)\)/$")
_LATIN_RE = re.compile(r"[a-z]")

# Conservative punctuation folding only. Letter-level spelling variants
# (Таќи/Тачи, Биљана/Билјана, Јахоски/Јаховски) are handled by the explicit
# NAME_OVERRIDES table + a high-threshold fuzzy fallback, NOT by lossy letter
# folding — with only 120 names, aggressive folds risk collapsing two distinct
# MPs onto the same key.
_FOLD = [("-", " "), ("/", " ")]


def parse_dotnet_date(value: str | None) -> str | None:
    if not value:
        return None
    m = _DOTNET_RE.match(value)
    if not m:
        return None
    ms = int(m.group(1))
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def norm_name(name: str | None) -> str:
    """Aggressive, order-independent normalisation key for cross-dataset name joins.

    Lowercase, strip accents, fold Cyrillic digraphs, drop Latin transliteration
    tokens (Albanian names are stored as 'МУРАТИ САЛИ/MURATI SALI'), then sort the
    remaining tokens so 'LASTNAME FIRSTNAME' and 'Firstname Lastname' compare equal.
    """
    if not name:
        return ""
    s = str(name).strip().lower()
    nfkd = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in nfkd if not unicodedata.combining(c))
    for a, b in _FOLD:
        s = s.replace(a, b)
    toks = [t for t in s.split() if t and not _LATIN_RE.search(t)]
    return " ".join(sorted(toks))


# Manual overrides for residual hard cases (MyMP raw spelling -> roster MK fullName).
# Kept explicit + auditable; the build warns loudly if any active MP stays unmatched,
# so a future data refresh that breaks a match is caught rather than silently dropped.
NAME_OVERRIDES: dict[str, str] = {
    "ЕМЕИНИ АДИЛИ ВАЛБОНА /VALBONA ADILI EMINI": "Ваљбона Адили-Емини",
    "ЈАХОВСКИ ИСМАИЛ": "Исмаил Јахоски",
    "КУЗМАНОСКА БИЛЈАНА": "Биљана Кузманоска",
    "ТАЧИ МЕНДУХ/THAÇI MENDUH": "Мендух Таќи",
    "АЗИРИ ЕЉМИ/ AZIRI ELMI": "Елми Азири",
}


class RosterMatcher:
    """Resolves an arbitrary MP name string to an active-roster UUID."""

    def __init__(self, active: list[dict]):
        self.by_uuid = {m["uuid"]: m for m in active}
        self._keys: dict[str, str] = {}          # norm key -> uuid
        for m in active:
            for nm in (m["name"], m.get("nameAl"), m.get("nameEn")):
                k = norm_name(nm)
                if k:
                    self._keys.setdefault(k, m["uuid"])
        # Resolve overrides (roster fullName -> uuid) into norm-key shortcuts
        name_to_uuid = {m["name"]: m["uuid"] for m in active}
        self._override_uuid: dict[str, str] = {}
        for raw, full in NAME_OVERRIDES.items():
            uuid = name_to_uuid.get(full)
            if uuid:
                self._override_uuid[norm_name(raw)] = uuid

    def resolve(self, raw: str | None) -> str | None:
        """Deterministic: exact normalised key, then explicit override.

        No fuzzy fallback — with only 120 names, fuzzy produces real cross-person
        false positives (e.g. minister 'Николоски Александар' → 'Александра
        Николовска' at 88%). Genuine spelling variants go in NAME_OVERRIDES; the
        build warns on any unmatched row so new variants are caught explicitly.
        """
        if not raw:
            return None
        k = norm_name(raw)
        return self._override_uuid.get(k) or self._keys.get(k)


# ---------------------------------------------------------------------------
# 0. Active roster + party + office data from kancelarii.sobranie.mk API
# ---------------------------------------------------------------------------

def fetch_parties() -> dict[int, dict]:
    try:
        r = requests.get(f"{KANCELARII_API}/api/parties", headers=HEADERS, timeout=25)
        r.raise_for_status()
        out = {}
        for p in r.json():
            icon = p.get("iconPath") or ""
            out[p["id"]] = {
                "name": (p.get("name") or "").strip(),
                "logo": f"{KANCELARII_API}/{icon}" if icon else None,
            }
        return out
    except Exception as e:
        print(f"  ! Could not fetch parties: {e}")
        return {}


def fetch_active_roster(parties: dict[int, dict]) -> list[dict]:
    """The canonical active assembly — statusId == True (120 members)."""
    r = requests.get(f"{KANCELARII_API}/api/mps", headers=HEADERS, timeout=25)
    r.raise_for_status()
    roster = []
    for m in r.json():
        if not m.get("statusId"):
            continue  # inactive / replaced — not part of the active assembly
        uuid = (m.get("parliamentUserId") or "").lower()
        if not uuid:
            continue
        pic = m.get("picturePath") or ""
        party = parties.get(m.get("partyId") or -1, {})
        roster.append({
            "uuid": uuid,
            "id": m.get("id"),
            "name": (m.get("fullName") or "").strip(),
            "nameAl": (m.get("fullNameAl") or "").strip() or None,
            "nameEn": (m.get("fullNameEn") or "").strip() or None,
            "party": party.get("name") or "",
            "partyLogo": party.get("logo"),
            "photo": f"{PHOTO_BASE}{pic.split('/')[-1]}" if pic else None,
            "officeId": m.get("officeId"),
        })
    return roster


MEDIA_DIR = ROOT / "public" / "mp-media"
_media_cache: dict[str, str | None] = {}


def localize_media(url: str | None, kind: str) -> str | None:
    """Download an external image into public/mp-media/<kind>/ and return its
    local path, so images are same-origin (needed for PNG chart export, faster
    loads, and a tighter CSP). Results are cached by URL within a run."""
    if not url:
        return None
    if url in _media_cache:
        return _media_cache[url]
    fname = url.split("/")[-1].split("?")[0]
    fname = re.sub(r"[^A-Za-z0-9._-]", "_", fname) or "img"
    dest_dir = MEDIA_DIR / kind
    dest = dest_dir / fname
    local = f"/mp-media/{kind}/{fname}"
    try:
        if not dest.exists():
            r = requests.get(url, headers=HEADERS, timeout=25)
            r.raise_for_status()
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(r.content)
        _media_cache[url] = local
    except Exception as e:
        print(f"  ! photo fetch failed ({url}): {e}")
        _media_cache[url] = url  # fall back to the remote URL
    return _media_cache[url]


def localize_roster_media(roster: list[dict]) -> None:
    """Rewrite roster photo + party-logo URLs to local copies (downloads them)."""
    for m in roster:
        m["photo"] = localize_media(m.get("photo"), "photos")
        m["partyLogo"] = localize_media(m.get("partyLogo"), "party-logos")


def fetch_office_coordinates() -> list[dict]:
    try:
        r = requests.get(f"{KANCELARII_API}/api/offices", headers=HEADERS, timeout=25)
        r.raise_for_status()
        out = []
        for o in r.json():
            coords = (o.get("coordinates") or "").strip()
            if coords and "," in coords:
                try:
                    lat, lon = (float(x.strip()) for x in coords.split(",")[:2])
                    out.append({"id": o["id"], "address": (o.get("address") or "").strip(),
                                "lat": lat, "lon": lon})
                except ValueError:
                    pass
        return out
    except Exception as e:
        print(f"  ! Could not fetch office coordinates: {e}")
        return []


# ---------------------------------------------------------------------------
# 1. Questions
# ---------------------------------------------------------------------------

def process_questions() -> list[dict]:
    with open(RAW / "pratenicki_prasanja_2024-2028.json", encoding="utf-8") as f:
        raw = json.load(f)

    def _norm_qa(s: str) -> str:
        # Collapse whitespace, drop trailing punctuation and fold case so
        # near-identical copies match (e.g. answer ends with '.' where the
        # question ends with '?', or repeats the question with a lowercased
        # first letter — both are the source pasting the question back).
        s = re.sub(r"\s+", " ", s or "").strip().casefold()
        return re.sub(r"[\s\.\?\!,;:]+$", "", s)

    records = []
    for r in raw:
        answer = r.get("ShortAnswer", "").strip()
        question = r.get("ShortQuestion", "").strip()
        # An answer is a "copy" when it merely repeats the question text (the
        # source marks the question answered but pastes the question back).
        answer_is_copy = bool(answer) and _norm_qa(answer) == _norm_qa(question)
        records.append({
            "id": r["Id"],
            "date": parse_dotnet_date(r.get("SittingDate")),
            "session": r.get("SittingNumber"),
            "fromMP": r.get("FromMP", "").strip(),
            "toInstitution": (r.get("ToInstitution") or "").strip() or None,
            "toUser": (r.get("ToUser") or "").strip() or None,
            "question": question,
            "status": r.get("Status", "").strip(),
            "answer": "" if answer_is_copy else answer,
            "answerIsCopy": answer_is_copy,
        })

    records.sort(key=lambda r: (r["date"] is not None, r["date"] or "", r["session"] or 0), reverse=True)
    return records


# ---------------------------------------------------------------------------
# 2. MyMP  — parse by header CODE name, never absolute column index
# ---------------------------------------------------------------------------

# Row 4 of the sheet holds short internal codes. Map each code to a metric.
MYMP_CODE_METRIC = {
    "pris": "attendance",
    "opr": "excused",
    # unexcused has a blank/numeric header (literally 0); located as the column
    # immediately after 'opr' (see locate_unexcused_col).
    "izla1": "discussions",
    "izla2": "replies",
    "izla3": "procedural",
    "izla4": "committeeDiscussions",
    "g11": "laws",
    "g12": "amendments",
    "przak": "proposedLaws",
    "aman": "amendments2",
    "pras1": "questions",
    "kom1": "committeesAsMember",
    "kom2": "sessionsHeldMember",
    "kom3": "attendanceMember",
    "kom11": "committeesAsDeputy",
    "kom22": "sessionsHeldDeputy",
    "kom33": "attendanceDeputy",
}
NAME_CODE = "Презиме и Име"


def process_mymp(matcher: RosterMatcher) -> dict[str, dict]:
    """Returns {roster_uuid -> activity dict} for matched active MPs.

    Logs any MyMP row that fails to match the active roster (expected: the frozen
    ministers + departed/replaced members, which are intentionally excluded).
    """
    path = RAW / "moj-pratenik-jan-juni-2025.xlsx"
    df = pd.read_excel(path, header=3, sheet_name="IE 1")
    cols = list(df.columns)

    if NAME_CODE not in cols:
        raise RuntimeError(f"MyMP: expected header '{NAME_CODE}' not found — sheet layout changed.")
    # Locate the unexcused column by name-anchor (column right after 'opr').
    unexcused_col = cols[cols.index("opr") + 1] if "opr" in cols else None

    df = df[df[NAME_CODE].notna() & (df[NAME_CODE] != NAME_CODE)].copy()

    def iv(row, col) -> int:
        if col is None or col not in row:
            return 0
        v = row[col]
        try:
            return int(v) if pd.notna(v) else 0
        except (ValueError, TypeError):
            return 0

    by_uuid: dict[str, dict] = {}
    unmatched: list[str] = []
    for _, row in df.iterrows():
        raw_name = str(row[NAME_CODE]).strip()
        uuid = matcher.resolve(raw_name)
        if not uuid:
            unmatched.append(raw_name)
            continue

        metrics = {metric: iv(row, code) for code, metric in MYMP_CODE_METRIC.items()
                   if code in cols}
        rec = {
            "nameRaw": raw_name,
            "attendance": metrics.get("attendance", 0),
            "excused": metrics.get("excused", 0),
            "unexcused": iv(row, unexcused_col),
            "discussions": metrics.get("discussions", 0),
            "replies": metrics.get("replies", 0),
            "procedural": metrics.get("procedural", 0),
            "committeeDiscussions": metrics.get("committeeDiscussions", 0),
            "laws": metrics.get("laws", 0),
            "amendments": metrics.get("amendments", 0) + metrics.get("amendments2", 0),
            "proposedLaws": metrics.get("proposedLaws", 0),
            "questions": metrics.get("questions", 0),
            "committeesAsMember": metrics.get("committeesAsMember", 0),
            "sessionsHeldMember": metrics.get("sessionsHeldMember", 0),
            "attendanceMember": metrics.get("attendanceMember", 0),
            "committeesAsDeputy": metrics.get("committeesAsDeputy", 0),
            "sessionsHeldDeputy": metrics.get("sessionsHeldDeputy", 0),
            "attendanceDeputy": metrics.get("attendanceDeputy", 0),
        }
        by_uuid[uuid] = rec

    if unmatched:
        print(f"    · {len(unmatched)} MyMP rows excluded (not in active assembly): "
              + ", ".join(sorted(unmatched)))
    return by_uuid


# ---------------------------------------------------------------------------
# 3. Канцеларии  — joined to roster by UUID (Идентификатор на пратеник)
# ---------------------------------------------------------------------------

def process_kancelarii(matcher: RosterMatcher) -> tuple[list[dict], dict[str, dict]]:
    """Returns (flat records, {roster_uuid -> summary})."""
    df = pd.read_excel(RAW / "kancelarii.xlsx")
    df.columns = ["mp_id", "mp_name", "party", "mandate", "category", "subcategory", "total"]

    records = []
    summaries: dict[str, dict] = {}
    for _, row in df.iterrows():
        mp_uuid = str(row["mp_id"]).strip().lower()
        name = str(row["mp_name"]).strip()
        val = int(row["total"]) if pd.notna(row["total"]) else 0
        cat = str(row["category"]).strip()
        sub = str(row["subcategory"]).strip()

        # Prefer the canonical roster name where the UUID is active.
        roster = matcher.by_uuid.get(mp_uuid)
        display_name = roster["name"] if roster else name

        records.append({
            "mpId": mp_uuid,
            "mpName": display_name,
            "mpActive": roster is not None,
            "party": str(row["party"]).strip(),
            "mandate": str(row["mandate"]).strip(),
            "category": cat,
            "subcategory": sub,
            "total": val,
        })

        s = summaries.setdefault(mp_uuid, {
            "mpId": mp_uuid, "mpName": display_name,
            "party": str(row["party"]).strip(),
            "totalCases": 0, "totalMeetings": 0, "totalEvents": 0,
            "totalInitiatives": 0, "casesByType": {},
        })
        if sub == "casesAll":
            s["totalCases"] += val
        elif sub == "meetingsAll":
            s["totalMeetings"] += val
        elif sub == "eventsAll":
            s["totalEvents"] += val
        elif cat == "submittedInitiatives":
            s["totalInitiatives"] += val
        elif cat == "cases by case category":
            s["casesByType"][sub] = s["casesByType"].get(sub, 0) + val

    return records, summaries


# ---------------------------------------------------------------------------
# 4. MP Profiles  — roster-driven (exactly the active 120)
# ---------------------------------------------------------------------------

def _top_institutions(questions: list[dict], n: int = 5) -> list[dict]:
    counts: dict[str, int] = {}
    for q in questions:
        inst = q["toInstitution"] or "Независно тело"
        counts[inst] = counts.get(inst, 0) + 1
    return [{"institution": k, "count": v}
            for k, v in sorted(counts.items(), key=lambda x: -x[1])[:n]]


def build_profiles(
    roster: list[dict],
    questions_by_uuid: dict[str, list[dict]],
    mymp_by_uuid: dict[str, dict],
    kancelarii_by_uuid: dict[str, dict],
) -> list[dict]:
    profiles = []
    for m in sorted(roster, key=lambda r: r["name"]):
        uuid = m["uuid"]
        qs = questions_by_uuid.get(uuid, [])
        mymp = mymp_by_uuid.get(uuid)
        office = kancelarii_by_uuid.get(uuid)
        profiles.append({
            "uuid": uuid,
            "name": m["name"],
            "nameAl": m.get("nameAl"),
            "party": m["party"],
            "partyLogo": m["partyLogo"],
            "photo": m["photo"],
            "questions": {
                "total": len(qs),
                "answered": sum(1 for q in qs if q["status"] == "Одговорено"),
                "topInstitutions": _top_institutions(qs),
                "recentQuestions": [
                    {"id": q["id"], "date": q["date"], "question": q["question"],
                     "toInstitution": q["toInstitution"], "status": q["status"]}
                    for q in qs[:5]
                ],
            },
            "activity": {
                "attendance": mymp["attendance"],
                "excused": mymp["excused"],
                "unexcused": mymp["unexcused"],
                "discussions": mymp["discussions"],
                "proposedLaws": mymp["proposedLaws"],
                "amendments": mymp["amendments"],
                "committeesAsMember": mymp["committeesAsMember"],
                "attendanceMember": mymp["attendanceMember"],
                "period": "Jan–Jun 2025",
            } if mymp else None,
            "office": {
                "totalCases": office["totalCases"],
                "totalMeetings": office["totalMeetings"],
                "totalEvents": office["totalEvents"],
                "totalInitiatives": office["totalInitiatives"],
                "casesByType": office["casesByType"],
            } if office else None,
        })
    return profiles


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("Fetching party data...")
    parties = fetch_parties()
    print(f"  ✓ {len(parties)} parties")

    print("Fetching ACTIVE assembly roster (statusId=True)...")
    roster = fetch_active_roster(parties)
    if len(roster) != 120:
        print(f"  ! WARNING: active roster has {len(roster)} members, expected 120.")
    print(f"  ✓ {len(roster)} active MPs")
    print("Downloading MP photos + party logos (local copies)...")
    localize_roster_media(roster)
    print(f"  ✓ media cached → public/mp-media/")
    (PUBLIC_DATA / "mps_active.json").write_text(
        json.dumps(roster, ensure_ascii=False, indent=2), encoding="utf-8")
    matcher = RosterMatcher(roster)

    print("Fetching office coordinates...")
    coords = fetch_office_coordinates()
    print(f"  ✓ {len(coords)} offices with coordinates")
    (PUBLIC_DATA / "office_coords.json").write_text(
        json.dumps(coords, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Processing questions...")
    questions = process_questions()
    # Tag each question with the matched active-MP uuid (or None)
    questions_by_uuid: dict[str, list[dict]] = {}
    matched_q = 0
    for q in questions:
        uuid = matcher.resolve(q["fromMP"])
        q["mpId"] = uuid
        q["mpActive"] = uuid is not None
        if uuid:
            prof = matcher.by_uuid[uuid]
            q["party"] = prof["party"]
            q["partyLogo"] = prof["partyLogo"]
            q["mpPhoto"] = prof["photo"]
            questions_by_uuid.setdefault(uuid, []).append(q)
            matched_q += 1
        else:
            q["party"] = ""
            q["partyLogo"] = None
            q["mpPhoto"] = None
    (PUBLIC_DATA / "questions.json").write_text(
        json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  ✓ {len(questions)} questions ({matched_q} from active MPs) → questions.json")

    print("Processing MyMP (Jan–Jun 2025 activity)...")
    mymp_by_uuid = process_mymp(matcher)
    # Roster-driven: one row per active MP, hasData=False for newly-seated members.
    mymp_records = []
    EMPTY = {k: 0 for k in (
        "attendance", "excused", "unexcused", "discussions", "replies", "procedural",
        "committeeDiscussions", "laws", "amendments", "proposedLaws", "questions",
        "committeesAsMember", "sessionsHeldMember", "attendanceMember",
        "committeesAsDeputy", "sessionsHeldDeputy", "attendanceDeputy")}
    for m in sorted(roster, key=lambda r: r["name"]):
        act = mymp_by_uuid.get(m["uuid"])
        rec = {"uuid": m["uuid"], "name": m["name"], "party": m["party"],
               "photo": m["photo"], "hasData": act is not None}
        rec.update(act if act else EMPTY)
        rec.pop("nameRaw", None)
        mymp_records.append(rec)
    with_data = sum(1 for r in mymp_records if r["hasData"])
    (PUBLIC_DATA / "mymp.json").write_text(
        json.dumps(mymp_records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  ✓ {len(mymp_records)} MPs ({with_data} with period data) → mymp.json")

    print("Processing Канцеларии...")
    kancelarii_records, kancelarii_by_uuid = process_kancelarii(matcher)
    (PUBLIC_DATA / "kancelarii.json").write_text(
        json.dumps(kancelarii_records, ensure_ascii=False, indent=2), encoding="utf-8")
    active_offices = sum(1 for s in kancelarii_by_uuid.values()
                         if s["mpId"] in matcher.by_uuid)
    print(f"  ✓ {len(kancelarii_records)} rows, {len(kancelarii_by_uuid)} MPs "
          f"({active_offices} active) → kancelarii.json")

    print("Building MP profiles (active 120)...")
    profiles = build_profiles(roster, questions_by_uuid, mymp_by_uuid, kancelarii_by_uuid)
    (PUBLIC_DATA / "mp_profiles.json").write_text(
        json.dumps(profiles, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  ✓ {len(profiles)} profiles → mp_profiles.json")

    meta = {
        "lastProcessed": datetime.now(tz=timezone.utc).isoformat(),
        "activeAssembly": len(roster),
        "sources": {
            # Questions are refreshed on the portal daily, so the "last update"
            # is effectively the day we last pulled them.
            "questions": {"lastPortalUpdate": datetime.now(timezone.utc).date().isoformat(), "records": len(questions)},
            "mymp": {"lastPortalUpdate": "2025-11-11", "records": with_data,
                     "period": "Jan–Jun 2025"},
            "kancelarii": {"lastPortalUpdate": "2026-01-08", "records": len(kancelarii_records)},
        },
    }
    (PUBLIC_DATA / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("  ✓ meta.json\n\nDone.")


if __name__ == "__main__":
    main()
