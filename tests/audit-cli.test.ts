import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { BIN, fixture, check } from "./helpers/audit.ts";

check('malformed data returns errors without a traceback', f => {
  for (const malformed of [null, [], {}, { version: 1, complete: true, scope: [] }]) {
    f.report = malformed;
    assert.ok(f.errors().length > 0);
  }
});

check('CLI works from installed skill without repository documents and rejects duplicate keys', f => {
  writeFileSync(f.reportPath, JSON.stringify(f.report));
  let result = f.raw(['--require-complete']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(JSON.parse(result.stdout).complete, true);
  writeFileSync(f.reportPath, '{"version":1,"version":1}');
  result = f.raw(['--require-complete']);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(JSON.parse(result.stdout).errors[0], /duplicate JSON key/);
});

check('diagnosis CLI does not claim final completion', f => {
  delete f.report.decisions;
  delete f.report.unresolved;
  writeFileSync(f.reportPath, JSON.stringify(f.report));
  const result = f.raw(['--diagnosis-only']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.equal(output.complete, false);
  assert.equal(output.mode, 'diagnosis-only');
  const conflict = f.raw(['--diagnosis-only', '--require-complete']);
  assert.equal(conflict.status, 2, conflict.stderr + conflict.stdout);
  assert.match(conflict.stderr, /cannot be combined|not allowed with argument|mutually exclusive/);
});

test('native CLI reports release version', () => {
  const result = spawnSync(BIN, ['--version'], { encoding: 'utf8', timeout: 15_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout.trim(), /(?:^|\s)3\.2\.0$/);
});

test('native audit runs without Node or Python on PATH', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t);
  const emptyPath = join(f.directory, 'empty-path');
  mkdirSync(emptyPath);
  writeFileSync(f.reportPath, JSON.stringify(f.report));
  const result = f.raw(['--require-complete'], { ...process.env, PATH: emptyPath });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(JSON.parse(result.stdout).complete, true);
});
