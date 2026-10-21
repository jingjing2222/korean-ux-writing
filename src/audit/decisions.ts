import { own, getRow, keys, equalSets, difference, quote, list, type Row, type Index } from "./values.ts";
import { count, sameCounter, tokenSignature } from "./tokens.ts";
import type { PrepareAudit } from "./catalog.ts";
import type { ValidateInventory } from "./inventory.ts";
import type { ValidateLocations } from "./locations.ts";
import type { ValidatePaths } from "./paths.ts";
import type { ValidateFindings } from "./findings.ts";
import type { ValidateDiagnoses } from "./diagnoses.ts";

export function validateDecisions(setup: PrepareAudit, usages: ValidateInventory, locations: ValidateLocations, paths: ValidatePaths, findings: ValidateFindings, diagnostic: ValidateDiagnoses) {
  const { audit, complete, fail, obj, rows, string, indexed, refs, bases } = setup;
  const { inventory, occurrencesByCopy, additions, occurrencesByAddition } = usages;
  const { decisions } = locations;
  const { recheckCoverage } = paths;
  const { openFindings } = findings;
  const { diagnoses } = diagnostic;
  if (!equalSets(keys(decisions), keys(inventory))) fail("decisions", "must match inventory ids exactly; missing=" + list(difference(keys(inventory), keys(decisions))) + ", extra=" + list(difference(keys(decisions), keys(inventory))));
  for (const [copyId, decision] of decisions) {
    const path = "decisions." + copyId;
    const status = own(decision, "status");
    if (status !== "changed" && status !== "keep" && status !== "blocked" && status !== "excluded") fail(path + ".status", "must be changed, keep, blocked or excluded");
    const before = string(own(decision, "before"), path + ".before", true);
    const after = string(own(decision, "after"), path + ".after", false);
    string(own(decision, "reason"), path + ".reason", true);
    const diagnosisStatus = own(getRow(diagnoses, copyId), "status");
    if (diagnosisStatus === "candidate" || diagnosisStatus === "uncertain") string(own(decision, "diagnosis_resolution"), path + ".diagnosis_resolution", true);
    if (diagnosisStatus === "uncertain" && (status === "changed" || status === "keep")) fail(path + ".status", "uncertain diagnosis does not permit changed or keep; update the diagnosis with new evidence first");
    const item = getRow(inventory, copyId);
    if (before !== own(item, "original")) fail(path + ".before", "does not match immutable inventory original");
    if (status === "changed" && before === after) fail(path, "changed decision must change the text");
    if ((status === "keep" || status === "blocked" || status === "excluded") && before !== after) fail(path, "keep, blocked and excluded decisions must preserve text");
    if (!sameCounter(tokenSignature(before), tokenSignature(after))) fail(path, "placeholder/interpolation token multiset changed");
    const rawTokens = own(item, "protected_tokens");
    if (Array.isArray(rawTokens)) {
      for (const token of rawTokens as unknown[]) {
        if (typeof token === "string" && count(before, token as string) !== count(after, token as string)) fail(path, "protected token changed: " + quote(token as string));
      }
    }
    if (complete && (status === "blocked" || status === "excluded")) fail(path, "blocked or excluded copy prevents completion");
    const reviewed = status === "changed" || status === "keep";
    for (const axis of ["ux", "ko"]) bases(own(decision, axis), path + "." + axis, axis, reviewed);
    reviewOccurrences(decision, path, occurrencesByCopy.get(copyId) ?? new Map<string, Row>(), reviewed);
    if (complete && status === "changed") {
      const expected = keys(occurrencesByCopy.get(copyId) ?? new Map<string, Row>());
      if (difference(expected, recheckCoverage).length > 0) fail(path, "changed copy requires user-perspective recheck at every usage before completion");
    }
  }
  function reviewOccurrences(item: Row, path: string, occurrences: Index, required: boolean): void {
    const reviews = new Map<string, Row>();
    const rawReviews = rows(own(item, "occurrence_reviews"), path + ".occurrence_reviews", required);
    for (let i = 0; i < rawReviews.length; i += 1) {
      const loc = path + ".occurrence_reviews[" + i + "]";
      const review = obj(rawReviews[i], loc);
      const id = string(own(review, "occurrence_id"), loc + ".occurrence_id", true);
      if (reviews.has(id)) fail(path + ".occurrence_reviews", "duplicate occurrence review " + quote(id));
      reviews.set(id, review);
      refs(own(review, "evidence"), loc + ".evidence", true);
      string(own(review, "note"), loc + ".note", true);
    }
    const expected = keys(occurrences);
    if (difference(keys(reviews), expected).length > 0 || (required && !equalSets(keys(reviews), expected))) fail(path + ".occurrence_reviews", "must cover each declared usage site exactly once");
  }
  for (const [id, addition] of additions) reviewOccurrences(addition, "additions." + id, occurrencesByAddition.get(id) ?? new Map<string, Row>(), true);
  const unresolved = indexed(own(audit, "unresolved"), "unresolved", false);
  for (const [id, item] of unresolved) {
    string(own(item, "reason"), "unresolved." + id + ".reason", true);
    refs(own(item, "evidence"), "unresolved." + id + ".evidence", true);
  }
  for (const id of openFindings) if (!unresolved.has(id)) fail("unresolved", "must link open user-perspective finding with the same id: " + quote(id));
  if (complete && unresolved.size > 0) fail("unresolved", "unresolved issues prevent completion");
}

export type ValidateDecisions = ReturnType<typeof validateDecisions>;
