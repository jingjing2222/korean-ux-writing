import { own, keys, equalSets, difference, quote, list, reachable } from "./values.ts";
import type { PrepareAudit } from "./catalog.ts";

export function validateFunnel(setup: PrepareAudit) {
  const { audit, complete, fail, obj, rows, string, strings, indexed, refs } = setup;
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

  return { files, nodes, edges };
}

export type ValidateFunnel = ReturnType<typeof validateFunnel>;
