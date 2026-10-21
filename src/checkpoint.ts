/** Mechanical stage handoff. Does not judge prose or attest tool-use chronology. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { validate } from './audit.ts';
import { readJson } from './json.ts';
import { attachmentPath, readAttachment, record, type Row } from './report-files.ts';

function digest(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function serialized(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

// Object key order is irrelevant; sequence order (especially path steps) is not.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const row = value as Row;
    return '{' + Object.keys(row).sort().map(key => JSON.stringify(key) + ':' + canonical(row[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'undefined';
}

function preEditErrors(diagnosis: Row, perspective: Row): string[] {
  const errors: string[] = [];
  if (diagnosis.complete !== false) errors.push('checkpoint: diagnosis must have complete: false');
  for (const field of ['decisions', 'additions']) {
    if (diagnosis[field] !== undefined && (!Array.isArray(diagnosis[field]) || (diagnosis[field] as unknown[]).length > 0)) {
      errors.push('checkpoint: ' + field + ' belong after preparation');
    }
  }
  if (!Array.isArray(perspective.recheck) || perspective.recheck.length > 0) errors.push('checkpoint: recheck belongs after preparation');
  return errors;
}

/** Validate before any write; the new directory is exclusive and never reused. */
export function prepare(diagnosisPath: string, output: string, rules: unknown, patterns: unknown): void {
  const diagnosis = record(readJson(diagnosisPath), 'diagnosis');
  const perspective = record(readAttachment(diagnosisPath, diagnosis.user_perspective_ref, 'user_perspective_ref'), 'user_perspective');
  const errors = validate(diagnosis, rules, patterns, false, true, perspective).concat(preEditErrors(diagnosis, perspective));
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const checkpoint = serialized({ version: 1, diagnosis, user_perspective: perspective });
  const report: Row = { ...diagnosis };
  report.complete = false;
  report.checkpoint_ref = 'checkpoint.json';
  report.checkpoint_sha256 = digest(checkpoint);
  report.user_perspective_ref = 'user-perspective.json';
  report.decisions = (diagnosis.inventory as unknown[]).map(value => {
    const item = record(value, 'inventory');
    return {
      id: item.id, before: item.original, ux: [], ko: [],
      occurrence_reviews: (item.occurrences as unknown[]).map(usage => ({
        occurrence_id: record(usage, 'occurrence').id, evidence: [],
      })),
    };
  });
  // Carry open findings automatically instead of relying on a second transcription.
  const unresolved = new Map<string, unknown>();
  if (Array.isArray(diagnosis.unresolved)) for (const item of diagnosis.unresolved) {
    const row = record(item, 'unresolved');
    unresolved.set(String(row.id), row);
  }
  for (const value of perspective.ux_findings as unknown[]) {
    const finding = record(value, 'ux_findings');
    if (finding.status === 'open') unresolved.set(String(finding.id), {
      id: finding.id, reason: finding.remaining, evidence: finding.facts,
    });
  }
  report.unresolved = Array.from(unresolved.values());
  mkdirSync(dirname(output), { recursive: true });
  // Do not catch a failed mkdir: an existing directory must never be removed.
  mkdirSync(output);
  try {
    writeFileSync(join(output, 'checkpoint.json'), checkpoint);
    writeFileSync(join(output, 'user-perspective.json'), serialized(perspective));
    writeFileSync(join(output, 'audit.json'), serialized(report));
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  }
}

export function validateCheckpoint(
  reportPath: string, report: Row, perspectiveValue: unknown,
  rules: unknown, patterns: unknown, required: boolean,
): string[] {
  if (!required && report.checkpoint_ref === undefined && report.checkpoint_sha256 === undefined) return [];
  const errors: string[] = [];
  try {
    const path = attachmentPath(reportPath, report.checkpoint_ref, 'checkpoint_ref');
    const bytes = readFileSync(path);
    if (typeof report.checkpoint_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(report.checkpoint_sha256)
      || digest(bytes) !== report.checkpoint_sha256) return ['checkpoint_sha256: snapshot checksum mismatch or missing digest'];
    const snapshot = record(readAttachment(reportPath, report.checkpoint_ref, 'checkpoint_ref'), 'checkpoint');
    if (snapshot.version !== 1) return ['checkpoint.version: must be 1'];
    const diagnosis = record(snapshot.diagnosis, 'checkpoint.diagnosis');
    const before = record(snapshot.user_perspective, 'checkpoint.user_perspective');
    const after = record(perspectiveValue, 'user_perspective');
    const baselineErrors = validate(diagnosis, rules, patterns, false, true, before).concat(preEditErrors(diagnosis, before));
    if (baselineErrors.length > 0) return baselineErrors.map(error => 'checkpoint.' + error);
    const equal = (left: unknown, right: unknown, label: string): void => {
      if (canonical(left) !== canonical(right)) errors.push('checkpoint.' + label + ': differs from the saved diagnosis; prepare a new checkpoint for new evidence');
    };
    const retained = (left: unknown, right: unknown, label: string, mutable: string[] = []): void => {
      if (!Array.isArray(left) || !Array.isArray(right)) {
        errors.push('checkpoint.' + label + ': expected arrays');
        return;
      }
      const current = new Map<string, Row>();
      for (const value of right) {
        const row = record(value, label);
        current.set(String(row.id), row);
      }
      for (const value of left) {
        const row = record(value, label);
        const final = current.get(String(row.id));
        if (final === undefined) errors.push('checkpoint.' + label + ': missing saved id ' + String(row.id));
        else {
          const oldFields: Row = {};
          const newFields: Row = {};
          for (const key of Object.keys(row)) if (!mutable.includes(key)) {
            oldFields[key] = row[key];
            newFields[key] = final[key];
          }
          equal(oldFields, newFields, label + '.' + String(row.id));
        }
      }
    };
    for (const field of ['inventory', 'translationese', 'diagnostic_patterns_reviewed']) equal(diagnosis[field], report[field], field);
    const oldScope = record(diagnosis.scope, 'checkpoint.scope');
    const newScope = record(report.scope, 'scope');
    for (const field of ['files', 'routes', 'states']) {
      const current = Array.isArray(newScope[field]) ? newScope[field] as unknown[] : [];
      for (const value of oldScope[field] as unknown[]) {
        if (!current.includes(value)) errors.push('checkpoint.scope.' + field + ': cannot remove a saved scope entry');
      }
    }
    equal(oldScope.exclusions, newScope.exclusions, 'scope.exclusions');
    for (const field of ['meaning_contexts', 'evidence']) retained(diagnosis[field], report[field], field);
    const oldFunnel = record(diagnosis.funnel, 'checkpoint.funnel');
    const newFunnel = record(report.funnel, 'funnel');
    for (const field of ['nodes', 'edges']) retained(oldFunnel[field], newFunnel[field], 'funnel.' + field);
    for (const field of ['method', 'task', 'reviewer_knowledge', 'paths']) equal(before[field], after[field], 'user_perspective.' + field);
    retained(before.ux_findings, after.ux_findings, 'user_perspective.ux_findings', ['proposal', 'applied_scope', 'remaining', 'status']);
    const knownPaths = new Set<string>();
    for (const value of before.paths as unknown[]) knownPaths.add(String(record(value, 'paths').id));
    const rechecked = new Set<string>();
    if (Array.isArray(after.recheck)) for (const value of after.recheck) {
      const row = record(value, 'recheck');
      if (row.original_path_id === undefined) continue; // New paths need no invented baseline.
      if (typeof row.original_path_id !== 'string' || !knownPaths.has(row.original_path_id)) errors.push('checkpoint.recheck: unknown original_path_id');
      else rechecked.add(row.original_path_id);
    }
    if (report.complete === true) for (const id of knownPaths) {
      if (!rechecked.has(id)) errors.push('checkpoint.recheck: missing original_path_id ' + id);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}
