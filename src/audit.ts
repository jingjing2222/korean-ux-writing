/** Compose contract checks without mutating input or reading the target project. */
import { prepareAudit } from './audit/catalog.ts';
import { validateFunnel } from './audit/funnel.ts';
import { validateInventory } from './audit/inventory.ts';
import { validateLocations } from './audit/locations.ts';
import { validatePaths } from './audit/paths.ts';
import { validateFindings } from './audit/findings.ts';
import { validateDiagnoses } from './audit/diagnoses.ts';
import { validateDecisions } from './audit/decisions.ts';

export { LIMITATION, isCompanionReference } from './audit/values.ts';
export { tokenSignature } from './audit/tokens.ts';

export function validate(
  auditValue: unknown,
  catalogValue: unknown,
  diagnosticCatalogValue: unknown,
  requireComplete = false,
  diagnosisOnly = false,
  perspectiveValue: unknown = undefined,
): string[] {
  const setup = prepareAudit(auditValue, catalogValue, diagnosticCatalogValue, requireComplete, diagnosisOnly);
  const funnel = validateFunnel(setup);
  const usages = validateInventory(setup, funnel, diagnosisOnly);
  const locations = validateLocations(setup, usages, diagnosisOnly);
  const paths = validatePaths(setup, funnel, usages, locations, perspectiveValue);
  const findings = validateFindings(setup, funnel, usages, locations, paths);
  const diagnostic = validateDiagnoses(setup, usages, paths);
  if (!diagnosisOnly) validateDecisions(setup, usages, locations, paths, findings, diagnostic);
  return setup.errors;
}
