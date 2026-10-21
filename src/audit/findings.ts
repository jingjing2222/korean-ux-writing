import { own, getRow, quote } from "./values.ts";
import type { PrepareAudit } from "./catalog.ts";
import type { ValidateFunnel } from "./funnel.ts";
import type { ValidateInventory } from "./inventory.ts";
import type { ValidateLocations } from "./locations.ts";
import type { ValidatePaths } from "./paths.ts";

export function validateFindings(setup: PrepareAudit, funnel: ValidateFunnel, usages: ValidateInventory, locations: ValidateLocations, paths: ValidatePaths) {
  const { complete, fail, string, strings, indexed, refs, bases } = setup;
  const { nodes } = funnel;
  const { allOccurrences, additions } = usages;
  const { finalOccurrences } = locations;
  const { perspective } = paths;
  const findings = indexed(own(perspective, "ux_findings"), "user_perspective.ux_findings", false);
  const openFindings = new Set<string>();
  for (const [id, finding] of findings) {
    const path = "user_perspective.ux_findings." + id;
    const type = own(finding, "type");
    if (type !== "copy" && type !== "flow" && type !== "mixed") fail(path + ".type", "must be copy, flow or mixed");
    const nodeIds = new Set(strings(own(finding, "node_ids"), path + ".node_ids", true));
    for (const nodeId of nodeIds) if (!nodes.has(nodeId)) fail(path + ".node_ids", "unknown node " + quote(nodeId));
    const usageIds = strings(own(finding, "occurrence_ids"), path + ".occurrence_ids", false);
    for (const usageId of usageIds) {
      const usage = allOccurrences.get(usageId);
      if (usage === undefined) fail(path + ".occurrence_ids", "unknown occurrence " + quote(usageId));
      else if (!nodeIds.has(String(own(usage, "node_id"))) && !nodeIds.has(String(own(getRow(finalOccurrences, usageId), "node_id")))) fail(path + ".occurrence_ids", "baseline or final occurrence node must be included in finding node_ids");
    }
    for (const field of ["missing_context", "first_needed", "proposal", "applied_scope"]) string(own(finding, field), path + "." + field, true);
    refs(own(finding, "facts"), path + ".facts", true);
    bases(own(finding, "ux"), path + ".ux", "ux", true);
    const status = own(finding, "status");
    if (status !== "open" && status !== "resolved") fail(path + ".status", "must be open or resolved");
    const remaining = string(own(finding, "remaining"), path + ".remaining", status === "open");
    if (status === "resolved" && remaining !== "") fail(path + ".remaining", "resolved findings must have no remaining issue");
    if (status === "open") {
      openFindings.add(id);
      if (complete) fail(path, "open UX finding prevents completion");
    }
  }
  for (const [id, addition] of additions) {
    const path = "additions." + id + ".finding_ids";
    const ids = strings(own(addition, "finding_ids"), path, true);
    for (const findingId of ids) {
      if (!findings.has(findingId)) fail(path, "unknown user-perspective finding " + quote(findingId));
      else {
        const type = own(getRow(findings, findingId), "type");
        if (type !== "flow" && type !== "mixed") fail(path, "added flow copy must link a flow or mixed finding");
      }
    }
  }

  return { openFindings };
}

export type ValidateFindings = ReturnType<typeof validateFindings>;
