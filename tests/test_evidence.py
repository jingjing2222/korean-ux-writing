"""The cached registry must be exactly the pinned release, including offline use."""

import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("evidence", ROOT / "skills/korean-ux-writing/scripts/evidence.py")
evidence = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(evidence)


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.data = json.dumps({"version": "1.0.0", "sources": [{"id": "SRC-001"}]}).encode()
        self.digest = hashlib.sha256(self.data).hexdigest()

    def test_accepts_exact_pinned_registry(self):
        self.assertEqual(evidence.verify(self.data, self.digest)["sources"][0]["id"], "SRC-001")

    def test_changed_content_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            evidence.verify(self.data + b" ", self.digest)

    def test_duplicate_source_ids_are_rejected(self):
        data = b'{"sources":[{"id":"SRC-001"},{"id":"SRC-001"}]}'
        with self.assertRaisesRegex(ValueError, "unique"):
            evidence.verify(data, hashlib.sha256(data).hexdigest())

    def test_mutable_main_url_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "lock.json"
            path.write_text(json.dumps({"evidence": {
                "url": "https://raw.githubusercontent.com/owner/repo/main/docs/evidence/sources.json",
                "sha256": self.digest}}))
            with self.assertRaisesRegex(ValueError, "fixed Git commit"):
                evidence.load_lock(path)

    def test_local_source_does_not_bypass_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sources.json"
            path.write_bytes(self.data)
            lock = {"evidence": {"sha256": self.digest}}
            self.assertEqual(evidence.read_pinned(lock, path)[0], self.data)
            path.write_bytes(self.data + b" ")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                evidence.read_pinned(lock, path)

    def test_oversized_registry_is_rejected(self):
        data = b" " * (evidence.MAX_BYTES + 1)
        with self.assertRaisesRegex(ValueError, "size limit"):
            evidence.verify(data, hashlib.sha256(data).hexdigest())


if __name__ == "__main__":
    unittest.main()
