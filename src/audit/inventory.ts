import { own, hasOwn, getRow, quote, type Row, type Index } from "./values.ts";
import type { PrepareAudit } from "./catalog.ts";
import type { ValidateFunnel } from "./funnel.ts";

export function validateInventory(setup: PrepareAudit, funnel: ValidateFunnel, diagnosisOnly: boolean) {
  const { audit, fail, string, strings, indexed, refs, bases, evidence } = setup;
  const { files, nodes } = funnel;
  const meaningContexts = indexed(own(audit, "meaning_contexts"), "meaning_contexts", true);
  for (const [id, context] of meaningContexts) {
    const path = "meaning_contexts." + id;
    const nodeId = string(own(context, "node_id"), path + ".node_id", true);
    if (!nodes.has(nodeId)) fail(path + ".node_id", "unknown node");
    for (const field of ["user_goal", "prior_context", "current_decision", "immediate_outcome", "later_outcome"]) string(own(context, field), path + "." + field, true);
    refs(own(context, "evidence"), path + ".evidence", true);
  }
  const inventory = indexed(own(audit, "inventory"), "inventory", true);
  const occurrenceIds = new Set<string>();
  const occurrenceSites = new Set<string>();
  const allOccurrences = new Map<string, Row>();
  const occurrencesByCopy = new Map<string, Index>();
  function location(occurrence: Row, loc: string, needsContext: boolean): string {
    const nodeId = string(own(occurrence, "node_id"), loc + ".node_id", true);
    const file = string(own(occurrence, "file"), loc + ".file", true);
    const anchor = string(own(occurrence, "anchor"), loc + ".anchor", true);
    const state = string(own(occurrence, "state"), loc + ".state", true);
    const role = string(own(occurrence, "role"), loc + ".role", true);
    if (!nodes.has(nodeId)) fail(loc, "unknown node");
    else if (state !== own(getRow(nodes, nodeId), "state")) fail(loc, "state differs from node state");
    if (!files.has(file)) fail(loc, "file outside scope");
    if (needsContext) {
      const contextId = string(own(occurrence, "context_id"), loc + ".context_id", true);
      const context = meaningContexts.get(contextId);
      if (context === undefined) fail(loc + ".context_id", "unknown meaning context");
      else if (own(context, "node_id") !== nodeId) fail(loc + ".context_id", "meaning context node differs from occurrence node");
    }
    return JSON.stringify([nodeId, file, anchor, state, role]);
  }
  function usages(item: Row, path: string, needsContext: boolean): Index {
    const occurrences = indexed(own(item, "occurrences"), path + ".occurrences", true);
    for (const [occurrenceId, occurrence] of occurrences) {
      const loc = path + ".occurrences." + occurrenceId;
      if (occurrenceIds.has(occurrenceId)) fail(loc, "occurrence id is not globally unique");
      occurrenceIds.add(occurrenceId);
      allOccurrences.set(occurrenceId, occurrence);
      const site = location(occurrence, loc, needsContext);
      if (occurrenceSites.has(site)) fail(loc, "duplicate usage site");
      occurrenceSites.add(site);
    }
    return occurrences;
  }
  for (const [copyId, item] of inventory) {
    const path = "inventory." + copyId;
    const original = string(own(item, "original"), path + ".original", true);
    const tokens = strings(own(item, "protected_tokens"), path + ".protected_tokens", false);
    for (const token of tokens) if (!original.includes(token)) fail(path + ".protected_tokens", "token absent from original: " + quote(token));
    occurrencesByCopy.set(copyId, usages(item, path, false));
  }
  const originalOccurrences = new Set(occurrenceIds);
  // Original locations describe the baseline; added copy occupies final sites.
  occurrenceSites.clear();
  const additions = indexed(hasOwn(audit, "additions") ? own(audit, "additions") : [], "additions", false);
  const addedOccurrences = new Set<string>();
  const occurrencesByAddition = new Map<string, Index>();
  if (diagnosisOnly && additions.size > 0) fail("additions", "new copy belongs in the final audit, not the original diagnosis");
  for (const [copyId, item] of additions) {
    const path = "additions." + copyId;
    if (inventory.has(copyId)) fail(path, "id collides with immutable inventory");
    for (const field of ["original", "before", "translationese"]) {
      if (hasOwn(item, field)) fail(path + "." + field, "new copy must not fabricate an original or diagnosis");
    }
    string(own(item, "text"), path + ".text", true);
    string(own(item, "reason"), path + ".reason", true);
    const authorization = refs(own(item, "authorization"), path + ".authorization", true);
    for (const id of authorization) {
      if (evidence.has(id) && own(getRow(evidence, id), "kind") !== "user") fail(path + ".authorization", "must reference user evidence of the requester's authorization");
    }
    for (const axis of ["ux", "ko"]) bases(own(item, axis), path + "." + axis, axis, true);
    const occurrences = usages(item, path, true);
    occurrencesByAddition.set(copyId, occurrences);
    for (const occurrenceId of occurrences.keys()) addedOccurrences.add(occurrenceId);
  }

  return { meaningContexts, inventory, allOccurrences, occurrencesByCopy, originalOccurrences, additions, addedOccurrences, occurrencesByAddition, location };
}

export type ValidateInventory = ReturnType<typeof validateInventory>;
