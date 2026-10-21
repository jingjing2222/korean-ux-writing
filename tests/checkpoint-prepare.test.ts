import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { ROOT, read, save, fixture } from "./helpers/checkpoint.ts";

test('prepare validates before writing and never overwrites an existing review', t => {
  const f = fixture(t);
  const before = readFileSync(f.source);
  assert.equal(f.prepare().status, 0);
  const report = read(join(f.out, 'audit.json'));
  assert.equal(report.complete, false);
  assert.deepEqual(report.decisions.map((row: any) => row.id), f.diagnosis.inventory.map((row: any) => row.id));
  assert.equal(report.decisions[0].before, f.diagnosis.inventory[0].original);
  assert.equal(report.decisions[0].status, undefined);
  assert.equal(report.decisions[0].after, undefined);
  assert.deepEqual(report.decisions[0].occurrence_reviews.map((row: any) => row.occurrence_id), ['saved.message', 'history.message']);
  assert.deepEqual(report.inventory, f.diagnosis.inventory);
  assert.deepEqual(readFileSync(f.source), before);
  const frozen = readFileSync(join(f.out, 'checkpoint.json'));
  assert.equal(f.prepare().status, 1);
  assert.deepEqual(readFileSync(join(f.out, 'checkpoint.json')), frozen);
});

test('prepare rejects missing context and final decisions without producing output', t => {
  const f = fixture(t);
  delete f.diagnosis.meaning_contexts;
  save(f.source, f.diagnosis);
  assert.equal(f.prepare().status, 1);
  assert.equal(existsSync(f.out), false);
  f.diagnosis = read(join(ROOT, 'evals/fixtures/minimal/audit.json'));
  f.diagnosis.complete = false;
  save(f.source, f.diagnosis);
  assert.equal(f.prepare().status, 1);
  assert.equal(existsSync(f.out), false);
});

test('prepare rejects post-edit observations as a pre-edit checkpoint', t => {
  const f = fixture(t);
  save(f.companion, f.finalPerspective);
  assert.equal(f.prepare().status, 1);
  assert.equal(existsSync(f.out), false);
});

test('prepare and checkpoint validation work without Node or Python on PATH', t => {
  const f = fixture(t);
  const emptyPath = join(f.dir, 'empty-path');
  mkdirSync(emptyPath);
  const env = { ...process.env, PATH: emptyPath, Path: emptyPath };
  const result = f.run(['prepare', f.source, '--out', f.out], env);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const report = read(join(f.out, 'audit.json'));
  Object.assign(report, { complete: true, decisions: read(join(ROOT, 'evals/fixtures/minimal/audit.json')).decisions });
  save(join(f.out, 'audit.json'), report);
  save(join(f.out, 'user-perspective.json'), f.finalPerspective);
  const checked = f.run(['audit', join(f.out, 'audit.json'), '--require-checkpoint', '--json'], env);
  assert.equal(checked.status, 0, checked.stderr + checked.stdout);
});
