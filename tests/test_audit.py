import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills/korean-ux-writing/scripts/audit.py"
SPEC = importlib.util.spec_from_file_location("audit_validator", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
EXAMPLE = ROOT / "evals/fixtures/minimal/audit.json"
CATALOG = {
    "version": 1,
    "rules": [
        {"id": name, "axis": axis, "sources": ["SRC-001"]}
        for axis, names in (("ux", ("UX-01", "UX-04")), ("ko", ("KO-01", "KO-04", "KO-07")))
        for name in names
    ],
}
DIAGNOSTIC_CATALOG = {
    "patterns": [{"id": f"LT-{number:02d}"} for number in (5, 1, 2, 3, 4)]
}


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.report = json.loads(EXAMPLE.read_text(encoding="utf-8"))

    def errors(self, **options):
        return AUDIT.validate(self.report, CATALOG, diagnostic_catalog=DIAGNOSTIC_CATALOG, **options)

    def assertRejected(self, expected):
        self.assertTrue(any(expected in error for error in self.errors()), self.errors())

    def test_complete_shared_copy_contract_passes(self):
        self.assertEqual([], self.errors())

    def test_version_one_reports_are_explicitly_rejected(self):
        self.report["version"] = 1
        self.assertRejected("version: must be 2; version 1 lacks required meaning contexts and usage diagnoses")

    def test_meaning_contexts_are_required_before_revision(self):
        del self.report["meaning_contexts"]
        del self.report["decisions"]
        errors = self.errors(diagnosis_only=True)
        self.assertTrue(any("meaning_contexts: must be an array" in error for error in errors))

    def test_meaning_context_ids_and_nodes_must_be_valid(self):
        self.report["meaning_contexts"].append(copy.deepcopy(self.report["meaning_contexts"][0]))
        self.assertRejected("meaning_contexts: duplicate id")
        self.report["meaning_contexts"].pop()
        self.report["meaning_contexts"][0]["node_id"] = "unvisited"
        self.assertRejected("meaning_contexts.MC-SAVED.node_id: unknown node")

    def test_meaning_context_requires_goal_sequence_and_product_evidence(self):
        context = self.report["meaning_contexts"][0]
        for field in ("user_goal", "prior_context", "current_decision", "immediate_outcome", "later_outcome"):
            with self.subTest(field=field):
                original = context.pop(field)
                self.assertRejected(f"meaning_contexts.MC-SAVED.{field}: must be a nonempty string")
                context[field] = original
        context["evidence"] = []
        self.assertRejected("meaning_contexts.MC-SAVED.evidence: must not be empty")
        context["evidence"] = ["E-NOT-READ"]
        self.assertRejected("meaning_contexts.MC-SAVED.evidence: unknown evidence")

    def test_every_inventory_item_needs_exactly_one_diagnosis(self):
        self.report["translationese"].pop()
        self.assertRejected("translationese: must match inventory ids exactly")

    def test_missing_diagnoses_cannot_pass_final_audit(self):
        del self.report["translationese"]
        self.assertRejected("translationese: must be an array")

    def test_duplicate_diagnosis_ids_rejected(self):
        self.report["translationese"].append(copy.deepcopy(self.report["translationese"][0]))
        self.assertRejected("translationese: duplicate id")

    def test_diagnosis_original_cannot_be_rewritten(self):
        self.report["translationese"][0]["before"] = "이미 고친 문구"
        self.assertRejected("translationese.copy.saved.before: does not match immutable inventory original")

    def test_diagnosis_status_is_required_and_closed(self):
        self.report["translationese"][0]["status"] = "improved"
        self.assertRejected("must be candidate, clear or uncertain")

    def test_diagnosis_requires_reason_exceptions_and_product_evidence(self):
        diagnosis = self.report["translationese"][0]
        diagnosis.update(reason="", exception_review="", evidence=[])
        for field in ("reason", "exception_review", "evidence"):
            self.assertRejected(f"translationese.copy.saved.{field}: must")
        diagnosis["evidence"] = ["E-NOT-READ"]
        self.assertRejected("unknown evidence")

    def test_every_diagnostic_status_requires_intent_and_korean_fit(self):
        diagnosis = self.report["translationese"][0]
        for status in ("clear", "candidate", "uncertain"):
            for field in ("intent", "korean_fit"):
                with self.subTest(status=status, field=field):
                    diagnosis.update(status=status, patterns=["LT-05"])
                    original = diagnosis.pop(field)
                    self.assertRejected(f"translationese.copy.saved.{field}: must be a nonempty string")
                    diagnosis[field] = " "
                    self.assertRejected(f"translationese.copy.saved.{field}: must be a nonempty string")
                    diagnosis[field] = original

    def test_source_expression_is_optional_but_nonempty_when_present(self):
        diagnosis = self.report["translationese"][0]
        self.assertNotIn("source_expression", diagnosis)
        self.assertEqual([], self.errors())
        diagnosis["source_expression"] = ""
        self.assertRejected("source_expression: must be a nonempty string")

    def test_lexical_pragmatic_pattern_is_part_of_required_catalog_review(self):
        self.report["diagnostic_patterns_reviewed"].remove("LT-05")
        self.assertRejected("missing=['LT-05']")

    def test_candidate_requires_known_patterns(self):
        diagnosis = self.report["translationese"][0]
        diagnosis.update(status="candidate", patterns=[])
        diagnosis["context_reviews"][0]["fit"] = "mismatch"
        self.report["decisions"][0]["diagnosis_resolution"] = "확인한 의미를 유지하면서 후보 표현을 수정했다."
        self.assertRejected("translationese.copy.saved.patterns: must not be empty")
        diagnosis["patterns"] = ["LT-INVENTED"]
        self.assertRejected("unknown diagnostic pattern")
        diagnosis["patterns"] = ["LT-05"]
        self.assertEqual([], self.errors())

    def test_all_installed_diagnostic_patterns_must_be_reviewed(self):
        self.report["diagnostic_patterns_reviewed"].pop()
        self.assertRejected("must match installed diagnostic pattern ids exactly")
        self.report["diagnostic_patterns_reviewed"].append("LT-INVENTED")
        self.assertRejected("extra=['LT-INVENTED']")

    def test_uncertain_diagnosis_allows_partial_but_prevents_completion(self):
        self.report["translationese"][0]["status"] = "uncertain"
        self.report["translationese"][0]["context_reviews"][0]["fit"] = "uncertain"
        decision = self.report["decisions"][0]
        decision.update(status="blocked", after=decision["before"], diagnosis_resolution="문맥이 확인되지 않아 원문을 보류했다.")
        self.assertRejected("uncertain diagnosis prevents completion")
        self.report["complete"] = False
        self.assertEqual([], self.errors())

    def test_every_usage_site_needs_a_diagnostic_context_review(self):
        diagnosis = self.report["translationese"][0]
        diagnosis["context_reviews"].pop()
        errors = self.errors(diagnosis_only=True)
        self.assertTrue(any("translationese.copy.saved.context_reviews: must cover each declared usage site exactly once" in error for error in errors))

    def test_missing_diagnostic_context_reviews_are_rejected(self):
        del self.report["translationese"][0]["context_reviews"]
        self.assertRejected("translationese.copy.saved.context_reviews: must be an array")

    def test_duplicate_or_foreign_usage_site_in_diagnosis_is_rejected(self):
        reviews = self.report["translationese"][0]["context_reviews"]
        reviews.append(copy.deepcopy(reviews[0]))
        self.assertRejected("duplicate occurrence review")
        reviews.pop()
        reviews[0]["occurrence_id"] = "saved.action"
        self.assertRejected("translationese.copy.saved.context_reviews: must cover each declared usage site exactly once")

    def test_diagnostic_context_must_exist_and_match_occurrence_node(self):
        review = self.report["translationese"][0]["context_reviews"][0]
        review["context_id"] = "MC-NOT-READ"
        self.assertRejected("unknown meaning context")
        review["context_id"] = "MC-HISTORY"
        self.assertRejected("meaning context node differs from occurrence node")

    def test_diagnostic_usage_review_requires_reading_reason_and_evidence(self):
        review = self.report["translationese"][0]["context_reviews"][0]
        for field in ("korean_reading", "reason"):
            with self.subTest(field=field):
                original = review.pop(field)
                self.assertRejected(f"context_reviews[0].{field}: must be a nonempty string")
                review[field] = original
        review["evidence"] = []
        self.assertRejected("context_reviews[0].evidence: must not be empty")
        review["evidence"] = ["E-NOT-READ"]
        self.assertRejected("context_reviews[0].evidence: unknown evidence")

    def test_fit_status_is_required_and_closed(self):
        review = self.report["translationese"][0]["context_reviews"][0]
        for fit in (None, "grammatical"):
            with self.subTest(fit=fit):
                review["fit"] = fit
                self.assertRejected("fit: must be fit, mismatch or uncertain")

    def test_clear_cannot_hide_a_mismatch_or_uncertain_usage(self):
        review = self.report["translationese"][0]["context_reviews"][0]
        for fit in ("mismatch", "uncertain"):
            with self.subTest(fit=fit):
                review["fit"] = fit
                self.assertRejected("clear requires fit at every usage site")

    def test_candidate_requires_mismatch_and_cannot_hide_uncertainty(self):
        diagnosis = self.report["translationese"][0]
        diagnosis.update(status="candidate", patterns=["LT-05"])
        self.report["decisions"][0]["diagnosis_resolution"] = "확인한 문제를 수정했다."
        self.assertRejected("candidate requires at least one mismatch and no uncertain usage sites")
        diagnosis["context_reviews"][0]["fit"] = "mismatch"
        self.assertEqual([], self.errors())
        diagnosis["context_reviews"][1]["fit"] = "uncertain"
        self.assertRejected("candidate requires at least one mismatch and no uncertain usage sites")

    def test_uncertain_requires_an_uncertain_usage_site(self):
        self.report["translationese"][0]["status"] = "uncertain"
        self.assertRejected("uncertain requires at least one uncertain usage site")

    def test_candidate_final_decision_must_explain_resolution(self):
        diagnosis = self.report["translationese"][0]
        diagnosis.update(status="candidate", patterns=["LT-05"])
        diagnosis["context_reviews"][0]["fit"] = "mismatch"
        self.assertEqual([], self.errors(diagnosis_only=True))
        self.assertRejected("diagnosis_resolution: must be a nonempty string")
        self.report["decisions"][0]["diagnosis_resolution"] = " "
        self.assertRejected("diagnosis_resolution: must be a nonempty string")
        self.report["decisions"][0]["diagnosis_resolution"] = "확인한 의미와 어긋난 부분을 수정했다."
        self.assertEqual([], self.errors())

    def test_uncertain_cannot_be_changed_or_kept_even_in_partial_audit(self):
        self.report["complete"] = False
        diagnosis = self.report["translationese"][0]
        diagnosis["status"] = "uncertain"
        diagnosis["context_reviews"][0]["fit"] = "uncertain"
        decision = self.report["decisions"][0]
        decision["diagnosis_resolution"] = "아직 맥락을 확인하지 못했다."
        for status in ("changed", "keep"):
            with self.subTest(status=status):
                decision["status"] = status
                self.assertRejected("uncertain diagnosis does not permit changed or keep")
        decision.update(status="blocked", after=decision["before"])
        self.assertEqual([], self.errors())
        del decision["diagnosis_resolution"]
        self.assertRejected("diagnosis_resolution: must be a nonempty string")

    def test_uncertain_with_mismatched_usage_can_remain_explicitly_blocked(self):
        self.report["complete"] = False
        diagnosis = self.report["translationese"][0]
        diagnosis.update(status="uncertain", patterns=["LT-05"])
        diagnosis["context_reviews"][0]["fit"] = "mismatch"
        diagnosis["context_reviews"][1]["fit"] = "uncertain"
        decision = self.report["decisions"][0]
        decision.update(status="blocked", after=decision["before"], diagnosis_resolution="다른 사용처의 맥락을 확인하기 전까지 공유 문구를 보류했다.")
        self.assertEqual([], self.errors())

    def test_diagnosis_only_passes_before_decisions_exist(self):
        del self.report["decisions"]
        del self.report["unresolved"]
        self.assertEqual([], self.errors(diagnosis_only=True))
        self.assertRejected("decisions: must be an array")

    def test_diagnosis_only_still_checks_context_and_diagnosis(self):
        del self.report["decisions"]
        self.report["context_reads"] = []
        self.report["translationese"][0]["patterns"] = ["LT-INVENTED"]
        errors = self.errors(diagnosis_only=True)
        self.assertTrue(any("unread context files" in error for error in errors))
        self.assertTrue(any("unknown diagnostic pattern" in error for error in errors))

    def test_diagnosis_only_cannot_require_final_completion(self):
        self.assertTrue(any("cannot be combined" in error
                            for error in self.errors(diagnosis_only=True, require_complete=True)))

    def test_legacy_validate_call_loads_installed_diagnostic_catalog(self):
        with mock.patch.object(AUDIT, "read_json", return_value=DIAGNOSTIC_CATALOG) as read:
            self.assertEqual([], AUDIT.validate(self.report, CATALOG, True))
            read.assert_called_once_with(SCRIPT.parent.parent / "references/translationese.json")

    def test_every_inventory_item_needs_exactly_one_decision(self):
        self.report["decisions"].pop()
        self.assertRejected("must match inventory ids exactly")

    def test_duplicate_inventory_and_decision_ids_rejected(self):
        self.report["inventory"].append(copy.deepcopy(self.report["inventory"][0]))
        self.report["decisions"].append(copy.deepcopy(self.report["decisions"][0]))
        self.assertRejected("duplicate id")

    def test_before_cannot_be_rewritten_to_hide_original(self):
        self.report["decisions"][0]["before"] = "처음부터 자연스러웠어요"
        self.assertRejected("immutable inventory original")

    def test_shared_copy_requires_every_usage_site_review(self):
        self.report["decisions"][0]["occurrence_reviews"].pop()
        self.assertRejected("each declared usage site")

    def test_usage_site_state_must_match_node(self):
        self.report["inventory"][0]["occurrences"][0]["state"] = "pending"
        self.assertRejected("state differs")

    def test_cross_inventory_duplicate_usage_site_rejected(self):
        extra = copy.deepcopy(self.report["inventory"][0]["occurrences"][0])
        extra["id"] = "duplicate-location"
        self.report["inventory"][1]["occurrences"].append(extra)
        self.assertRejected("duplicate usage site")

    def test_missing_ko_basis_cannot_pass_as_ux_review(self):
        self.report["decisions"][0]["ko"] = []
        self.assertRejected("ko: must not be empty")

    def test_wrong_axis_and_invented_rule_rejected(self):
        self.report["decisions"][0]["ko"][0]["rule"] = "UX-01"
        self.assertRejected("wrong axis")
        self.report["decisions"][0]["ko"][0]["rule"] = "KO-INVENTED"
        self.assertRejected("unknown installed rule")

    def test_unknown_product_evidence_rejected(self):
        self.report["decisions"][0]["ux"][0]["evidence"] = ["E-NOT-READ"]
        self.assertRejected("unknown evidence")

    def test_unread_context_blocks_complete_and_reviewed_node(self):
        self.report["context_reads"] = []
        self.assertRejected("unread scope files")
        self.assertRejected("unread context files")

    def test_disconnected_funnel_cannot_complete(self):
        self.report["funnel"]["edges"] = []
        self.assertRejected("unreachable from declared entries")
        self.assertRejected("cannot reach a declared terminal")

    def test_unreviewed_transition_cannot_complete(self):
        self.report["funnel"]["edges"][0]["reviewed"] = False
        self.assertRejected("unreviewed transition")

    def test_unreviewed_screen_cannot_complete(self):
        self.report["funnel"]["nodes"][1]["reviewed"] = False
        self.assertRejected("unreviewed node")

    def test_declared_state_without_node_cannot_complete(self):
        self.report["scope"]["states"].append("failed")
        self.assertRejected("not all scope states")

    def test_blocked_copy_is_valid_partial_but_not_complete(self):
        decision = self.report["decisions"][0]
        decision.update(status="blocked", after=decision["before"], ux=[], ko=[], occurrence_reviews=[])
        self.assertRejected("blocked or excluded copy")
        self.report["complete"] = False
        self.assertEqual([], self.errors())
        self.assertTrue(self.errors(require_complete=True))

    def test_excluded_ui_cannot_be_hidden_from_completion(self):
        self.report["scope"]["exclusions"] = [{"target": "/unvisited", "reason": "Cannot access", "evidence": ["E-CODE"]}]
        self.assertRejected("excluded scope")

    def test_limitations_and_unresolved_block_completion(self):
        self.report["scope"]["discovery"]["limitations"] = ["Remote copy unavailable"]
        self.report["unresolved"] = [{"id": "remote", "reason": "Missing remote view", "evidence": ["E-CODE"]}]
        self.assertRejected("unverified discovery")
        self.assertRejected("unresolved issues")

    def set_text(self, before, after, protected=()):
        self.report["inventory"][0].update(original=before, protected_tokens=list(protected))
        self.report["translationese"][0].update(before=before)
        self.report["decisions"][0].update(before=before, after=after)

    def test_common_placeholders_can_move_but_not_disappear(self):
        before = "{name} {{count}} ${amount} %s {0}"
        self.set_text(before, "{{count}} {0} %s ${amount} {name} 저장")
        self.assertEqual([], self.errors())
        self.report["decisions"][0]["after"] = "{{count}} {0} %s ${amount} 저장"
        self.assertRejected("token multiset changed")

    def test_placeholder_count_is_preserved(self):
        self.set_text("{name} 님 {name}", "{name} 님")
        self.assertRejected("token multiset changed")

    def test_explicit_amount_protected_by_occurrence_count(self):
        self.set_text("월 6,900원, 다음 달에도 6,900원", "월 6,900원", ["6,900원"])
        self.assertRejected("protected token changed")

    def test_icu_branches_and_number_markers_preserved(self):
        self.set_text("{count, plural, =0 {없음} other {#개}}", "{count, plural, =0 {없어요} other {#개 있어요}}")
        self.assertEqual([], self.errors())
        self.report["decisions"][0]["after"] = "{count, plural, other {#개 있어요}}"
        self.assertRejected("token multiset changed")

    def test_icu_select_custom_selector_and_offset_preserved(self):
        self.set_text("{kind, select, paid {결제} other {대기}}", "{kind, select, unpaid {결제} other {대기}}")
        self.assertRejected("token multiset changed")
        self.set_text("{n, plural, offset:1 one {한 개} other {#개}}", "{n, plural, offset:2 one {한 개} other {#개}}")
        self.assertRejected("token multiset changed")

    def test_keep_cannot_change_text(self):
        self.report["decisions"][1]["after"] = "다른 화면 보기"
        self.assertRejected("must preserve text")

    def test_malformed_data_returns_errors_without_traceback(self):
        for malformed in (None, [], {}, {"version": 1, "complete": True, "scope": []}):
            with self.subTest(malformed=malformed):
                self.assertTrue(AUDIT.validate(malformed, CATALOG, diagnostic_catalog=DIAGNOSTIC_CATALOG))

    def installed_cli(self, root):
        (root / "scripts").mkdir()
        (root / "references").mkdir()
        shutil.copy2(SCRIPT, root / "scripts/audit.py")
        (root / "references/rules.json").write_text(json.dumps(CATALOG), encoding="utf-8")
        (root / "references/translationese.json").write_text(json.dumps(DIAGNOSTIC_CATALOG), encoding="utf-8")
        (root / "report.json").write_text(json.dumps(self.report), encoding="utf-8")
        return [sys.executable, str(root / "scripts/audit.py"), str(root / "report.json")]

    def test_cli_works_from_installed_skill_without_repo_docs(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            command = self.installed_cli(root) + ["--require-complete", "--json"]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stderr + result.stdout)
            self.assertTrue(json.loads(result.stdout)["complete"])
            (root / "report.json").write_text('{"version":1,"version":1}', encoding="utf-8")
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(1, result.returncode)
            self.assertIn("duplicate JSON key", json.loads(result.stdout)["errors"][0])

    def test_diagnosis_cli_does_not_claim_final_completion(self):
        del self.report["decisions"]
        del self.report["unresolved"]
        with tempfile.TemporaryDirectory() as temp:
            command = self.installed_cli(Path(temp)) + ["--diagnosis-only", "--json"]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stderr + result.stdout)
            output = json.loads(result.stdout)
            self.assertTrue(output["valid"])
            self.assertFalse(output["complete"])
            self.assertEqual("diagnosis-only", output["mode"])
            result = subprocess.run(command + ["--require-complete"], capture_output=True, text=True)
            self.assertEqual(2, result.returncode)
            self.assertIn("not allowed with argument", result.stderr)


if __name__ == "__main__":
    unittest.main()
