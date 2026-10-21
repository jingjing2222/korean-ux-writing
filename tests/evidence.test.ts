import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = process.env.KUW_BIN ?? join(ROOT, 'skills/korean-ux-writing/scripts/bin', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'kuw.exe' : 'kuw');
assert.ok(isAbsolute(BIN), 'KUW_BIN must be an absolute native executable path');
const MAX_BYTES = 2_000_000;
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'kuw-evidence-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const skill = join(directory, 'installed-skill');
  mkdirSync(skill);
  const source = join(directory, 'sources.json');
  const out = join(directory, 'cache', 'sources.json');
  const data = Buffer.from(JSON.stringify({ version: '1.0.0', sources: [{ id: 'SRC-001' }] }));
  const lock = {
    version: 1,
    evidence: {
      url: `https://raw.githubusercontent.com/owner/repo/${'a'.repeat(40)}/docs/evidence/sources.json`,
      sha256: digest(data),
    },
  };
  writeFileSync(source, data);
  return {
    directory, skill, source, out, data, lock,
    run(env: NodeJS.ProcessEnv = process.env) {
      writeFileSync(join(skill, 'sources.lock.json'), JSON.stringify(lock));
      // Every case supplies a local source: no test needs a network or a socket.
      const result = spawnSync(BIN, ['evidence', '--out', out, '--source', source, '--skill-dir', skill], {
        encoding: 'utf8', cwd: directory, env, timeout: 15_000, maxBuffer: 2_000_000,
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null, `Unexpected signal: ${result.signal}`);
      return result;
    },
  };
}

test('evidence accepts the exact pinned registry', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(readFileSync(f.out), f.data);
  assert.equal(JSON.parse(readFileSync(f.out, 'utf8')).sources[0].id, 'SRC-001');
});

test('evidence rejects changed content', t => {
  const f = fixture(t);
  writeFileSync(f.source, Buffer.concat([f.data, Buffer.from(' ')]));
  const result = f.run();
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /checksum mismatch/);
  assert.equal(existsSync(f.out), false);
});

test('evidence rejects duplicate source IDs even with a matching digest', t => {
  const f = fixture(t);
  const data = Buffer.from('{"sources":[{"id":"SRC-001"},{"id":"SRC-001"}]}');
  f.lock.evidence.sha256 = digest(data);
  writeFileSync(f.source, data);
  const result = f.run();
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /unique/);
  assert.equal(existsSync(f.out), false);
});

test('evidence rejects a mutable main URL even when using a local source', t => {
  const f = fixture(t);
  f.lock.evidence.url = 'https://raw.githubusercontent.com/owner/repo/main/docs/evidence/sources.json';
  const result = f.run();
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /fixed Git commit/);
  assert.equal(existsSync(f.out), false);
});

test('a local source cannot bypass the digest or replace a verified cache on failure', t => {
  const f = fixture(t);
  let result = f.run();
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(readFileSync(f.out), f.data);
  writeFileSync(f.source, Buffer.concat([f.data, Buffer.from(' ')]));
  result = f.run();
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /checksum mismatch/);
  assert.deepEqual(readFileSync(f.out), f.data);
});

test('evidence rejects oversized registries', t => {
  const f = fixture(t);
  const data = Buffer.alloc(MAX_BYTES + 1, ' ');
  f.lock.evidence.sha256 = digest(data);
  writeFileSync(f.source, data);
  const result = f.run();
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /size limit/);
  assert.equal(existsSync(f.out), false);
});

test('native evidence verification runs without Node or Python on PATH', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t);
  const emptyPath = join(f.directory, 'empty-path');
  mkdirSync(emptyPath);
  const result = f.run({ ...process.env, PATH: emptyPath });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(readFileSync(f.out), f.data);
});
