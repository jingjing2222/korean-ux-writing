#!/usr/bin/env python3
"""Check source traceability and portable package structure, not prose quality."""

import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/korean-ux-writing"


def main():
    errors = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    sources_path = ROOT / "docs/evidence/sources.json"
    sources = json.loads(sources_path.read_text())["sources"]
    ids = [s["id"] for s in sources]
    check(len(sources) >= 50, "At least 50 Korean source records are required")
    check(sum(s.get("language") == "ko" for s in sources) >= 50, "At least 50 records must have Korean source content")
    check(len(set(ids)) == len(ids), "Source IDs must be unique")
    check(len({s["url"] for s in sources}) == len(sources), "Source URLs must be unique")
    by_id = {s["id"]: s for s in sources}
    cards = (ROOT / "docs/evidence/sources.md").read_text()
    for source in sources:
        sid = source["id"]
        for field in ("title", "url", "publisher", "kind", "locator", "claim", "scope", "limitations"):
            check(isinstance(source.get(field), str) and bool(source[field].strip()), f"{sid}: missing {field}")
        check(source.get("language") in ("ko", "ko-en", "en"), f"{sid}: unknown source language")
        check(source["url"].startswith("https://"), f"{sid}: expected an HTTPS source")
        check(source["verification"]["status"] in ("passage-checked", "partial"), f"{sid}: unknown verification status")
        check(bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", source["verification"]["checked_on"])), f"{sid}: invalid check date")
        check(f'id="{sid.lower()}"' in cards, f"{sid}: missing source-card anchor")
    rules = json.loads((SKILL / "references/rules.json").read_text())["rules"]
    patterns = json.loads((SKILL / "references/translationese.json").read_text())["patterns"]
    check(len({p["id"] for p in patterns}) == len(patterns), "Diagnostic IDs must be unique")
    for pattern in patterns:
        check(bool(pattern.get("sources")), f'{pattern["id"]}: no diagnostic basis')
        for sid in pattern.get("sources", []):
            check(sid in by_id and by_id[sid]["verification"]["status"] == "passage-checked", f'{pattern["id"]}: unverified diagnostic source {sid}')
    check(len({r["id"] for r in rules}) == len(rules), "Rule IDs must be unique")
    for rule in rules:
        rid = rule["id"]
        check(rule["axis"] in ("ux", "ko"), f"{rid}: unknown responsibility")
        check(rid.startswith(rule["axis"].upper() + "-"), f"{rid}: mismatched responsibility")
        check(bool(rule["sources"]), f"{rid}: no external basis")
        for sid in rule["sources"]:
            check(sid in by_id, f"{rid}: unknown source {sid}")
            if sid in by_id:
                check(by_id[sid]["verification"]["status"] == "passage-checked", f"{rid}: partial source cannot authorize an active rule: {sid}")

    lock = json.loads((SKILL / "sources.lock.json").read_text())["evidence"]
    check(hashlib.sha256(sources_path.read_bytes()).hexdigest() == lock["sha256"], "Evidence digest differs from the installed lock")
    url = urlsplit(lock["url"])
    parts = url.path.strip("/").split("/")
    pinned = len(parts) == 6 and bool(re.fullmatch(r"[0-9a-f]{40}", parts[2]))
    check(url.scheme == "https" and url.netloc == "raw.githubusercontent.com" and pinned, "Evidence must use a fixed Git commit")
    if pinned:
        committed = subprocess.run(["git", "show", f"{parts[2]}:docs/evidence/sources.json"], cwd=ROOT, capture_output=True)
        check(committed.returncode == 0 and committed.stdout == sources_path.read_bytes(), "Pinned evidence commit must contain this registry (use a full clone)")
    check(not (SKILL / "docs").exists(), "Keep evidence documentation outside the skill")

    entry = (SKILL / "SKILL.md").read_text()
    check(entry.startswith("---\n") and "\n---\n" in entry[4:], "Missing skill frontmatter")
    frontmatter = entry.split("---", 2)[1]
    check("name: korean-ux-writing\n" in frontmatter, "Unexpected skill name")
    check(bool(re.search(r"^description: \S.+", frontmatter, re.M)), "Missing discovery description")
    for document in [ROOT / "README.md", ROOT / "README.en.md", *SKILL.rglob("*.md"), *(ROOT / "docs").rglob("*.md"), ROOT / "evals/README.md"]:
        for destination in re.findall(r"\[[^\]]*\]\(([^)]+)\)", document.read_text()):
            if urlsplit(destination).scheme or destination.startswith("#"):
                continue
            target = unquote(destination.split("#", 1)[0])
            check((document.parent / target).exists(), f"{document.relative_to(ROOT)}: broken link {destination}")

    for error in errors:
        print(f"FAIL: {error}", file=sys.stderr)
    if errors:
        return 1
    print(f"PASS: {len(sources)} sources, {len(rules)} traced rules, {len(patterns)} diagnostics, pinned evidence and package links")
    print("This validates records and references; it does not independently verify source claims or copy quality.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
