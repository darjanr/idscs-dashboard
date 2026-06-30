#!/usr/bin/env python3
"""Machine-translate parliamentary question + answer text into AL and EN.

Uses the Claude Message Batches API (async, 50% cheaper than live calls) to
translate the Macedonian question/answer bodies into Albanian and English and
writes public/data/questions_i18n.json, keyed by question id:

    { "<id>": { "q": {"al": "...", "en": "..."},
                "a": {"al": "...", "en": "..."} } }

The frontend renders these with a small "machine-translated" note and falls
back to the original Macedonian text wherever a translation is missing — so the
site works before this script has ever run.

Idempotent: only ids not already present are translated, so a data refresh only
pays for new questions. The 657 questions are ~21k words; only 14 have answer
text. Re-run after fetch_data.py + process.py, then rebuild the site.

Requires ANTHROPIC_API_KEY and `pip install anthropic`.
Usage:  python3 scripts/translate_questions.py
"""
import json
import os
import sys
import time
from pathlib import Path

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "public" / "data" / "questions.json"
OUT = ROOT / "public" / "data" / "questions_i18n.json"
MODEL = "claude-opus-4-8"

SYSTEM = (
    "You are a professional translator for an official parliamentary open-data "
    "dashboard of the Assembly of the Republic of North Macedonia. You are given "
    "the Macedonian text of a parliamentary question or its answer. Translate it "
    "faithfully into Albanian (al) and English (en). Preserve the meaning, named "
    "entities, institution names and numbers exactly; keep the formal register; "
    "do not add, omit, summarise or comment. Return only the two translations."
)

SCHEMA = {
    "type": "object",
    "properties": {"al": {"type": "string"}, "en": {"type": "string"}},
    "required": ["al", "en"],
    "additionalProperties": False,
}


def _req(custom_id: str, text: str) -> Request:
    return Request(
        custom_id=custom_id,
        params=MessageCreateParamsNonStreaming(
            model=MODEL,
            max_tokens=2000,
            system=SYSTEM,
            output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
            messages=[{"role": "user", "content": text}],
        ),
    )


def build_requests(questions, existing):
    reqs = []
    for q in questions:
        qid = q["id"]
        cur = existing.get(qid, {})
        qtext = (q.get("question") or "").strip()
        if qtext and "q" not in cur:
            reqs.append(_req(f"{qid}::q", qtext))
        atext = (q.get("answer") or "").strip()
        if atext and not q.get("answerIsCopy") and "a" not in cur:
            reqs.append(_req(f"{qid}::a", atext))
    return reqs


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY first (and `pip install anthropic`).")

    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    existing = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}

    reqs = build_requests(questions, existing)
    if not reqs:
        print("Nothing to translate — questions_i18n.json is already up to date.")
        return

    print(f"Translating {len(reqs)} text(s) via the Batches API ({MODEL})…")
    client = anthropic.Anthropic()
    batch = client.messages.batches.create(requests=reqs)
    print(f"  batch {batch.id} created — polling (most finish within ~1h)…")

    while True:
        b = client.messages.batches.retrieve(batch.id)
        if b.processing_status == "ended":
            break
        print(f"  …{b.request_counts.processing} processing")
        time.sleep(30)

    written = 0
    for result in client.messages.batches.results(batch.id):
        if result.result.type != "succeeded":
            print(f"  ! {result.custom_id}: {result.result.type}")
            continue
        text = next((blk.text for blk in result.result.message.content if blk.type == "text"), "")
        try:
            tr = json.loads(text)
        except json.JSONDecodeError:
            print(f"  ! {result.custom_id}: could not parse JSON")
            continue
        qid, _, kind = result.custom_id.partition("::")
        entry = existing.setdefault(qid, {})
        entry["q" if kind == "q" else "a"] = {"al": tr.get("al", ""), "en": tr.get("en", "")}
        written += 1

    OUT.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ wrote {written} translation(s) → {OUT.relative_to(ROOT)} "
          f"({len(existing)} questions total). Rebuild the site to publish.")


if __name__ == "__main__":
    main()
