#!/usr/bin/env python3
"""Validate a declared copy audit's mechanical contract; never grade prose."""

import argparse
from collections import Counter, deque
import json
from pathlib import Path
import re
import sys


TOKEN = re.compile(
    r"\{\{\s*[\w.]+\s*\}\}|\$\{[^{}]+\}|"
    r"\{[A-Za-z_][\w.]*\}|\{[0-9]+\}|"
    r"\{\s*[A-Za-z_][\w.]*\s*,\s*(?:plural|selectordinal|select|number|date|time)\b|"
    r"%(?:\([A-Za-z_][\w.]*\)|[0-9]+\$)?[-+#0 ]*[0-9]*(?:\.[0-9]+)?[sdif]"
)
LIMITATION = (
    "Checks declared coverage, references and string invariants only. "
    "It does not prove exhaustive discovery, evidence truth, semantic preservation, "
    "translation origin, diagnostic accuracy, review order, Korean quality, "
    "accessibility or rendered UI behavior."
)


def token_signature(text):
    """Common interpolation tokens plus ICU selectors, not a full ICU parser."""
    result = Counter(TOKEN.findall(text))
    for match in re.finditer(r"\{\s*([\w.]+)\s*,\s*(plural|selectordinal|select)\s*,", text):
        name, kind = match.groups()
        cursor = match.end()
        offset = re.match(r"\s*offset\s*:\s*([0-9]+)", text[cursor:])
        if offset:
            result[f"ICU:{name}:{kind}:offset:{offset[1]}"] += 1
            cursor += offset.end()
        while cursor < len(text):
            branch = re.match(r"\s*([^\s{}]+)\s*\{", text[cursor:])
            if not branch:
                break
            result[f"ICU:{name}:{kind}:branch:{branch[1]}"] += 1
            cursor += branch.end()
            depth, start = 1, cursor
            while cursor < len(text) and depth:
                depth += (text[cursor] == "{") - (text[cursor] == "}")
                cursor += 1
            if depth:
                result["ICU:unclosed"] += 1
                break
            if kind != "select":
                result[f"ICU:{name}:{kind}:number-marker"] += text[start:cursor - 1].count("#")
    return result


def validate(audit, catalog, require_complete=False, *, diagnostic_catalog=None, diagnosis_only=False):
    """Return errors without mutating the report or reading the target project."""
    errors = []

    def fail(path, message):
        errors.append(f"{path}: {message}")

    def obj(value, path):
        if not isinstance(value, dict):
            fail(path, "must be an object")
            return {}
        return value

    def rows(value, path, nonempty=False):
        if not isinstance(value, list):
            fail(path, "must be an array")
            return []
        if nonempty and not value:
            fail(path, "must not be empty")
        return value

    def string(value, path, nonempty=True):
        if not isinstance(value, str) or (nonempty and not value.strip()):
            fail(path, "must be a nonempty string" if nonempty else "must be a string")
            return ""
        return value

    def strings(value, path, nonempty=False):
        values = rows(value, path, nonempty)
        result = [string(v, f"{path}[{i}]") for i, v in enumerate(values)]
        if len(set(result)) != len(result):
            fail(path, "contains duplicates")
        return result

    def indexed(value, path, nonempty=False):
        result = {}
        for i, raw in enumerate(rows(value, path, nonempty)):
            item = obj(raw, f"{path}[{i}]")
            key = string(item.get("id"), f"{path}[{i}].id")
            if key in result:
                fail(path, f"duplicate id {key!r}")
            result[key] = item
        return result

    audit = obj(audit, "audit")
    catalog = obj(catalog, "rules")
    if diagnostic_catalog is None:
        try:
            diagnostic_catalog = read_json(
                Path(__file__).resolve().parent.parent / "references" / "translationese.json"
            )
        except (OSError, ValueError, RecursionError) as error:
            fail("diagnostic_catalog", str(error))
            diagnostic_catalog = {}
    diagnostic_catalog = obj(diagnostic_catalog, "diagnostic_catalog")
    if require_complete and diagnosis_only:
        fail("mode", "diagnosis_only and require_complete cannot be combined")
    if type(audit.get("version")) is not int or audit.get("version") != 1:
        fail("version", "must be 1")
    complete = audit.get("complete") is True
    if type(audit.get("complete")) is not bool:
        fail("complete", "must be a boolean")
    if require_complete and not complete:
        fail("complete", "a complete report is required")

    rules = indexed(catalog.get("rules"), "rules.rules", True)
    for rule_id, rule in rules.items():
        if rule.get("axis") not in ("ux", "ko"):
            fail(f"rules.{rule_id}.axis", "must be ux or ko")
        strings(rule.get("sources"), f"rules.{rule_id}.sources", True)

    patterns = indexed(diagnostic_catalog.get("patterns"), "diagnostic_catalog.patterns", True)
    reviewed_patterns = set(strings(
        audit.get("diagnostic_patterns_reviewed"), "diagnostic_patterns_reviewed", True
    ))
    if reviewed_patterns != set(patterns):
        fail("diagnostic_patterns_reviewed", "must match installed diagnostic pattern ids exactly; "
             f"missing={sorted(set(patterns) - reviewed_patterns)}, "
             f"extra={sorted(reviewed_patterns - set(patterns))}")

    evidence = indexed(audit.get("evidence"), "evidence", True)
    for evidence_id, item in evidence.items():
        if item.get("kind") not in ("code", "runtime", "spec", "user"):
            fail(f"evidence.{evidence_id}.kind", "must be code, runtime, spec or user")
        string(item.get("ref"), f"evidence.{evidence_id}.ref")
        string(item.get("detail"), f"evidence.{evidence_id}.detail")

    def refs(value, path, required=True):
        ids = strings(value, path, required)
        for evidence_id in ids:
            if evidence_id not in evidence:
                fail(path, f"unknown evidence {evidence_id!r}")
        return ids

    scope = obj(audit.get("scope"), "scope")
    files = set(strings(scope.get("files"), "scope.files", True))
    routes = set(strings(scope.get("routes"), "scope.routes", True))
    states = set(strings(scope.get("states"), "scope.states", True))
    discovery = obj(scope.get("discovery"), "scope.discovery")
    strings(discovery.get("methods"), "scope.discovery.methods", True)
    refs(discovery.get("evidence"), "scope.discovery.evidence")
    limitations = strings(discovery.get("limitations"), "scope.discovery.limitations")
    if complete and limitations:
        fail("scope.discovery.limitations", "unverified discovery prevents completion")
    exclusions = rows(scope.get("exclusions"), "scope.exclusions")
    for i, raw in enumerate(exclusions):
        exclusion = obj(raw, f"scope.exclusions[{i}]")
        string(exclusion.get("target"), f"scope.exclusions[{i}].target")
        string(exclusion.get("reason"), f"scope.exclusions[{i}].reason")
        refs(exclusion.get("evidence"), f"scope.exclusions[{i}].evidence")
    if complete and exclusions:
        fail("scope.exclusions", "excluded scope prevents a whole-scope completion claim")

    read_files = set()
    for i, raw in enumerate(rows(audit.get("context_reads"), "context_reads")):
        entry = obj(raw, f"context_reads[{i}]")
        file = string(entry.get("file"), f"context_reads[{i}].file")
        refs(entry.get("evidence"), f"context_reads[{i}].evidence")
        if file in read_files:
            fail("context_reads", f"duplicate file {file!r}")
        if file not in files:
            fail("context_reads", f"file outside scope {file!r}")
        read_files.add(file)
    if complete and read_files != files:
        fail("context_reads", f"unread scope files: {sorted(files - read_files)}")

    funnel = obj(audit.get("funnel"), "funnel")
    nodes = indexed(funnel.get("nodes"), "funnel.nodes", True)
    edges = indexed(funnel.get("edges"), "funnel.edges")
    for node_id, node in nodes.items():
        path = f"funnel.nodes.{node_id}"
        route = string(node.get("route"), path + ".route")
        state = string(node.get("state"), path + ".state")
        if route not in routes or state not in states:
            fail(path, "route and state must be declared in scope")
        if node.get("kind") not in ("entry", "screen", "terminal"):
            fail(path + ".kind", "must be entry, screen or terminal")
        if type(node.get("reviewed")) is not bool:
            fail(path + ".reviewed", "must be a boolean")
        refs(node.get("evidence"), path + ".evidence", node.get("reviewed") is True)
        contexts = strings(node.get("context_files"), path + ".context_files", True)
        if set(contexts) - files:
            fail(path + ".context_files", "contains files outside scope")
        if node.get("reviewed") is True and set(contexts) - read_files:
            fail(path, "reviewed node has unread context files")
        if complete and node.get("reviewed") is not True:
            fail(path, "unreviewed node prevents completion")
    if complete:
        if {n.get("route") for n in nodes.values() if isinstance(n.get("route"), str)} != routes:
            fail("funnel.nodes", "not all scope routes have nodes")
        if {n.get("state") for n in nodes.values() if isinstance(n.get("state"), str)} != states:
            fail("funnel.nodes", "not all scope states have nodes")

    forward = {n: set() for n in nodes}
    reverse = {n: set() for n in nodes}
    for edge_id, edge in edges.items():
        path = f"funnel.edges.{edge_id}"
        origin = string(edge.get("from"), path + ".from")
        target = string(edge.get("to"), path + ".to")
        string(edge.get("trigger"), path + ".trigger")
        if origin not in nodes or target not in nodes:
            fail(path, "edge endpoints must exist")
        else:
            forward[origin].add(target)
            reverse[target].add(origin)
        if type(edge.get("reviewed")) is not bool:
            fail(path + ".reviewed", "must be a boolean")
        refs(edge.get("evidence"), path + ".evidence", edge.get("reviewed") is True)
        if complete and edge.get("reviewed") is not True:
            fail(path, "unreviewed transition prevents completion")

    def reachable(seeds, graph):
        visited = set(seeds)
        queue = deque(seeds)
        while queue:
            for other in graph[queue.popleft()] - visited:
                visited.add(other)
                queue.append(other)
        return visited

    if complete:
        entries = {n for n, value in nodes.items() if value.get("kind") == "entry"}
        terminals = {n for n, value in nodes.items() if value.get("kind") == "terminal"}
        if not entries or not terminals:
            fail("funnel", "requires entry and terminal nodes")
        if reachable(entries, forward) != set(nodes):
            fail("funnel", "some nodes are unreachable from declared entries")
        if reachable(terminals, reverse) != set(nodes):
            fail("funnel", "some nodes cannot reach a declared terminal")

    inventory = indexed(audit.get("inventory"), "inventory", True)
    occurrence_ids = set()
    occurrence_sites = set()
    occurrences_by_copy = {}
    for copy_id, item in inventory.items():
        path = f"inventory.{copy_id}"
        string(item.get("original"), path + ".original")
        tokens = strings(item.get("protected_tokens"), path + ".protected_tokens")
        original = item.get("original") if isinstance(item.get("original"), str) else ""
        for token in tokens:
            if token not in original:
                fail(path + ".protected_tokens", f"token absent from original: {token!r}")
        occurrences = indexed(item.get("occurrences"), path + ".occurrences", True)
        occurrences_by_copy[copy_id] = occurrences
        for occurrence_id, occurrence in occurrences.items():
            loc = path + f".occurrences.{occurrence_id}"
            if occurrence_id in occurrence_ids:
                fail(loc, "occurrence id is not globally unique")
            occurrence_ids.add(occurrence_id)
            node_id = string(occurrence.get("node_id"), loc + ".node_id")
            file = string(occurrence.get("file"), loc + ".file")
            anchor = string(occurrence.get("anchor"), loc + ".anchor")
            state = string(occurrence.get("state"), loc + ".state")
            role = string(occurrence.get("role"), loc + ".role")
            if node_id not in nodes:
                fail(loc, "unknown node")
            elif state != nodes[node_id].get("state"):
                fail(loc, "state differs from node state")
            if file not in files:
                fail(loc, "file outside scope")
            site = (node_id, file, anchor, state, role)
            if site in occurrence_sites:
                fail(loc, "duplicate usage site across inventory")
            occurrence_sites.add(site)

    diagnoses = indexed(audit.get("translationese"), "translationese", True)
    if set(diagnoses) != set(inventory):
        fail("translationese", "must match inventory ids exactly; "
             f"missing={sorted(set(inventory) - set(diagnoses))}, "
             f"extra={sorted(set(diagnoses) - set(inventory))}")
    for copy_id, diagnosis in diagnoses.items():
        path = f"translationese.{copy_id}"
        before = string(diagnosis.get("before"), path + ".before")
        if before != inventory.get(copy_id, {}).get("original"):
            fail(path + ".before", "does not match immutable inventory original")
        status = diagnosis.get("status")
        if status not in ("candidate", "clear", "uncertain"):
            fail(path + ".status", "must be candidate, clear or uncertain")
        pattern_ids = strings(diagnosis.get("patterns"), path + ".patterns", status == "candidate")
        for pattern_id in pattern_ids:
            if pattern_id not in patterns:
                fail(path + ".patterns", f"unknown diagnostic pattern {pattern_id!r}")
        string(diagnosis.get("intent"), path + ".intent")
        string(diagnosis.get("korean_fit"), path + ".korean_fit")
        string(diagnosis.get("reason"), path + ".reason")
        string(diagnosis.get("exception_review"), path + ".exception_review")
        if "source_expression" in diagnosis:
            string(diagnosis.get("source_expression"), path + ".source_expression")
        refs(diagnosis.get("evidence"), path + ".evidence")
        if complete and status == "uncertain":
            fail(path, "uncertain diagnosis prevents completion")

    if diagnosis_only:
        return errors

    decisions = indexed(audit.get("decisions"), "decisions", True)
    if set(decisions) != set(inventory):
        fail("decisions", f"must match inventory ids exactly; missing={sorted(set(inventory)-set(decisions))}, extra={sorted(set(decisions)-set(inventory))}")
    for copy_id, decision in decisions.items():
        path = f"decisions.{copy_id}"
        status = decision.get("status")
        if status not in ("changed", "keep", "blocked", "excluded"):
            fail(path + ".status", "must be changed, keep, blocked or excluded")
        before = string(decision.get("before"), path + ".before")
        after = string(decision.get("after"), path + ".after", False)
        string(decision.get("reason"), path + ".reason")
        item = inventory.get(copy_id, {})
        if before != item.get("original"):
            fail(path + ".before", "does not match immutable inventory original")
        if status == "changed" and before == after:
            fail(path, "changed decision must change the text")
        if status in ("keep", "blocked", "excluded") and before != after:
            fail(path, "keep, blocked and excluded decisions must preserve text")
        if token_signature(before) != token_signature(after):
            fail(path, "placeholder/interpolation token multiset changed")
        for token in item.get("protected_tokens", []) if isinstance(item.get("protected_tokens"), list) else []:
            if isinstance(token, str) and before.count(token) != after.count(token):
                fail(path, f"protected token changed: {token!r}")
        if complete and status in ("blocked", "excluded"):
            fail(path, "blocked or excluded copy prevents completion")
        reviewed = status in ("changed", "keep")
        for axis in ("ux", "ko"):
            for i, raw in enumerate(rows(decision.get(axis), path + f".{axis}", reviewed)):
                basis = obj(raw, path + f".{axis}[{i}]")
                rule_id = string(basis.get("rule"), path + f".{axis}[{i}].rule")
                if rule_id not in rules:
                    fail(path + f".{axis}", f"unknown installed rule {rule_id!r}")
                elif rules[rule_id].get("axis") != axis:
                    fail(path + f".{axis}", f"rule {rule_id!r} belongs to the wrong axis")
                string(basis.get("reason"), path + f".{axis}[{i}].reason")
                refs(basis.get("evidence"), path + f".{axis}[{i}].evidence")
        reviews = {}
        for i, raw in enumerate(rows(decision.get("occurrence_reviews"), path + ".occurrence_reviews", reviewed)):
            review = obj(raw, path + f".occurrence_reviews[{i}]")
            oid = string(review.get("occurrence_id"), path + f".occurrence_reviews[{i}].occurrence_id")
            if oid in reviews:
                fail(path + ".occurrence_reviews", f"duplicate occurrence review {oid!r}")
            reviews[oid] = review
            refs(review.get("evidence"), path + f".occurrence_reviews[{i}].evidence")
            string(review.get("note"), path + f".occurrence_reviews[{i}].note")
        expected = set(occurrences_by_copy.get(copy_id, {}))
        if set(reviews) - expected or (reviewed and set(reviews) != expected):
            fail(path + ".occurrence_reviews", "must cover each declared usage site exactly once")

    unresolved = indexed(audit.get("unresolved"), "unresolved")
    for unresolved_id, item in unresolved.items():
        string(item.get("reason"), f"unresolved.{unresolved_id}.reason")
        refs(item.get("evidence"), f"unresolved.{unresolved_id}.evidence")
    if complete and unresolved:
        fail("unresolved", "unresolved issues prevent completion")
    return errors


def read_json(path):
    def unique_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result
    with path.open(encoding="utf-8") as stream:
        return json.load(stream, object_pairs_hook=unique_keys)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audit", type=Path, help="audit JSON produced for the target project")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--require-complete", action="store_true", help="reject partial reports")
    mode.add_argument("--diagnosis-only", action="store_true", help="check context, inventory and diagnosis before editing; skip decisions")
    parser.add_argument("--json", action="store_true", help="emit machine-readable validation results")
    args = parser.parse_args(argv)
    try:
        audit = read_json(args.audit)
        references = Path(__file__).resolve().parent.parent / "references"
        rules = read_json(references / "rules.json")
        diagnostic_catalog = read_json(references / "translationese.json")
        errors = validate(audit, rules, args.require_complete,
                          diagnostic_catalog=diagnostic_catalog, diagnosis_only=args.diagnosis_only)
    except (OSError, ValueError, RecursionError) as error:
        errors = [str(error)]
        audit = {}
    result = {
        "valid": not errors,
        "complete": not args.diagnosis_only and not errors and isinstance(audit, dict) and audit.get("complete") is True,
        "mode": "diagnosis-only" if args.diagnosis_only else "final-audit",
        "errors": errors,
        "limitation": LIMITATION,
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("PASS: declared audit contract" if not errors else "FAIL: declared audit contract")
        for error in errors:
            print(f"- {error}")
        print(LIMITATION)
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
