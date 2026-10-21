import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills/korean-ux-writing');
const BIN = process.env.KUW_BIN ?? join(SKILL, 'scripts/bin', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'kuw.exe' : 'kuw');
assert.ok(isAbsolute(BIN), 'KUW_BIN must be an absolute native executable path');
const EXAMPLE = readFileSync(join(ROOT, 'evals/fixtures/minimal/audit.json'), 'utf8').trimEnd();

function withField(field: string): string {
  return EXAMPLE.slice(0, -1) + ',' + field + '}';
}

function run(t: TestContext, content: string | Buffer) {
  const directory = mkdtempSync(join(tmpdir(), 'kuw-json-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const report = join(directory, 'report.json');
  writeFileSync(report, content);
  copyFileSync(join(ROOT, 'evals/fixtures/minimal/user-perspective.json'), join(directory, 'user-perspective.json'));
  const result = spawnSync(BIN, ['audit', report, '--json', '--skill-dir', SKILL], {
    encoding: 'utf8', cwd: directory, timeout: 15_000, maxBuffer: 2_000_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `Parser terminated with ${result.signal}: ${result.stderr}`);
  assert.ok(result.status === 0 || result.status === 1, result.stderr + result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, result.status === 0, result.stderr + result.stdout);
  assert.ok(Array.isArray(output.errors), result.stdout);
  return { result, output };
}

function rejected(t: TestContext, content: string | Buffer, expected: RegExp): void {
  const { result, output } = run(t, content);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.equal(output.complete, false, result.stdout);
  assert.equal(output.errors.length, 1, result.stdout);
  assert.match(output.errors[0], expected);
}

test('JSON permits repeated property names in separate objects', t => {
  const { result, output } = run(t, withField('"extra":[{"value":"한국어"},{"value":"다른 문구"}]'));
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(output.errors, []);
});

test('JSON rejects escaped duplicate keys before a second value can replace a report field', t => {
  rejected(t, withField(String.raw`"\u0076ersion":2`), /duplicate JSON key: version/);
});

test('JSON rejects duplicate keys inside an otherwise unused nested object', t => {
  rejected(t, withField(String.raw`"extra":{"steps":[{"choice":"first","ch\u006fice":"second"}]}`), /duplicate JSON key: choice/);
});

test('JSON rejects invalid UTF-8 instead of silently inserting a replacement character', t => {
  const bytes = Buffer.concat([
    Buffer.from(EXAMPLE.slice(0, -1) + ',"extra":"'),
    Buffer.from([0xc3, 0x28]),
    Buffer.from('"}'),
  ]);
  rejected(t, bytes, /encoded data|utf-?8/i);
});

test('JSON rejects excessive nesting with a normal error exit', t => {
  rejected(t, withField('"extra":' + '['.repeat(4096) + 'null' + ']'.repeat(4096)), /JSON nesting exceeds/);
});

const malformed = [
  ['unfinished object', EXAMPLE.slice(0, -1)],
  ['trailing comma', withField('"extra":{"value":1,}')],
  ['trailing array comma', withField('"extra":[1,]')],
  ['invalid escape', withField(String.raw`"extra":"\q"`)],
  ['truncated Unicode escape', withField(String.raw`"extra":"\u12"`)],
  ['non-JSON number', withField('"extra":NaN')],
  ['leading zero', withField('"extra":01')],
] as const;

for (const [name, content] of malformed) {
  test(`JSON rejects ${name} without crashing`, t => {
    rejected(t, content, /JSON|Expected|Unterminated/);
  });
}

test('JSON rejects a second value after a complete audit report', t => {
  rejected(t, EXAMPLE + '\n{}', /Unexpected content after JSON value/);
});

test('JSON rejects non-whitespace trailing data after a complete audit report', t => {
  rejected(t, EXAMPLE + '\nnull garbage', /Unexpected content after JSON value/);
});
