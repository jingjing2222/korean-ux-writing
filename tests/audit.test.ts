import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills/korean-ux-writing');
const BIN = process.env.KUW_BIN ?? join(SKILL, 'scripts/bin', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'kuw.exe' : 'kuw');
assert.ok(isAbsolute(BIN), 'KUW_BIN must be an absolute native executable path');
const EXAMPLE = readFileSync(join(ROOT, 'evals/fixtures/minimal/audit.json'), 'utf8');
const CATALOG = {
  version: 1,
  rules: [
    ...['UX-01', 'UX-04'].map(id => ({ id, axis: 'ux', sources: ['SRC-001'] })),
    ...['KO-01', 'KO-04', 'KO-07'].map(id => ({ id, axis: 'ko', sources: ['SRC-001'] })),
  ],
};
const DIAGNOSTIC_CATALOG = {
  patterns: [5, 1, 2, 3, 4].map(n => ({ id: `LT-${String(n).padStart(2, '0')}` })),
};

type Options = { diagnosisOnly?: boolean; requireComplete?: boolean };

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'kuw-audit-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const skill = join(directory, 'installed-skill');
  mkdirSync(join(skill, 'references'), { recursive: true });
  copyFileSync(join(SKILL, 'sources.lock.json'), join(skill, 'sources.lock.json'));
  writeFileSync(join(skill, 'references/rules.json'), JSON.stringify(CATALOG));
  writeFileSync(join(skill, 'references/translationese.json'), JSON.stringify(DIAGNOSTIC_CATALOG));
  const reportPath = join(directory, 'report.json');
  const state = {
    report: JSON.parse(EXAMPLE) as any,
    directory,
    skill,
    reportPath,
    raw(extra: string[] = [], env: NodeJS.ProcessEnv = process.env) {
      const result = spawnSync(BIN, ['audit', reportPath, '--json', '--skill-dir', skill, ...extra], {
        encoding: 'utf8', cwd: directory, env, timeout: 15_000, maxBuffer: 2_000_000,
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null, `Unexpected signal: ${result.signal}`);
      return result;
    },
    errors(options: Options = {}): string[] {
      writeFileSync(reportPath, JSON.stringify(state.report));
      const args: string[] = [];
      if (options.diagnosisOnly) args.push('--diagnosis-only');
      if (options.requireComplete) args.push('--require-complete');
      const result = state.raw(args);
      assert.ok(result.status === 0 || result.status === 1, result.stderr + result.stdout);
      const output = JSON.parse(result.stdout);
      assert.equal(output.valid, result.status === 0, result.stderr + result.stdout);
      assert.ok(Array.isArray(output.errors), result.stdout);
      assert.equal(typeof output.limitation, 'string', result.stdout);
      return output.errors;
    },
    rejected(expected: string, options: Options = {}) {
      const errors = state.errors(options);
      assert.ok(errors.some(error => error.includes(expected)), `Expected ${JSON.stringify(expected)} in ${JSON.stringify(errors)}`);
    },
    setText(before: string, after: string, protectedTokens: string[] = []) {
      Object.assign(state.report.inventory[0], { original: before, protected_tokens: protectedTokens });
      state.report.translationese[0].before = before;
      Object.assign(state.report.decisions[0], { before, after });
    },
  };
  return state;
}

function check(name: string, run: (f: ReturnType<typeof fixture>) => void) {
  test(name, t => run(fixture(t)));
}

check('complete shared copy contract passes', f => {
  assert.deepEqual(f.errors(), []);
});

check('version one reports are explicitly rejected', f => {
  f.report.version = 1;
  f.rejected('version: must be 2; version 1 lacks required meaning contexts and usage diagnoses');
});

check('meaning contexts are required before revision', f => {
  delete f.report.meaning_contexts;
  delete f.report.decisions;
  f.rejected('meaning_contexts: must be an array', { diagnosisOnly: true });
});

check('meaning context IDs and nodes must be valid', f => {
  f.report.meaning_contexts.push(structuredClone(f.report.meaning_contexts[0]));
  f.rejected('meaning_contexts: duplicate id');
  f.report.meaning_contexts.pop();
  f.report.meaning_contexts[0].node_id = 'unvisited';
  f.rejected('meaning_contexts.MC-SAVED.node_id: unknown node');
});

check('meaning context requires goal, sequence and product evidence', f => {
  const context = f.report.meaning_contexts[0];
  for (const field of ['user_goal', 'prior_context', 'current_decision', 'immediate_outcome', 'later_outcome']) {
    const original = context[field];
    delete context[field];
    f.rejected(`meaning_contexts.MC-SAVED.${field}: must be a nonempty string`);
    context[field] = original;
  }
  context.evidence = [];
  f.rejected('meaning_contexts.MC-SAVED.evidence: must not be empty');
  context.evidence = ['E-NOT-READ'];
  f.rejected('meaning_contexts.MC-SAVED.evidence: unknown evidence');
});

check('every inventory item needs exactly one diagnosis', f => {
  f.report.translationese.pop();
  f.rejected('translationese: must match inventory ids exactly');
});

check('missing diagnoses cannot pass final audit', f => {
  delete f.report.translationese;
  f.rejected('translationese: must be an array');
});

check('duplicate diagnosis IDs are rejected', f => {
  f.report.translationese.push(structuredClone(f.report.translationese[0]));
  f.rejected('translationese: duplicate id');
});

check('diagnosis original cannot be rewritten', f => {
  f.report.translationese[0].before = '이미 고친 문구';
  f.rejected('translationese.copy.saved.before: does not match immutable inventory original');
});

check('diagnosis status is required and closed', f => {
  f.report.translationese[0].status = 'improved';
  f.rejected('must be candidate, clear or uncertain');
});

check('diagnosis requires reason, exceptions and product evidence', f => {
  const diagnosis = f.report.translationese[0];
  Object.assign(diagnosis, { reason: '', exception_review: '', evidence: [] });
  for (const field of ['reason', 'exception_review', 'evidence']) f.rejected(`translationese.copy.saved.${field}: must`);
  diagnosis.evidence = ['E-NOT-READ'];
  f.rejected('unknown evidence');
});

check('every diagnostic status requires intent and Korean fit', f => {
  const diagnosis = f.report.translationese[0];
  for (const status of ['clear', 'candidate', 'uncertain']) {
    for (const field of ['intent', 'korean_fit']) {
      Object.assign(diagnosis, { status, patterns: ['LT-05'] });
      const original = diagnosis[field];
      delete diagnosis[field];
      f.rejected(`translationese.copy.saved.${field}: must be a nonempty string`);
      diagnosis[field] = ' ';
      f.rejected(`translationese.copy.saved.${field}: must be a nonempty string`);
      diagnosis[field] = original;
    }
  }
});

check('source expression is optional but nonempty when present', f => {
  assert.ok(!Object.hasOwn(f.report.translationese[0], 'source_expression'));
  assert.deepEqual(f.errors(), []);
  f.report.translationese[0].source_expression = '';
  f.rejected('source_expression: must be a nonempty string');
});

check('lexical and pragmatic pattern is part of required catalog review', f => {
  f.report.diagnostic_patterns_reviewed = f.report.diagnostic_patterns_reviewed.filter((id: string) => id !== 'LT-05');
  const errors = f.errors();
  assert.ok(errors.some(error => error.includes('missing=') && error.includes('LT-05')), JSON.stringify(errors));
});

check('candidate requires known patterns', f => {
  const diagnosis = f.report.translationese[0];
  Object.assign(diagnosis, { status: 'candidate', patterns: [] });
  diagnosis.context_reviews[0].fit = 'mismatch';
  f.report.decisions[0].diagnosis_resolution = '확인한 의미를 유지하면서 후보 표현을 수정했다.';
  f.rejected('translationese.copy.saved.patterns: must not be empty');
  diagnosis.patterns = ['LT-INVENTED'];
  f.rejected('unknown diagnostic pattern');
  diagnosis.patterns = ['LT-05'];
  assert.deepEqual(f.errors(), []);
});

check('all installed diagnostic patterns must be reviewed', f => {
  f.report.diagnostic_patterns_reviewed.pop();
  f.rejected('must match installed diagnostic pattern ids exactly');
  f.report.diagnostic_patterns_reviewed.push('LT-INVENTED');
  const errors = f.errors();
  assert.ok(errors.some(error => error.includes('extra=') && error.includes('LT-INVENTED')), JSON.stringify(errors));
});

check('uncertain diagnosis allows partial audit but prevents completion', f => {
  f.report.translationese[0].status = 'uncertain';
  f.report.translationese[0].context_reviews[0].fit = 'uncertain';
  const decision = f.report.decisions[0];
  Object.assign(decision, { status: 'blocked', after: decision.before, diagnosis_resolution: '문맥이 확인되지 않아 원문을 보류했다.' });
  f.rejected('uncertain diagnosis prevents completion');
  f.report.complete = false;
  assert.deepEqual(f.errors(), []);
});

check('every usage site needs a diagnostic context review', f => {
  f.report.translationese[0].context_reviews.pop();
  f.rejected('translationese.copy.saved.context_reviews: must cover each declared usage site exactly once', { diagnosisOnly: true });
});

check('missing diagnostic context reviews are rejected', f => {
  delete f.report.translationese[0].context_reviews;
  f.rejected('translationese.copy.saved.context_reviews: must be an array');
});

check('duplicate or foreign usage site in diagnosis is rejected', f => {
  const reviews = f.report.translationese[0].context_reviews;
  reviews.push(structuredClone(reviews[0]));
  f.rejected('duplicate occurrence review');
  reviews.pop();
  reviews[0].occurrence_id = 'saved.action';
  f.rejected('translationese.copy.saved.context_reviews: must cover each declared usage site exactly once');
});

check('diagnostic context must exist and match occurrence node', f => {
  const review = f.report.translationese[0].context_reviews[0];
  review.context_id = 'MC-NOT-READ';
  f.rejected('unknown meaning context');
  review.context_id = 'MC-HISTORY';
  f.rejected('meaning context node differs from occurrence node');
});

check('diagnostic usage review requires reading, reason and evidence', f => {
  const review = f.report.translationese[0].context_reviews[0];
  for (const field of ['korean_reading', 'reason']) {
    const original = review[field];
    delete review[field];
    f.rejected(`context_reviews[0].${field}: must be a nonempty string`);
    review[field] = original;
  }
  review.evidence = [];
  f.rejected('context_reviews[0].evidence: must not be empty');
  review.evidence = ['E-NOT-READ'];
  f.rejected('context_reviews[0].evidence: unknown evidence');
});

check('fit status is required and closed', f => {
  for (const fit of [null, 'grammatical']) {
    f.report.translationese[0].context_reviews[0].fit = fit;
    f.rejected('fit: must be fit, mismatch or uncertain');
  }
});

check('clear cannot hide a mismatch or uncertain usage', f => {
  for (const fit of ['mismatch', 'uncertain']) {
    f.report.translationese[0].context_reviews[0].fit = fit;
    f.rejected('clear requires fit at every usage site');
  }
});

check('candidate requires mismatch and cannot hide uncertainty', f => {
  const diagnosis = f.report.translationese[0];
  Object.assign(diagnosis, { status: 'candidate', patterns: ['LT-05'] });
  f.report.decisions[0].diagnosis_resolution = '확인한 문제를 수정했다.';
  f.rejected('candidate requires at least one mismatch and no uncertain usage sites');
  diagnosis.context_reviews[0].fit = 'mismatch';
  assert.deepEqual(f.errors(), []);
  diagnosis.context_reviews[1].fit = 'uncertain';
  f.rejected('candidate requires at least one mismatch and no uncertain usage sites');
});

check('uncertain requires an uncertain usage site', f => {
  f.report.translationese[0].status = 'uncertain';
  f.rejected('uncertain requires at least one uncertain usage site');
});

check('candidate final decision must explain resolution', f => {
  const diagnosis = f.report.translationese[0];
  Object.assign(diagnosis, { status: 'candidate', patterns: ['LT-05'] });
  diagnosis.context_reviews[0].fit = 'mismatch';
  assert.deepEqual(f.errors({ diagnosisOnly: true }), []);
  f.rejected('diagnosis_resolution: must be a nonempty string');
  f.report.decisions[0].diagnosis_resolution = ' ';
  f.rejected('diagnosis_resolution: must be a nonempty string');
  f.report.decisions[0].diagnosis_resolution = '확인한 의미와 어긋난 부분을 수정했다.';
  assert.deepEqual(f.errors(), []);
});

check('uncertain cannot be changed or kept even in a partial audit', f => {
  f.report.complete = false;
  const diagnosis = f.report.translationese[0];
  diagnosis.status = 'uncertain';
  diagnosis.context_reviews[0].fit = 'uncertain';
  const decision = f.report.decisions[0];
  decision.diagnosis_resolution = '아직 맥락을 확인하지 못했다.';
  for (const status of ['changed', 'keep']) {
    decision.status = status;
    f.rejected('uncertain diagnosis does not permit changed or keep');
  }
  Object.assign(decision, { status: 'blocked', after: decision.before });
  assert.deepEqual(f.errors(), []);
  delete decision.diagnosis_resolution;
  f.rejected('diagnosis_resolution: must be a nonempty string');
});

check('uncertain with mismatched usage can remain explicitly blocked', f => {
  f.report.complete = false;
  const diagnosis = f.report.translationese[0];
  Object.assign(diagnosis, { status: 'uncertain', patterns: ['LT-05'] });
  diagnosis.context_reviews[0].fit = 'mismatch';
  diagnosis.context_reviews[1].fit = 'uncertain';
  const decision = f.report.decisions[0];
  Object.assign(decision, { status: 'blocked', after: decision.before, diagnosis_resolution: '다른 사용처의 맥락을 확인하기 전까지 공유 문구를 보류했다.' });
  assert.deepEqual(f.errors(), []);
});

check('diagnosis-only passes before decisions exist', f => {
  delete f.report.decisions;
  delete f.report.unresolved;
  assert.deepEqual(f.errors({ diagnosisOnly: true }), []);
  f.rejected('decisions: must be an array');
});

check('diagnosis-only still checks context and diagnosis', f => {
  delete f.report.decisions;
  f.report.context_reads = [];
  f.report.translationese[0].patterns = ['LT-INVENTED'];
  const errors = f.errors({ diagnosisOnly: true });
  assert.ok(errors.some(error => error.includes('unread context files')), JSON.stringify(errors));
  assert.ok(errors.some(error => error.includes('unknown diagnostic pattern')), JSON.stringify(errors));
});

check('diagnosis-only cannot require final completion', f => {
  writeFileSync(f.reportPath, JSON.stringify(f.report));
  const result = f.raw(['--diagnosis-only', '--require-complete']);
  assert.equal(result.status, 2, result.stderr + result.stdout);
  assert.match(result.stderr, /cannot be combined|not allowed with argument|mutually exclusive/);
});

check('CLI uses the installed diagnostic catalog', f => {
  assert.deepEqual(f.errors({ requireComplete: true }), []);
  writeFileSync(join(f.skill, 'references/translationese.json'), JSON.stringify({ patterns: [...DIAGNOSTIC_CATALOG.patterns, { id: 'LT-NEW' }] }));
  const errors = f.errors();
  assert.ok(errors.some(error => error.includes('LT-NEW') && error.includes('missing=')), JSON.stringify(errors));
});

check('every inventory item needs exactly one decision', f => {
  f.report.decisions.pop();
  f.rejected('must match inventory ids exactly');
});

check('duplicate inventory and decision IDs are rejected', f => {
  f.report.inventory.push(structuredClone(f.report.inventory[0]));
  f.report.decisions.push(structuredClone(f.report.decisions[0]));
  f.rejected('duplicate id');
});

check('before cannot be rewritten to hide original', f => {
  f.report.decisions[0].before = '처음부터 자연스러웠어요';
  f.rejected('immutable inventory original');
});

check('shared copy requires every usage site review', f => {
  f.report.decisions[0].occurrence_reviews.pop();
  f.rejected('each declared usage site');
});

check('usage site state must match node', f => {
  f.report.inventory[0].occurrences[0].state = 'pending';
  f.rejected('state differs');
});

check('cross-inventory duplicate usage site is rejected', f => {
  const extra = structuredClone(f.report.inventory[0].occurrences[0]);
  extra.id = 'duplicate-location';
  f.report.inventory[1].occurrences.push(extra);
  f.rejected('duplicate usage site');
});

check('missing Korean basis cannot pass as UX review', f => {
  f.report.decisions[0].ko = [];
  f.rejected('ko: must not be empty');
});

check('wrong axis and invented rule are rejected', f => {
  f.report.decisions[0].ko[0].rule = 'UX-01';
  f.rejected('wrong axis');
  f.report.decisions[0].ko[0].rule = 'KO-INVENTED';
  f.rejected('unknown installed rule');
});

check('unknown product evidence is rejected', f => {
  f.report.decisions[0].ux[0].evidence = ['E-NOT-READ'];
  f.rejected('unknown evidence');
});

check('unread context blocks completion and reviewed node', f => {
  f.report.context_reads = [];
  f.rejected('unread scope files');
  f.rejected('unread context files');
});

check('disconnected funnel cannot complete', f => {
  f.report.funnel.edges = [];
  f.rejected('unreachable from declared entries');
  f.rejected('cannot reach a declared terminal');
});

check('unreviewed transition cannot complete', f => {
  f.report.funnel.edges[0].reviewed = false;
  f.rejected('unreviewed transition');
});

check('unreviewed screen cannot complete', f => {
  f.report.funnel.nodes[1].reviewed = false;
  f.rejected('unreviewed node');
});

check('declared state without node cannot complete', f => {
  f.report.scope.states.push('failed');
  f.rejected('not all scope states');
});

check('blocked copy is valid partial audit but not complete', f => {
  const decision = f.report.decisions[0];
  Object.assign(decision, { status: 'blocked', after: decision.before, ux: [], ko: [], occurrence_reviews: [] });
  f.rejected('blocked or excluded copy');
  f.report.complete = false;
  assert.deepEqual(f.errors(), []);
  assert.ok(f.errors({ requireComplete: true }).length > 0);
});

check('excluded UI cannot be hidden from completion', f => {
  f.report.scope.exclusions = [{ target: '/unvisited', reason: 'Cannot access', evidence: ['E-CODE'] }];
  f.rejected('excluded scope');
});

check('limitations and unresolved issues block completion', f => {
  f.report.scope.discovery.limitations = ['Remote copy unavailable'];
  f.report.unresolved = [{ id: 'remote', reason: 'Missing remote view', evidence: ['E-CODE'] }];
  f.rejected('unverified discovery');
  f.rejected('unresolved issues');
});

check('common placeholders can move but cannot disappear', f => {
  f.setText('{name} {{count}} ${amount} %s {0}', '{{count}} {0} %s ${amount} {name} 저장');
  assert.deepEqual(f.errors(), []);
  f.report.decisions[0].after = '{{count}} {0} %s ${amount} 저장';
  f.rejected('token multiset changed');
});

check('placeholder count is preserved', f => {
  f.setText('{name} 님 {name}', '{name} 님');
  f.rejected('token multiset changed');
});

check('explicit amount is protected by occurrence count', f => {
  f.setText('월 6,900원, 다음 달에도 6,900원', '월 6,900원', ['6,900원']);
  f.rejected('protected token changed');
});

check('ICU branches and number markers are preserved', f => {
  f.setText('{count, plural, =0 {없음} other {#개}}', '{count, plural, =0 {없어요} other {#개 있어요}}');
  assert.deepEqual(f.errors(), []);
  f.report.decisions[0].after = '{count, plural, other {#개 있어요}}';
  f.rejected('token multiset changed');
});

check('ICU select custom selector and offset are preserved', f => {
  f.setText('{kind, select, paid {결제} other {대기}}', '{kind, select, unpaid {결제} other {대기}}');
  f.rejected('token multiset changed');
  f.setText('{n, plural, offset:1 one {한 개} other {#개}}', '{n, plural, offset:2 one {한 개} other {#개}}');
  f.rejected('token multiset changed');
});

check('keep cannot change text', f => {
  f.report.decisions[1].after = '다른 화면 보기';
  f.rejected('must preserve text');
});

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
  assert.match(result.stdout.trim(), /(?:^|\s)3\.0\.0$/);
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
