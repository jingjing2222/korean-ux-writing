/** Validate the declared audit contract. Never grade Korean or infer intent. */

type Row = Record<string, unknown>;
type Index = Map<string, Row>;

export const LIMITATION =
  "Checks declared coverage, references and string invariants only. " +
  "It does not prove exhaustive discovery, evidence truth, semantic preservation, " +
  "translation origin, diagnostic accuracy, review order, Korean quality, " +
  "accessibility or rendered UI behavior.";

// Match Python's Unicode \w and whitespace, rather than JavaScript's ASCII \w.
const WORD = "[\\p{L}\\p{N}_]";
const WORD_DOT = "[\\p{L}\\p{N}_.]";
const SPACE = "[\\t\\n\\v\\f\\r \\u001c-\\u001f\\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]";
const TOKEN_SOURCE =
  "\\{\\{" + SPACE + "*" + WORD_DOT + "+" + SPACE + "*\\}\\}|\\$\\{[^{}]+\\}|" +
  "\\{[A-Za-z_]" + WORD_DOT + "*\\}|\\{[0-9]+\\}|" +
  "\\{" + SPACE + "*[A-Za-z_]" + WORD_DOT + "*" + SPACE + "*," + SPACE +
  "*(?:plural|selectordinal|select|number|date|time)(?!" + WORD + ")|" +
  "%(?:\\([A-Za-z_]" + WORD_DOT + "*\\)|[0-9]+\\$)?[-+#0 ]*[0-9]*(?:\\.[0-9]+)?[sdif]";

function increment(counter: Map<string, number>, key: string, amount = 1): void {
  counter.set(key, (counter.get(key) ?? 0) + amount);
}

function count(text: string, fragment: string): number {
  if (fragment.length === 0) return [...text].length + 1;
  let total = 0;
  let start = 0;
  for (;;) {
    const found = text.indexOf(fragment, start);
    if (found < 0) return total;
    total += 1;
    start = found + fragment.length;
  }
}

/** Common interpolation tokens and ICU selectors; not a complete ICU parser. */
export function tokenSignature(text: string): Map<string, number> {
  const result = new Map<string, number>();
  const token = new RegExp(TOKEN_SOURCE, "gu");
  let match = token.exec(text);
  while (match !== null) {
    increment(result, match[0]);
    match = token.exec(text);
  }
  const header = new RegExp("\\{" + SPACE + "*(" + WORD_DOT + "+)" + SPACE + "*," + SPACE + "*(plural|selectordinal|select)" + SPACE + "*,", "gu");
  const offsetPattern = new RegExp("^" + SPACE + "*offset" + SPACE + "*:" + SPACE + "*([0-9]+)", "u");
  const branchPattern = new RegExp("^" + SPACE + "*([^" + SPACE.slice(1, -1) + "{}]+)" + SPACE + "*\\{", "u");
  let group = header.exec(text);
  while (group !== null) {
    const name = group[1];
    const kind = group[2];
    let cursor = group.index + group[0].length;
    const offset = offsetPattern.exec(text.slice(cursor));
    if (offset !== null) {
      increment(result, "ICU:" + name + ":" + kind + ":offset:" + offset[1]);
      cursor += offset[0].length;
    }
    while (cursor < text.length) {
      const branch = branchPattern.exec(text.slice(cursor));
      if (branch === null) break;
      increment(result, "ICU:" + name + ":" + kind + ":branch:" + branch[1]);
      cursor += branch[0].length;
      let depth = 1;
      const start = cursor;
      while (cursor < text.length && depth !== 0) {
        if (text[cursor] === "{") depth += 1;
        if (text[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      if (depth !== 0) {
        increment(result, "ICU:unclosed");
        break;
      }
      if (kind !== "select") increment(result, "ICU:" + name + ":" + kind + ":number-marker", count(text.slice(start, cursor - 1), "#"));
    }
    group = header.exec(text);
  }
  return result;
}

function sameCounter(left: Map<string, number>, right: Map<string, number>): boolean {
  // Python Counter treats missing and explicitly zero counts as equivalent.
  for (const [key, value] of left) if (value !== (right.get(key) ?? 0)) return false;
  for (const [key, value] of right) if (value !== (left.get(key) ?? 0)) return false;
  return true;
}

function own(row: Row, key: string): unknown {
  // JSON field names are untrusted; inherited prototype properties are not data.
  if (!Object.keys(row).includes(key)) return undefined;
  return row[key];
}

function hasOwn(row: Row, key: string): boolean {
  return Object.keys(row).includes(key);
}

function getRow(index: Index, key: string): Row {
  const value = index.get(key);
  return value === undefined ? {} : value;
}

function keys(index: Index): Set<string> {
  const result = new Set<string>();
  for (const key of index.keys()) result.add(key);
  return result;
}

function equalSets(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const key of left) if (!right.has(key)) return false;
  return true;
}

function difference(left: Set<string>, right: Set<string>): string[] {
  const result: string[] = [];
  for (const key of left) if (!right.has(key)) result.push(key);
  return result.sort();
}

function quote(value: string): string {
  return "'" + value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + "'";
}

function list(values: string[]): string {
  return "[" + values.map(quote).join(", ") + "]";
}

function reachable(seeds: Set<string>, graph: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const seed of seeds) {
    visited.add(seed);
    queue.push(seed);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const neighbors = graph.get(queue[cursor]);
    if (neighbors === undefined) continue;
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

/** Return contract errors without mutating input or reading the target project. */
export function validate(
  auditValue: unknown,
  catalogValue: unknown,
  diagnosticCatalogValue: unknown,
  requireComplete = false,
  diagnosisOnly = false,
): string[] {
  const errors: string[] = [];
  function fail(path: string, message: string): void { errors.push(path + ": " + message); }
  function obj(value: unknown, path: string): Row {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      fail(path, "must be an object");
      return {};
    }
    return value as Row;
  }
  function rows(value: unknown, path: string, nonempty: boolean): unknown[] {
    if (!Array.isArray(value)) {
      fail(path, "must be an array");
      return [];
    }
    const result = value as unknown[];
    if (nonempty && result.length === 0) fail(path, "must not be empty");
    return result;
  }
  function string(value: unknown, path: string, nonempty: boolean): string {
    if (typeof value !== "string") {
      fail(path, nonempty ? "must be a nonempty string" : "must be a string");
      return "";
    }
    const result = value as string;
    if (nonempty && new RegExp("^" + SPACE + "*$", "u").test(result)) {
      fail(path, "must be a nonempty string");
      return "";
    }
    return result;
  }
  function strings(value: unknown, path: string, nonempty: boolean): string[] {
    const values = rows(value, path, nonempty);
    const result: string[] = [];
    for (let i = 0; i < values.length; i += 1) result.push(string(values[i], path + "[" + i + "]", true));
    if (new Set(result).size !== result.length) fail(path, "contains duplicates");
    return result;
  }
  function indexed(value: unknown, path: string, nonempty: boolean): Index {
    const result = new Map<string, Row>();
    const values = rows(value, path, nonempty);
    for (let i = 0; i < values.length; i += 1) {
      const item = obj(values[i], path + "[" + i + "]");
      const key = string(own(item, "id"), path + "[" + i + "].id", true);
      if (result.has(key)) fail(path, "duplicate id " + quote(key));
      result.set(key, item);
    }
    return result;
  }

  const audit = obj(auditValue, "audit");
  const catalog = obj(catalogValue, "rules");
  const diagnosticCatalog = obj(diagnosticCatalogValue, "diagnostic_catalog");
  if (requireComplete && diagnosisOnly) fail("mode", "diagnosis_only and require_complete cannot be combined");
  if (own(audit, "version") !== 2) fail("version", "must be 2; version 1 lacks required meaning contexts and usage diagnoses");
  const complete = own(audit, "complete") === true;
  if (typeof own(audit, "complete") !== "boolean") fail("complete", "must be a boolean");
  if (requireComplete && !complete) fail("complete", "a complete report is required");

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

  const scope = obj(own(audit, "scope"), "scope");
  const files = new Set(strings(own(scope, "files"), "scope.files", true));
  const routes = new Set(strings(own(scope, "routes"), "scope.routes", true));
  const states = new Set(strings(own(scope, "states"), "scope.states", true));
  const discovery = obj(own(scope, "discovery"), "scope.discovery");
  strings(own(discovery, "methods"), "scope.discovery.methods", true);
  refs(own(discovery, "evidence"), "scope.discovery.evidence", true);
  const limitations = strings(own(discovery, "limitations"), "scope.discovery.limitations", false);
  if (complete && limitations.length > 0) fail("scope.discovery.limitations", "unverified discovery prevents completion");
  const exclusions = rows(own(scope, "exclusions"), "scope.exclusions", false);
  for (let i = 0; i < exclusions.length; i += 1) {
    const exclusion = obj(exclusions[i], "scope.exclusions[" + i + "]");
    string(own(exclusion, "target"), "scope.exclusions[" + i + "].target", true);
    string(own(exclusion, "reason"), "scope.exclusions[" + i + "].reason", true);
    refs(own(exclusion, "evidence"), "scope.exclusions[" + i + "].evidence", true);
  }
  if (complete && exclusions.length > 0) fail("scope.exclusions", "excluded scope prevents a whole-scope completion claim");

  const readFiles = new Set<string>();
  const reads = rows(own(audit, "context_reads"), "context_reads", false);
  for (let i = 0; i < reads.length; i += 1) {
    const entry = obj(reads[i], "context_reads[" + i + "]");
    const file = string(own(entry, "file"), "context_reads[" + i + "].file", true);
    refs(own(entry, "evidence"), "context_reads[" + i + "].evidence", true);
    if (readFiles.has(file)) fail("context_reads", "duplicate file " + quote(file));
    if (!files.has(file)) fail("context_reads", "file outside scope " + quote(file));
    readFiles.add(file);
  }
  if (complete && !equalSets(readFiles, files)) fail("context_reads", "unread scope files: " + list(difference(files, readFiles)));

  const funnel = obj(own(audit, "funnel"), "funnel");
  const nodes = indexed(own(funnel, "nodes"), "funnel.nodes", true);
  const edges = indexed(own(funnel, "edges"), "funnel.edges", false);
  const nodeRoutes = new Set<string>();
  const nodeStates = new Set<string>();
  for (const [id, node] of nodes) {
    const path = "funnel.nodes." + id;
    const route = string(own(node, "route"), path + ".route", true);
    const state = string(own(node, "state"), path + ".state", true);
    if (!routes.has(route) || !states.has(state)) fail(path, "route and state must be declared in scope");
    if (typeof own(node, "route") === "string") nodeRoutes.add(route);
    if (typeof own(node, "state") === "string") nodeStates.add(state);
    const kind = own(node, "kind");
    if (kind !== "entry" && kind !== "screen" && kind !== "terminal") fail(path + ".kind", "must be entry, screen or terminal");
    if (typeof own(node, "reviewed") !== "boolean") fail(path + ".reviewed", "must be a boolean");
    refs(own(node, "evidence"), path + ".evidence", own(node, "reviewed") === true);
    const contexts = new Set(strings(own(node, "context_files"), path + ".context_files", true));
    if (difference(contexts, files).length > 0) fail(path + ".context_files", "contains files outside scope");
    if (own(node, "reviewed") === true && difference(contexts, readFiles).length > 0) fail(path, "reviewed node has unread context files");
    if (complete && own(node, "reviewed") !== true) fail(path, "unreviewed node prevents completion");
  }
  if (complete) {
    if (!equalSets(nodeRoutes, routes)) fail("funnel.nodes", "not all scope routes have nodes");
    if (!equalSets(nodeStates, states)) fail("funnel.nodes", "not all scope states have nodes");
  }
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();
  for (const id of nodes.keys()) {
    forward.set(id, new Set<string>());
    reverse.set(id, new Set<string>());
  }
  for (const [id, edge] of edges) {
    const path = "funnel.edges." + id;
    const origin = string(own(edge, "from"), path + ".from", true);
    const target = string(own(edge, "to"), path + ".to", true);
    string(own(edge, "trigger"), path + ".trigger", true);
    if (!nodes.has(origin) || !nodes.has(target)) fail(path, "edge endpoints must exist");
    else {
      const next = forward.get(origin);
      const previous = reverse.get(target);
      if (next !== undefined) next.add(target);
      if (previous !== undefined) previous.add(origin);
    }
    if (typeof own(edge, "reviewed") !== "boolean") fail(path + ".reviewed", "must be a boolean");
    refs(own(edge, "evidence"), path + ".evidence", own(edge, "reviewed") === true);
    if (complete && own(edge, "reviewed") !== true) fail(path, "unreviewed transition prevents completion");
  }
  if (complete) {
    const entries = new Set<string>();
    const terminals = new Set<string>();
    for (const [id, value] of nodes) {
      if (own(value, "kind") === "entry") entries.add(id);
      if (own(value, "kind") === "terminal") terminals.add(id);
    }
    if (entries.size === 0 || terminals.size === 0) fail("funnel", "requires entry and terminal nodes");
    if (!equalSets(reachable(entries, forward), keys(nodes))) fail("funnel", "some nodes are unreachable from declared entries");
    if (!equalSets(reachable(terminals, reverse), keys(nodes))) fail("funnel", "some nodes cannot reach a declared terminal");
  }

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
  const occurrencesByCopy = new Map<string, Index>();
  for (const [copyId, item] of inventory) {
    const path = "inventory." + copyId;
    const original = string(own(item, "original"), path + ".original", true);
    const tokens = strings(own(item, "protected_tokens"), path + ".protected_tokens", false);
    for (const token of tokens) if (!original.includes(token)) fail(path + ".protected_tokens", "token absent from original: " + quote(token));
    const occurrences = indexed(own(item, "occurrences"), path + ".occurrences", true);
    occurrencesByCopy.set(copyId, occurrences);
    for (const [occurrenceId, occurrence] of occurrences) {
      const loc = path + ".occurrences." + occurrenceId;
      if (occurrenceIds.has(occurrenceId)) fail(loc, "occurrence id is not globally unique");
      occurrenceIds.add(occurrenceId);
      const nodeId = string(own(occurrence, "node_id"), loc + ".node_id", true);
      const file = string(own(occurrence, "file"), loc + ".file", true);
      const anchor = string(own(occurrence, "anchor"), loc + ".anchor", true);
      const state = string(own(occurrence, "state"), loc + ".state", true);
      const role = string(own(occurrence, "role"), loc + ".role", true);
      if (!nodes.has(nodeId)) fail(loc, "unknown node");
      else if (state !== own(getRow(nodes, nodeId), "state")) fail(loc, "state differs from node state");
      if (!files.has(file)) fail(loc, "file outside scope");
      const site = JSON.stringify([nodeId, file, anchor, state, role]);
      if (occurrenceSites.has(site)) fail(loc, "duplicate usage site across inventory");
      occurrenceSites.add(site);
    }
  }

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
  if (diagnosisOnly) return errors;

  const decisions = indexed(own(audit, "decisions"), "decisions", true);
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
    for (const axis of ["ux", "ko"]) {
      const bases = rows(own(decision, axis), path + "." + axis, reviewed);
      for (let i = 0; i < bases.length; i += 1) {
        const loc = path + "." + axis + "[" + i + "]";
        const basis = obj(bases[i], loc);
        const ruleId = string(own(basis, "rule"), loc + ".rule", true);
        if (!rules.has(ruleId)) fail(path + "." + axis, "unknown installed rule " + quote(ruleId));
        else if (own(getRow(rules, ruleId), "axis") !== axis) fail(path + "." + axis, "rule " + quote(ruleId) + " belongs to the wrong axis");
        string(own(basis, "reason"), loc + ".reason", true);
        refs(own(basis, "evidence"), loc + ".evidence", true);
      }
    }
    const reviews = new Map<string, Row>();
    const rawReviews = rows(own(decision, "occurrence_reviews"), path + ".occurrence_reviews", reviewed);
    for (let i = 0; i < rawReviews.length; i += 1) {
      const loc = path + ".occurrence_reviews[" + i + "]";
      const review = obj(rawReviews[i], loc);
      const id = string(own(review, "occurrence_id"), loc + ".occurrence_id", true);
      if (reviews.has(id)) fail(path + ".occurrence_reviews", "duplicate occurrence review " + quote(id));
      reviews.set(id, review);
      refs(own(review, "evidence"), loc + ".evidence", true);
      string(own(review, "note"), loc + ".note", true);
    }
    const expected = keys(occurrencesByCopy.get(copyId) ?? new Map<string, Row>());
    if (difference(keys(reviews), expected).length > 0 || (reviewed && !equalSets(keys(reviews), expected))) fail(path + ".occurrence_reviews", "must cover each declared usage site exactly once");
  }
  const unresolved = indexed(own(audit, "unresolved"), "unresolved", false);
  for (const [id, item] of unresolved) {
    string(own(item, "reason"), "unresolved." + id + ".reason", true);
    refs(own(item, "evidence"), "unresolved." + id + ".evidence", true);
  }
  if (complete && unresolved.size > 0) fail("unresolved", "unresolved issues prevent completion");
  return errors;
}
