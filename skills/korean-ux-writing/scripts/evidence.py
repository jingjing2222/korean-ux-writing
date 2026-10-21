#!/usr/bin/env python3
"""Fetch the pinned source registry without installing evidence in the skill."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urlparse
from urllib.request import Request, urlopen

MAX_BYTES = 2_000_000


def load_lock(path: Path) -> dict:
    lock = json.loads(path.read_text(encoding="utf-8"))
    evidence = lock["evidence"]
    url = urlparse(evidence["url"])
    parts = url.path.strip("/").split("/")
    if (url.scheme != "https" or url.netloc != "raw.githubusercontent.com"
            or url.query or url.fragment or len(parts) < 6
            or not re.fullmatch(r"[0-9a-f]{40}", parts[2])
            or parts[3:] != ["docs", "evidence", "sources.json"]):
        raise ValueError("Evidence URL must identify a fixed Git commit and sources.json")
    if not re.fullmatch(r"[0-9a-f]{64}", evidence["sha256"]):
        raise ValueError("Evidence lock needs a SHA-256 digest")
    return lock


def verify(data: bytes, expected_hash: str) -> dict:
    if len(data) > MAX_BYTES:
        raise ValueError("Evidence registry exceeds the size limit")
    if hashlib.sha256(data).hexdigest() != expected_hash:
        raise ValueError("Evidence checksum mismatch; do not use an unpinned replacement")
    result = json.loads(data.decode("utf-8"))
    sources = result.get("sources")
    if not isinstance(sources, list) or not sources:
        raise ValueError("Evidence registry has no sources")
    ids = [source.get("id") for source in sources]
    if any(not isinstance(value, str) or not value for value in ids) or len(set(ids)) != len(ids):
        raise ValueError("Evidence registry source IDs must be unique and nonempty")
    return result


def read_pinned(lock: dict, source: Path | None = None) -> tuple[bytes, dict]:
    evidence = lock["evidence"]
    if source is not None:
        with source.open("rb") as handle:
            data = handle.read(MAX_BYTES + 1)
    else:
        request = Request(evidence["url"], headers={"User-Agent": "korean-ux-writing/1.0"})
        with urlopen(request, timeout=25) as response:
            data = response.read(MAX_BYTES + 1)
    return data, verify(data, evidence["sha256"])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path, help="Cache path in the target project")
    parser.add_argument("--source", type=Path, help="Use a local registry with the same pinned digest")
    args = parser.parse_args(argv)
    temporary: Path | None = None
    try:
        skill = Path(__file__).resolve().parents[1]
        lock = load_lock(skill / "sources.lock.json")
        data, registry = read_pinned(lock, args.source)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=args.out.parent, prefix=".evidence-", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(data)
        temporary.replace(args.out)
        print(f"Verified {len(registry['sources'])} source records: {args.out}")
        print("Read each rule's cited passage, scope, and limitations before applying it.")
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Evidence unavailable: {error}", file=sys.stderr)
        print("Keep affected judgments unresolved; do not invent replacement criteria.", file=sys.stderr)
        return 1
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


if __name__ == "__main__":
    raise SystemExit(main())
