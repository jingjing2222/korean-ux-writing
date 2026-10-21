import { own, hasOwn, getRow, keys, equalSets, difference, quote, list, type Row } from "./values.ts";
import type { PrepareAudit } from "./catalog.ts";
import type { ValidateInventory } from "./inventory.ts";
import type { ValidatePaths } from "./paths.ts";

export function validateDiagnoses(setup: PrepareAudit, usages: ValidateInventory, paths: ValidatePaths) {
  const { audit, complete, fail, obj, rows, string, strings, indexed, refs, patterns } = setup;
  const { inventory, occurrencesByCopy, meaningContexts } = usages;
  const { baselineCoverage } = paths;
  const diagnoses = indexed(own(audit, "translationese"), "translationese", true);
  if (!equalSets(keys(diagnoses), keys(inventory))) fail("translationese", "must match inventory ids exactly; missing=" + list(difference(keys(inventory), keys(diagnoses))) + ", extra=" + list(difference(keys(diagnoses), keys(inventory))));
  for (const [copyId, diagnosis] of diagnoses) {
    const path = "translationese." + copyId;
    const before = string(own(diagnosis, "before"), path + ".before", true);
    if (before !== own(getRow(inventory, copyId), "original")) fail(path + ".before", "does not match immutable inventory original");
    const status = own(diagnosis, "status");
    if (status !== "candidate" && status !== "clear" && status !== "uncertain") fail(path + ".status", "must be candidate, clear or uncertain");
    const patternIds = strings(own(diagnosis, "patterns"), path + ".patterns", status === "candidate");
    for (const id of patternIds) if (!patterns.has(id)) fail(path + ".patterns", "unknown diagnostic pattern " + quote(id));
    for (const field of ["intent", "korean_fit", "reason", "exception_review"]) string(own(diagnosis, field), path + "." + field, true);
    if (hasOwn(diagnosis, "source_expression")) string(own(diagnosis, "source_expression"), path + ".source_expression", true);
    refs(own(diagnosis, "evidence"), path + ".evidence", true);
    const contextReviews = new Map<string, Row>();
    const fits: unknown[] = [];
    const occurrences = occurrencesByCopy.get(copyId) ?? new Map<string, Row>();
    const rawReviews = rows(own(diagnosis, "context_reviews"), path + ".context_reviews", true);
    for (let i = 0; i < rawReviews.length; i += 1) {
      const loc = path + ".context_reviews[" + i + "]";
      const review = obj(rawReviews[i], loc);
      const occurrenceId = string(own(review, "occurrence_id"), loc + ".occurrence_id", true);
      if (contextReviews.has(occurrenceId)) fail(path + ".context_reviews", "duplicate occurrence review " + quote(occurrenceId));
      contextReviews.set(occurrenceId, review);
      const contextId = string(own(review, "context_id"), loc + ".context_id", true);
      const context = meaningContexts.get(contextId);
      if (context === undefined) fail(loc + ".context_id", "unknown meaning context");
      else if (occurrences.has(occurrenceId) && own(context, "node_id") !== own(getRow(occurrences, occurrenceId), "node_id")) fail(loc + ".context_id", "meaning context node differs from occurrence node");
      string(own(review, "korean_reading"), loc + ".korean_reading", true);
      const fit = own(review, "fit");
      if (fit !== "fit" && fit !== "mismatch" && fit !== "uncertain") fail(loc + ".fit", "must be fit, mismatch or uncertain");
      if (occurrences.has(occurrenceId) && !baselineCoverage.has(occurrenceId) && fit !== "uncertain") fail(loc + ".fit", "usage absent from user-perspective paths must remain uncertain");
      fits.push(fit);
      string(own(review, "reason"), loc + ".reason", true);
      refs(own(review, "evidence"), loc + ".evidence", true);
    }
    if (!equalSets(keys(contextReviews), keys(occurrences))) fail(path + ".context_reviews", "must cover each declared usage site exactly once");
    if (status === "clear" && fits.some(fit => fit !== "fit")) fail(path + ".status", "clear requires fit at every usage site");
    if (status === "candidate" && (!fits.includes("mismatch") || fits.includes("uncertain"))) fail(path + ".status", "candidate requires at least one mismatch and no uncertain usage sites");
    if (status === "uncertain" && !fits.includes("uncertain")) fail(path + ".status", "uncertain requires at least one uncertain usage site");
    if (complete && status === "uncertain") fail(path, "uncertain diagnosis prevents completion");
  }
  return { diagnoses };
}

export type ValidateDiagnoses = ReturnType<typeof validateDiagnoses>;
