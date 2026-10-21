import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { ROOT, read, save, fixture } from "./helpers/checkpoint.ts";

test('final audit accepts reviewed edits without rewriting the diagnosis', t => {
  const f = fixture(t);
  f.finish();
  assert.equal(f.audit().valid, true);
  // The checkpoint is self-contained after the source workspace is removed.
  rmSync(f.source);
  rmSync(f.companion);
  assert.equal(f.audit().valid, true);
});

test('checkpoint mode cannot fall back to a standalone report after references disappear', t => {
  const f = fixture(t);
  const report = f.finish();
  delete report.checkpoint_ref;
  delete report.checkpoint_sha256;
  save(join(f.out, 'audit.json'), report);
  assert.equal(f.audit().valid, false);
});

test('changing both original and diagnosis consistently cannot bypass the checkpoint', t => {
  const f = fixture(t);
  const report = f.finish();
  report.inventory[0].original = '설정 저장이 완료됐어요';
  report.translationese[0].before = report.inventory[0].original;
  report.decisions[0].before = report.inventory[0].original;
  save(join(f.out, 'audit.json'), report);
  const result = f.audit();
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error: string) => error.includes('checkpoint.inventory')));
});

test('diagnostic reasons and original expectations cannot be rewritten after preparation', t => {
  const f = fixture(t);
  const report = f.finish();
  report.translationese[0].reason = 'Changed to justify the eventual revision.';
  save(join(f.out, 'audit.json'), report);
  assert.equal(f.audit().valid, false);
  report.translationese = f.diagnosis.translationese;
  save(join(f.out, 'audit.json'), report);
  f.finalPerspective.paths[0].steps[0].before_action = 'An expectation invented after reading the result.';
  save(join(f.out, 'user-perspective.json'), f.finalPerspective);
  const result = f.audit();
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error: string) => error.includes('checkpoint.user_perspective.paths')));
});

test('checkpoint integrity and local reference boundaries are checked', t => {
  const f = fixture(t);
  const report = f.finish();
  const checkpoint = join(f.out, 'checkpoint.json');
  const bytes = readFileSync(checkpoint);
  writeFileSync(checkpoint, Buffer.concat([bytes, Buffer.from(' ')]));
  assert.equal(f.audit().valid, false);
  writeFileSync(checkpoint, bytes);
  for (const ref of ['../diagnosis.json', '/tmp/checkpoint.json', 'https://example.com/checkpoint.json']) {
    report.checkpoint_ref = ref;
    save(join(f.out, 'audit.json'), report);
    assert.equal(f.audit().valid, false);
  }
});

test('checkpoint comparison ignores JSON object key order', t => {
  const f = fixture(t);
  const report = f.finish();
  report.inventory[0] = Object.fromEntries(Object.entries(report.inventory[0]).reverse());
  save(join(f.out, 'audit.json'), report);
  assert.equal(f.audit().valid, true);
});

test('a final report cannot narrow the saved discovery scope to hide omitted work', t => {
  const f = fixture(t);
  f.diagnosis.scope.exclusions = [{ target: 'unavailable screen', reason: 'No access.', evidence: ['E-CODE'] }];
  save(f.source, f.diagnosis);
  const report = f.finish();
  report.scope.exclusions = [];
  save(join(f.out, 'audit.json'), report);
  const result = f.audit();
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error: string) => error.includes('checkpoint.scope')));
});

test('new evidence can be appended without replacing facts used for diagnosis', t => {
  const f = fixture(t);
  const report = f.finish();
  report.evidence.push({ id: 'E-NEW', kind: 'code', ref: 'copy.ts:extra', detail: 'Additional inspected fact.' });
  save(join(f.out, 'audit.json'), report);
  assert.equal(f.audit().valid, true);
  report.evidence[0].detail = 'A different fact substituted after diagnosis.';
  save(join(f.out, 'audit.json'), report);
  assert.equal(f.audit().valid, false);
});

test('complete checkpoint review rechecks each original path, not just aggregate usage', t => {
  const f = fixture(t);
  const second = structuredClone(f.perspective.paths[0]);
  second.id = 'second-entry-context';
  f.perspective.paths.push(second);
  f.finalPerspective.paths.push(second);
  save(f.companion, f.perspective);
  f.finish();
  assert.equal(f.audit().valid, false);
  const recheck = structuredClone(f.finalPerspective.recheck[0]);
  recheck.id = 'second-recheck';
  recheck.original_path_id = second.id;
  f.finalPerspective.recheck.push(recheck);
  save(join(f.out, 'user-perspective.json'), f.finalPerspective);
  assert.equal(f.audit().valid, true);
});

test('partial checkpoint review can retain unfinished rechecks honestly', t => {
  const f = fixture(t);
  const report = f.finish();
  report.complete = false;
  report.unresolved = [{ id: 'pending-recheck', reason: 'Recheck not performed.', evidence: ['E-CODE'] }];
  save(join(f.out, 'audit.json'), report);
  save(join(f.out, 'user-perspective.json'), f.perspective);
  const result = f.audit();
  assert.equal(result.valid, true);
  assert.equal(result.complete, false);
});

test('open findings are carried forward and cannot disappear when wording is finished', t => {
  const f = fixture(t);
  const finding = {
    id: 'FLOW-HISTORY', type: 'flow', node_ids: ['saved'], occurrence_ids: ['saved.action'],
    missing_context: 'The history boundary needs to be introduced before the choice.',
    first_needed: 'At the saved view before choosing the history link.', facts: ['E-CODE'],
    ux: [{ rule: 'UX-01', reason: 'Explain the destination at the point of choice.', evidence: ['E-CODE'] }],
    proposal: 'Add context before the choice.', applied_scope: 'No flow change applied.',
    remaining: 'The prerequisite is still absent.', status: 'open',
  };
  f.perspective.ux_findings.push(finding);
  save(f.companion, f.perspective);
  assert.equal(f.prepare().status, 0);
  const report = read(join(f.out, 'audit.json'));
  assert.deepEqual(report.unresolved, [{ id: finding.id, reason: finding.remaining, evidence: finding.facts }]);
  report.decisions = read(join(ROOT, 'evals/fixtures/minimal/audit.json')).decisions;
  save(join(f.out, 'audit.json'), report);
  assert.equal(f.audit().valid, true);
  report.unresolved = [];
  save(join(f.out, 'audit.json'), report);
  save(join(f.out, 'user-perspective.json'), f.finalPerspective);
  assert.equal(f.audit().valid, false);
  f.finalPerspective.ux_findings.push({ ...finding, status: 'resolved', remaining: '', applied_scope: 'Added guidance before the choice.' });
  save(join(f.out, 'user-perspective.json'), f.finalPerspective);
  assert.equal(f.audit().valid, true);
});

