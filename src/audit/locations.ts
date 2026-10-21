import { own, hasOwn, type Row } from "./values.ts";
import type { PrepareAudit } from "./catalog.ts";
import type { ValidateInventory } from "./inventory.ts";

export function validateLocations(setup: PrepareAudit, usages: ValidateInventory, diagnosisOnly: boolean) {
  const { audit, fail, obj, indexed } = setup;
  const { allOccurrences, occurrencesByCopy, location } = usages;
  const decisions = diagnosisOnly ? new Map<string, Row>() : indexed(own(audit, "decisions"), "decisions", true);
  const finalOccurrences = new Map(allOccurrences);
  const relocatedOccurrences = new Set<string>();
  const removedOccurrences = new Set<string>();
  for (const [copyId, decision] of decisions) {
    const occurrences = occurrencesByCopy.get(copyId) ?? new Map<string, Row>();
    if (own(decision, "status") === "changed" && own(decision, "after") === "") {
      for (const id of occurrences.keys()) removedOccurrences.add(id);
    }
    const reviews = own(decision, "occurrence_reviews");
    if (!Array.isArray(reviews)) continue;
    for (let i = 0; i < reviews.length; i += 1) {
      const raw = reviews[i];
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
      const review = raw as Row;
      if (!hasOwn(review, "final_location")) continue;
      const loc = "decisions." + copyId + ".occurrence_reviews[" + i + "].final_location";
      const finalLocation = obj(own(review, "final_location"), loc);
      location(finalLocation, loc, true);
      if (own(decision, "status") !== "changed" && own(decision, "status") !== "keep") fail(loc, "blocked or excluded copy cannot declare a final relocation");
      const id = own(review, "occurrence_id");
      if (typeof id === "string" && occurrences.has(id)) {
        finalOccurrences.set(id, finalLocation);
        relocatedOccurrences.add(id);
      }
    }
  }
  const finalSites = new Set<string>();
  for (const [id, occurrence] of finalOccurrences) {
    // Removed copy remains an absence-check target, not an occupied final site.
    if (removedOccurrences.has(id)) continue;
    const site = JSON.stringify([own(occurrence, "node_id"), own(occurrence, "file"), own(occurrence, "anchor"), own(occurrence, "state"), own(occurrence, "role")]);
    if (finalSites.has(site)) fail("final_occurrences." + id, "duplicate usage site in final locations");
    finalSites.add(site);
  }

  return { decisions, finalOccurrences, relocatedOccurrences };
}

export type ValidateLocations = ReturnType<typeof validateLocations>;
