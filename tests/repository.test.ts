import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkCodeLengths, lineCount } from '../scripts/code-length.ts';
import { nativeSourceDigest } from '../scripts/native-sources.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('line limits count physical lines, including comments and blank lines', () => {
  assert.equal(lineCount(''), 0);
  assert.equal(lineCount('\n'), 1);
  assert.equal(lineCount('// comment\r\n\r\ncode'), 3);
  assert.equal(lineCount('line\n'.repeat(200)), 200);
  assert.equal(lineCount('line\n'.repeat(200) + 'last'), 201);
});

test('repository check includes new code and extensionless scripts but skips ignored dependencies', t => {
  const root = mkdtempSync(join(tmpdir(), 'kuw-length-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  mkdirSync(join(root, 'node_modules'));
  writeFileSync(join(root, 'node_modules/ignored.ts'), 'x\n'.repeat(300));
  writeFileSync(join(root, 'boundary.ts'), '// comment\n'.repeat(200));
  writeFileSync(join(root, 'large test.ts'), '\n'.repeat(201));
  writeFileSync(join(root, 'runner'), '#!/bin/sh\n' + '\n'.repeat(200));
  writeFileSync(join(root, 'data.json'), '\n'.repeat(300));
  assert.deepEqual(checkCodeLengths(root), [
    'large test.ts: 201 lines exceeds the 200-line code-file limit',
    'runner: 201 lines exceeds the 200-line code-file limit',
  ]);
});

test('all repository code files stay within 200 lines', () => {
  assert.deepEqual(checkCodeLengths(ROOT), []);
});

test('native source digest automatically covers new nested modules and their paths', t => {
  const root = mkdtempSync(join(tmpdir(), 'kuw-sources-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src/nested'), { recursive: true });
  writeFileSync(join(root, 'src/cli.ts'), 'entry');
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lock');
  const original = nativeSourceDigest(root);
  writeFileSync(join(root, 'src/nested/check.ts'), 'check');
  const added = nativeSourceDigest(root);
  assert.notEqual(added, original);
  writeFileSync(join(root, 'src/nested/check.ts'), 'changed');
  assert.notEqual(nativeSourceDigest(root), added);
  rmSync(join(root, 'src/nested/check.ts'));
  writeFileSync(join(root, 'src/nested/renamed.ts'), 'check');
  assert.notEqual(nativeSourceDigest(root), added);
});
