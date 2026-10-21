import { own, hasOwn, getRow, keys, equalSets, difference, quote, list } from "./values.ts";
import type { PrepareAudit } from "./catalog.ts";
import type { ValidateFunnel } from "./funnel.ts";
import type { ValidateInventory } from "./inventory.ts";
import type { ValidateLocations } from "./locations.ts";

export function validatePaths(setup: PrepareAudit, funnel: ValidateFunnel, usages: ValidateInventory, locations: ValidateLocations, perspectiveValue: unknown) {
  const { complete, fail, obj, rows, string, strings, indexed } = setup;
  const { nodes, edges } = funnel;
  const { allOccurrences, addedOccurrences, originalOccurrences } = usages;
  const { finalOccurrences, relocatedOccurrences } = locations;
  const perspective = obj(perspectiveValue, "user_perspective");
  if (own(perspective, "version") !== 1) fail("user_perspective.version", "must be 1");
  const method = own(perspective, "method");
  if (method !== "participant-observation" && method !== "independent-agent" && method !== "informed-expert") fail("user_perspective.method", "must be participant-observation, independent-agent or informed-expert");
  for (const field of ["task", "reviewer_knowledge"]) string(own(perspective, field), "user_perspective." + field, true);
  const perspectiveLimitations = strings(own(perspective, "limitations"), "user_perspective.limitations", false);
  if (complete && perspectiveLimitations.length > 0) fail("user_perspective.limitations", "unverified review prevents completion");
  const baselineCoverage = new Set<string>();
  const recheckCoverage = new Set<string>();
  const pathNodes = new Set<string>();
  const pathEdges = new Set<string>();
  const pathIds = new Set<string>();
  for (const collection of ["paths", "recheck"]) {
    const locations = collection === "paths" ? allOccurrences : finalOccurrences;
    const paths = indexed(own(perspective, collection), "user_perspective." + collection, false);
    for (const [pathId, entry] of paths) {
      const path = "user_perspective." + collection + "." + pathId;
      if (pathIds.has(pathId)) fail(path, "path id must be unique across paths and recheck");
      pathIds.add(pathId);
      const entryNodeId = string(own(entry, "entry_node_id"), path + ".entry_node_id", true);
      if (!nodes.has(entryNodeId) || own(getRow(nodes, entryNodeId), "kind") !== "entry") fail(path + ".entry_node_id", "must reference a declared entry node");
      const steps = indexed(own(entry, "steps"), path + ".steps", true);
      let previousNode: string | undefined;
      for (const [stepId, step] of steps) {
        const loc = path + ".steps." + stepId;
        const nodeId = string(own(step, "node_id"), loc + ".node_id", true);
        if (!nodes.has(nodeId)) fail(loc + ".node_id", "unknown node");
        else pathNodes.add(nodeId);
        if (previousNode === undefined) {
          if (nodeId !== entryNodeId) fail(loc + ".node_id", "first step must match the path entry");
          if (hasOwn(step, "via_edge_id")) fail(loc + ".via_edge_id", "first step has no incoming transition");
        } else {
          const matches: string[] = [];
          for (const [edgeId, edge] of edges) if (own(edge, "from") === previousNode && own(edge, "to") === nodeId) matches.push(edgeId);
          if (hasOwn(step, "via_edge_id")) {
            const edgeId = string(own(step, "via_edge_id"), loc + ".via_edge_id", true);
            if (!matches.includes(edgeId)) fail(loc + ".via_edge_id", "must identify the transition between adjacent steps");
            else pathEdges.add(edgeId);
          } else if (matches.length === 1) pathEdges.add(matches[0]);
          else if (matches.length === 0) fail(loc, "adjacent steps have no declared transition");
          else fail(loc + ".via_edge_id", "required to distinguish parallel transitions between adjacent steps");
        }
        previousNode = nodeId;
        const usageIds = strings(own(step, "occurrence_ids"), loc + ".occurrence_ids", false);
        for (const id of usageIds) {
          if (!locations.has(id)) fail(loc + ".occurrence_ids", "unknown occurrence " + quote(id));
          else if (own(getRow(locations, id), "node_id") !== nodeId) fail(loc + ".occurrence_ids", "occurrence node differs from step node");
          else if (collection === "paths" && addedOccurrences.has(id)) fail(loc + ".occurrence_ids", "new copy belongs in recheck, not the preserved pre-edit paths");
          else if (collection === "paths") baselineCoverage.add(id);
          else recheckCoverage.add(id);
        }
        if (complete) {
          const expected = new Set<string>();
          for (const [id, usage] of locations) {
            if (own(usage, "node_id") === nodeId && (collection === "recheck" || originalOccurrences.has(id))) expected.add(id);
          }
          if (!equalSets(new Set(usageIds), expected)) fail(loc + ".occurrence_ids", "must cover every declared usage at this node on each complete path");
        }
        const information = rows(own(step, "available_information"), loc + ".available_information", false);
        for (let i = 0; i < information.length; i += 1) {
          const infoPath = loc + ".available_information[" + i + "]";
          const info = obj(information[i], infoPath);
          string(own(info, "detail"), infoPath + ".detail", true);
          string(own(info, "ref"), infoPath + ".ref", true);
        }
        for (const field of ["before_action", "after_action"]) string(own(step, field), loc + "." + field, true);
      }
    }
  }
  if (complete) {
    if (!equalSets(baselineCoverage, originalOccurrences)) fail("user_perspective.paths", "must cover every original occurrence before completion; missing=" + list(difference(originalOccurrences, baselineCoverage)));
    if (!equalSets(pathNodes, keys(nodes))) fail("user_perspective", "paths and recheck must cover every declared node before completion");
    if (!equalSets(pathEdges, keys(edges))) fail("user_perspective", "paths and recheck must cover every declared transition before completion");
  }
  if (difference(addedOccurrences, recheckCoverage).length > 0) fail("user_perspective.recheck", "must cover every added occurrence; missing=" + list(difference(addedOccurrences, recheckCoverage)));
  if (complete && difference(relocatedOccurrences, recheckCoverage).length > 0) fail("user_perspective.recheck", "must cover every relocated occurrence at its final location before completion");

  return { perspective, baselineCoverage, recheckCoverage };
}

export type ValidatePaths = ReturnType<typeof validatePaths>;
