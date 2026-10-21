import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SKILL = join(ROOT, 'skills/korean-ux-writing');
const BIN = process.env.KUW_BIN ?? join(SKILL, 'scripts/bin', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'kuw.exe' : 'kuw');
export const read = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
export const save = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');

export function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'kuw-checkpoint-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, 'diagnosis.json');
  const companion = join(dir, 'user-perspective.json');
  const out = join(dir, 'revision');
  const final = read(join(ROOT, 'evals/fixtures/minimal/audit.json'));
  const finalPerspective = read(join(ROOT, 'evals/fixtures/minimal/user-perspective.json'));
  finalPerspective.recheck[0].original_path_id = finalPerspective.paths[0].id;
  const diagnosis = structuredClone(final);
  diagnosis.complete = false;
  delete diagnosis.decisions;
  delete diagnosis.unresolved;
  const perspective = structuredClone(finalPerspective);
  perspective.recheck = [];
  save(source, diagnosis);
  save(companion, perspective);
  const run = (args: string[], env = process.env) => {
    const result = spawnSync(BIN, [...args, '--skill-dir', SKILL], {
      cwd: tmpdir(), encoding: 'utf8', env, timeout: 15_000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return result;
  };
  const prepare = () => run(['prepare', source, '--out', out]);
  const finish = () => {
    const result = prepare();
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const report = read(join(out, 'audit.json'));
    Object.assign(report, { complete: true, decisions: final.decisions, unresolved: [] });
    save(join(out, 'audit.json'), report);
    save(join(out, 'user-perspective.json'), finalPerspective);
    return report;
  };
  const audit = () => {
    const result = run(['audit', join(out, 'audit.json'), '--require-checkpoint', '--json']);
    assert.ok(result.status === 0 || result.status === 1, result.stderr + result.stdout);
    return JSON.parse(result.stdout);
  };
  return { dir, source, companion, out, diagnosis, perspective, finalPerspective, run, prepare, finish, audit };
}

