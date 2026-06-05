#!/usr/bin/env python3
"""
process.py — transforms raw downloaded datasets into clean JSON for the dashboard.

Input:  ../raw/*.json and ../raw/*.xlsx  (fetched by fetch_data.py in the planning folder)
Output: ../public/data/questions.json
        ../public/data/mymp.json
        ../public/data/kancelarii.json
        ../public/data/mp_profiles.json
        ../public/data/meta.json

Run:
    pip3 install pandas openpyxl rapidfuzz
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
from rapidfuzz import process as fuzz_process, fuzz

KANCELARII_API = "https://kancelarii.sobranie.mk"
PHOTO_BASE = f"{KANCELARII_API}/uploads/mp-pictures/"
HEADERS = {"User-Agent": "idscs-dashboard/1.0"}

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT.parent / "IDSCS MP" / "raw"   # sibling planning folder has the raw data
PUBLIC_DATA = ROOT / "public" / "data"
PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DOTNET_RE = re.compile(r"^/Date\((\d+)\)/$")


def parse_dotnet_date(value: str | None) -> str | None:
    if not value:
        return None
    m = _DOTNET_RE.match(value)
    if not m:
        return None
    ms = int(m.group(1))
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def normalise_name(name: str) -> str:
    """Lowercase + strip accents for fuzzy comparison."""
    name = name.strip()
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def mymp_raw_to_firstname_last(raw: str) -> str:
    """
    'МУРАТИ САЛИ/MURATI SALI' -> 'Сали Мурати'
    'АНГЕЛЕВСКА СИЛВАНА'       -> 'Силвана Ангелевска'
    """
    mk_part = raw.split("/")[0].strip()
    parts = mk_part.split()
    if len(parts) >= 2:
        # LASTNAME FIRSTNAME... -> Firstname... Lastname
        return " ".join(p.capitalize() for p in parts[1:]) + " " + parts[0].capitalize()
    return mk_part.capitalize()


def build_name_index(names: list[str]) -> dict[str, str]:
    """Return {normalised -> original} for fast lookup."""
    return {normalise_name(n): n for n in names}


def fuzzy_match(query: str, index: dict[str, str], threshold: int = 82) -> str | None:
    norm_query = normalise_name(query)
    if norm_query in index:
        return index[norm_query]
    result = fuzz_process.extractOne(
        norm_query, list(index.keys()), scorer=fuzz.token_sort_ratio
    )
    if result and result[1] >= threshold:
        return index[result[0]]
    return None


# ---------------------------------------------------------------------------
# 0. Fetch MP photos + office coordinates from kancelarii.sobranie.mk API
# ---------------------------------------------------------------------------

def fetch_parties() -> dict[int, dict]:
    """Returns {party_id -> {name, logo_url}}"""
    try:
        r = requests.get(f"{KANCELARII_API}/api/parties", headers=HEADERS, timeout=20)
        r.raise_for_status()
        data = r.json()
        result = {}
        for party in data:
            icon_path = party.get("iconPath") or ""
            result[party["id"]] = {
                "name": (party.get("name") or "").strip(),
                "logo": f"{KANCELARII_API}/{icon_path}" if icon_path else None,
            }
        return result
    except Exception as e:
        print(f"  ! Could not fetch parties: {e}")
        return {}


def fetch_mp_data(party_index: dict[int, dict]) -> tuple[dict[str, str], dict[str, str], dict[str, str | None]]:
    """Returns ({name -> photo_url}, {name -> party_name}, {name -> party_logo_url})"""
    try:
        r = requests.get(f"{KANCELARII_API}/api/mps", headers=HEADERS, timeout=20)
        r.raise_for_status()
        data = r.json()
        photos: dict[str, str] = {}
        party_names: dict[str, str] = {}
        party_logos: dict[str, str | None] = {}
        for mp in data:
            name = (mp.get("fullName") or "").strip()
            if not name:
                continue
            pic = mp.get("picturePath") or ""
            if pic:
                photos[name] = f"{PHOTO_BASE}{pic.split('/')[-1]}"
            party_id = mp.get("partyId")
            if party_id and party_id in party_index:
                party_names[name] = party_index[party_id]["name"]
                party_logos[name] = party_index[party_id]["logo"]
        return photos, party_names, party_logos
    except Exception as e:
        print(f"  ! Could not fetch MP data: {e}")
        return {}, {}, {}


def fetch_office_coordinates() -> list[dict]:
    """Returns list of {id, address, lat, lon}"""
    try:
        r = requests.get(f"{KANCELARII_API}/api/offices", headers=HEADERS, timeout=20)
        r.raise_for_status()
        data = r.json()
        result = []
        for office in data:
            coords = (office.get("coordinates") or "").strip()
            if coords and "," in coords:
                parts = coords.split(",")
                try:
                    lat, lon = float(parts[0].strip()), float(parts[1].strip())
                    result.append({
                        "id": office["id"],
                        "address": (office.get("address") or "").strip(),
                        "lat": lat,
                        "lon": lon,
                    })
                except ValueError:
                    pass
        return result
    except Exception as e:
        print(f"  ! Could not fetch office coordinates: {e}")
        return []


# ---------------------------------------------------------------------------
# 1. Questions
# ---------------------------------------------------------------------------

def process_questions() -> list[dict]:
    path = RAW / "pratenicki_prasanja_2024-2028.json"
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    records = []
    for r in raw:
        date_str = parse_dotnet_date(r.get("SittingDate"))
        answer = r.get("ShortAnswer", "").strip()
        question = r.get("ShortQuestion", "").strip()
        # Flag answer copies (data quality issue at source)
        answer_is_copy = answer == question and bool(answer)

        records.append({
            "id": r["Id"],
            "date": date_str,
            "session": r.get("SittingNumber"),
            "fromMP": r.get("FromMP", "").strip(),
            "toInstitution": (r.get("ToInstitution") or "").strip() or None,
            "toUser": (r.get("ToUser") or "").strip() or None,
            "question": question,
            "status": r.get("Status", "").strip(),
            "answer": "" if answer_is_copy else answer,
            "answerIsCopy": answer_is_copy,
        })

    # Sort by date desc, nulls last
    records.sort(key=lambda r: (r["date"] is not None, r["date"] or "", r["session"] or 0), reverse=True)
    return records


# ---------------------------------------------------------------------------
# 2. MyMP
# ---------------------------------------------------------------------------

MYMP_COLS = {
    0:  "mp_name_raw",
    1:  "ie",
    2:  "attendance",
    3:  "excused",
    4:  "unexcused",
    5:  "discussions",
    6:  "replies",
    7:  "procedural",
    8:  "committee_discussions",
    9:  "laws",
    10: "amendments",
    11: "col11",
    12: "col12",
    13: "proposed_laws",
    14: "amendments2",
    15: "questions",
    16: "committees_member",
    17: "sessions_held_member",
    18: "attendance_member",
    19: "committees_deputy",
    20: "sessions_held_deputy",
    21: "attendance_deputy",
    22: "mandate",
    23: "photo",
    24: "full_name",
}


def process_mymp() -> tuple[list[dict], dict[str, str]]:
    """Returns (records, {normalised_name -> canonical_firstname_last})"""
    path = RAW / "moj-pratenik-jan-juni-2025.xlsx"
    df = pd.read_excel(path, header=3, sheet_name="IE 1").iloc[:, :25]
    df.columns = list(MYMP_COLS.values())
    df = df[df["mp_name_raw"].notna() & (df["mp_name_raw"] != "Презиме и Име")].copy()

    records = []
    name_index: dict[str, str] = {}

    for _, row in df.iterrows():
        raw_name = str(row["mp_name_raw"]).strip()
        canonical = mymp_raw_to_firstname_last(raw_name)
        name_index[normalise_name(canonical)] = canonical

        def iv(col: str) -> int:
            v = row.get(col)
            try:
                return int(v) if pd.notna(v) else 0
            except (ValueError, TypeError):
                return 0

        records.append({
            "name": canonical,
            "nameRaw": raw_name,
            "attendance": iv("attendance"),
            "excused": iv("excused"),
            "unexcused": iv("unexcused"),
            "discussions": iv("discussions"),
            "replies": iv("replies"),
            "procedural": iv("procedural"),
            "committeeDiscussions": iv("committee_discussions"),
            "laws": iv("laws"),
            "amendments": iv("amendments") + iv("amendments2"),
            "proposedLaws": iv("proposed_laws"),
            "questions": iv("questions"),
            "committeesAsMember": iv("committees_member"),
            "sessionsHeldMember": iv("sessions_held_member"),
            "attendanceMember": iv("attendance_member"),
            "committeesAsDeputy": iv("committees_deputy"),
            "sessionsHeldDeputy": iv("sessions_held_deputy"),
            "attendanceDeputy": iv("attendance_deputy"),
        })

    records.sort(key=lambda r: r["name"])
    return records, name_index


# ---------------------------------------------------------------------------
# 3. Канцеларии
# ---------------------------------------------------------------------------

def process_kancelarii() -> tuple[list[dict], dict[str, dict]]:
    """Returns (flat records for charts, {canonical_name -> summary dict})"""
    path = RAW / "kancelarii.xlsx"
    df = pd.read_excel(path)

    # Rename columns to English keys
    df.columns = ["mp_id", "mp_name", "party", "mandate", "category", "subcategory", "total"]

    records = []
    mp_summaries: dict[str, dict] = {}

    for _, row in df.iterrows():
        name = str(row["mp_name"]).strip()
        records.append({
            "mpId": str(row["mp_id"]).strip(),
            "mpName": name,
            "party": str(row["party"]).strip(),
            "mandate": str(row["mandate"]).strip(),
            "category": str(row["category"]).strip(),
            "subcategory": str(row["subcategory"]).strip(),
            "total": int(row["total"]) if pd.notna(row["total"]) else 0,
        })

        # Build per-MP summary for profile join
        if name not in mp_summaries:
            mp_summaries[name] = {
                "mpId": str(row["mp_id"]).strip(),
                "mpName": name,
                "party": str(row["party"]).strip(),
                "totalCases": 0,
                "totalMeetings": 0,
                "totalEvents": 0,
                "totalInitiatives": 0,
                "casesByType": {},
            }
        s = mp_summaries[name]
        sub = str(row["subcategory"]).strip()
        cat = str(row["category"]).strip()
        val = int(row["total"]) if pd.notna(row["total"]) else 0

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

    return records, mp_summaries


# ---------------------------------------------------------------------------
# 4. MP Profiles (cross-dataset join)
# ---------------------------------------------------------------------------

def build_profiles(
    questions: list[dict],
    mymp_records: list[dict],
    mymp_name_index: dict[str, str],
    kancelarii_summaries: dict[str, dict],
    photo_index: dict[str, str],
    api_party_names: dict[str, str],
    api_party_logos: dict[str, str | None],
) -> list[dict]:

    # Index questions by MP name
    q_by_mp: dict[str, list[dict]] = {}
    for q in questions:
        mp = q["fromMP"]
        q_by_mp.setdefault(mp, []).append(q)

    # All unique MP names across all 3 datasets
    all_names: set[str] = set()
    all_names.update(mymp_name_index.values())
    all_names.update(kancelarii_summaries.keys())
    all_names.update(q["fromMP"] for q in questions)

    # Build name indexes for fuzzy join
    k_index = build_name_index(list(kancelarii_summaries.keys()))
    photo_norm_index = build_name_index(list(photo_index.keys()))
    api_party_norm_index = build_name_index(list(api_party_names.keys()))
    mymp_by_name = {r["name"]: r for r in mymp_records}

    profiles = []
    for name in sorted(all_names):
        # Join MyMP
        mymp = mymp_by_name.get(name)
        if not mymp:
            matched = fuzzy_match(name, mymp_name_index)
            if matched:
                mymp = mymp_by_name.get(matched)

        # Join Канцеларии
        office = kancelarii_summaries.get(name)
        if not office:
            matched_k = fuzzy_match(name, k_index)
            if matched_k:
                office = kancelarii_summaries.get(matched_k)

        # Join Questions (direct name match first, then fuzzy)
        q_index = build_name_index(list(q_by_mp.keys()))
        questions_for_mp = q_by_mp.get(name, [])
        if not questions_for_mp:
            matched_q = fuzzy_match(name, q_index)
            if matched_q:
                questions_for_mp = q_by_mp.get(matched_q, [])

        # Party — prefer API party data (full 127 MPs), fall back to kancelarii xlsx
        party_name_from_api = api_party_names.get(name)
        party_logo_from_api: str | None = None
        if not party_name_from_api:
            matched_api = fuzzy_match(name, api_party_norm_index, threshold=88)
            if matched_api:
                party_name_from_api = api_party_names.get(matched_api)
                party_logo_from_api = api_party_logos.get(matched_api)
        else:
            party_logo_from_api = api_party_logos.get(name)
        party = party_name_from_api or (office or {}).get("party") or ""
        party_logo = party_logo_from_api

        # Photo lookup — try direct, then fuzzy
        photo = photo_index.get(name)
        if not photo:
            matched_photo = fuzzy_match(name, photo_norm_index, threshold=88)
            if matched_photo:
                photo = photo_index.get(matched_photo)

        profiles.append({
            "name": name,
            "party": party,
            "partyLogo": party_logo,
            "photo": photo,
            "questions": {
                "total": len(questions_for_mp),
                "answered": sum(1 for q in questions_for_mp if q["status"] == "Одговорено"),
                "topInstitutions": _top_institutions(questions_for_mp),
                "recentQuestions": [
                    {"id": q["id"], "date": q["date"], "question": q["question"],
                     "toInstitution": q["toInstitution"], "status": q["status"]}
                    for q in questions_for_mp[:5]
                ],
            },
            "activity": {
                "attendance": mymp["attendance"] if mymp else None,
                "excused": mymp["excused"] if mymp else None,
                "unexcused": mymp["unexcused"] if mymp else None,
                "discussions": mymp["discussions"] if mymp else None,
                "proposedLaws": mymp["proposedLaws"] if mymp else None,
                "amendments": mymp["amendments"] if mymp else None,
                "committeesAsMember": mymp["committeesAsMember"] if mymp else None,
                "attendanceMember": mymp["attendanceMember"] if mymp else None,
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


def _top_institutions(questions: list[dict], n: int = 5) -> list[dict]:
    counts: dict[str, int] = {}
    for q in questions:
        inst = q["toInstitution"] or "Независно тело"
        counts[inst] = counts.get(inst, 0) + 1
    return [{"institution": k, "count": v}
            for k, v in sorted(counts.items(), key=lambda x: -x[1])[:n]]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("Fetching party data from kancelarii.sobranie.mk...")
    party_index = fetch_parties()
    print(f"  ✓ {len(party_index)} parties found")

    print("Fetching MP data (photos + party assignments)...")
    photo_index, api_party_names, api_party_logos = fetch_mp_data(party_index)
    print(f"  ✓ {len(photo_index)} photos, {len(api_party_names)} MPs with party")

    print("Fetching office coordinates...")
    office_coords = fetch_office_coordinates()
    print(f"  ✓ {len(office_coords)} offices with coordinates")
    (PUBLIC_DATA / "office_coords.json").write_text(
        json.dumps(office_coords, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("Processing questions...")
    questions = process_questions()
    (PUBLIC_DATA / "questions.json").write_text(
        json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  ✓ {len(questions)} records → public/data/questions.json")

    print("Processing MyMP...")
    mymp_records, mymp_name_index = process_mymp()
    # Attach photos + party from API
    photo_norm = build_name_index(list(photo_index.keys()))
    api_party_norm = build_name_index(list(api_party_names.keys()))
    for rec in mymp_records:
        photo = photo_index.get(rec["name"]) or (
            photo_index.get(fuzzy_match(rec["name"], photo_norm, threshold=88) or "")
        )
        rec["photo"] = photo
        matched_party = fuzzy_match(rec["name"], api_party_norm, threshold=88)
        rec["party"] = api_party_names.get(matched_party or "") or ""
        rec["partyLogo"] = api_party_logos.get(matched_party or "") if matched_party else None
    (PUBLIC_DATA / "mymp.json").write_text(
        json.dumps(mymp_records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  ✓ {len(mymp_records)} MPs → public/data/mymp.json")

    print("Processing Канцеларии...")
    kancelarii_records, kancelarii_summaries = process_kancelarii()
    (PUBLIC_DATA / "kancelarii.json").write_text(
        json.dumps(kancelarii_records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  ✓ {len(kancelarii_records)} rows, {len(kancelarii_summaries)} MPs → public/data/kancelarii.json")

    print("Building MP profiles...")
    profiles = build_profiles(questions, mymp_records, mymp_name_index, kancelarii_summaries, photo_index, api_party_names, api_party_logos)
    (PUBLIC_DATA / "mp_profiles.json").write_text(
        json.dumps(profiles, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  ✓ {len(profiles)} profiles → public/data/mp_profiles.json")

    print("Annotating questions with party, partyLogo and photo...")
    profile_by_name = {p["name"]: p for p in profiles}
    prof_name_index = build_name_index(list(profile_by_name.keys()))
    matched_count = 0
    for q in questions:
        matched = fuzzy_match(q["fromMP"], prof_name_index, threshold=80)
        if matched and matched in profile_by_name:
            prof = profile_by_name[matched]
            q["party"] = prof.get("party") or ""
            q["partyLogo"] = prof.get("partyLogo")
            q["mpPhoto"] = prof.get("photo")
            if q["party"]:
                matched_count += 1
        else:
            q["party"] = ""
            q["partyLogo"] = None
            q["mpPhoto"] = None
    (PUBLIC_DATA / "questions.json").write_text(
        json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  ✓ {matched_count} questions matched to party → questions.json updated")

    # Meta — last updated timestamps surfaced in UI
    meta = {
        "lastProcessed": datetime.now(tz=timezone.utc).isoformat(),
        "sources": {
            "questions": {"lastPortalUpdate": "2026-05-10", "records": len(questions)},
            "mymp": {"lastPortalUpdate": "2025-11-11", "records": len(mymp_records), "period": "Jan–Jun 2025"},
            "kancelarii": {"lastPortalUpdate": "2026-01-08", "records": len(kancelarii_records)},
        },
    }
    (PUBLIC_DATA / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("  ✓ public/data/meta.json")
    print("\nDone.")


if __name__ == "__main__":
    main()
