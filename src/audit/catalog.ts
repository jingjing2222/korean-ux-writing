import { own, getRow, keys, equalSets, difference, quote, list, isCompanionReference } from "./values.ts";
import { createChecks } from "./checks.ts";

export function prepareAudit(auditValue: unknown, catalogValue: unknown, diagnosticCatalogValue: unknown, requireComplete: boolean, diagnosisOnly: boolean) {
  const checks = createChecks();
  const { fail, obj, rows, string, strings, indexed } = checks;
  const audit = obj(auditValue, "audit");
  const catalog = obj(catalogValue, "rules");
  const diagnosticCatalog = obj(diagnosticCatalogValue, "diagnostic_catalog");
  if (requireComplete && diagnosisOnly) fail("mode", "diagnosis_only and require_complete cannot be combined");
  if (own(audit, "version") !== 2) fail("version", "must be 2; version 1 lacks required meaning contexts and usage diagnoses");
  const complete = own(audit, "complete") === true;
  if (typeof own(audit, "complete") !== "boolean") fail("complete", "must be a boolean");
  if (requireComplete && !complete) fail("complete", "a complete report is required");
  if (!isCompanionReference(own(audit, "user_perspective_ref"))) fail("user_perspective_ref", "must be a relative JSON path below the report directory without traversal");

  const rules = indexed(own(catalog, "rules"), "rules.rules", true);
  for (const [id, rule] of rules) {
    const axis = own(rule, "axis");
    if (axis !== "ux" && axis !== "ko") fail("rules." + id + ".axis", "must be ux or ko");
    strings(own(rule, "sources"), "rules." + id + ".sources", true);
  }
  const patterns = indexed(own(diagnosticCatalog, "patterns"), "diagnostic_catalog.patterns", true);
  const reviewedPatterns = new Set(strings(own(audit, "diagnostic_patterns_reviewed"), "diagnostic_patterns_reviewed", true));
  if (!equalSets(reviewedPatterns, keys(patterns))) {
    fail("diagnostic_patterns_reviewed", "must match installed diagnostic pattern ids exactly; missing=" + list(difference(keys(patterns), reviewedPatterns)) + ", extra=" + list(difference(reviewedPatterns, keys(patterns))));
  }
  const evidence = indexed(own(audit, "evidence"), "evidence", true);
  for (const [id, item] of evidence) {
    const kind = own(item, "kind");
    if (kind !== "code" && kind !== "runtime" && kind !== "spec" && kind !== "user") fail("evidence." + id + ".kind", "must be code, runtime, spec or user");
    string(own(item, "ref"), "evidence." + id + ".ref", true);
    string(own(item, "detail"), "evidence." + id + ".detail", true);
  }
  function refs(value: unknown, path: string, required: boolean): string[] {
    const ids = strings(value, path, required);
    for (const id of ids) if (!evidence.has(id)) fail(path, "unknown evidence " + quote(id));
    return ids;
  }
  function bases(value: unknown, path: string, axis: string, required: boolean): void {
    const values = rows(value, path, required);
    for (let i = 0; i < values.length; i += 1) {
      const loc = path + "[" + i + "]";
      const basis = obj(values[i], loc);
      const ruleId = string(own(basis, "rule"), loc + ".rule", true);
      if (!rules.has(ruleId)) fail(path, "unknown installed rule " + quote(ruleId));
      else if (own(getRow(rules, ruleId), "axis") !== axis) fail(path, "rule " + quote(ruleId) + " belongs to the wrong axis");
      string(own(basis, "reason"), loc + ".reason", true);
      refs(own(basis, "evidence"), loc + ".evidence", true);
    }
  }

  return { ...checks, audit, complete, patterns, evidence, refs, bases };
}

export type PrepareAudit = ReturnType<typeof prepareAudit>;
