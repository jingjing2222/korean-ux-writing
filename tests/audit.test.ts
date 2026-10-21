import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills/korean-ux-writing');
const BIN = process.env.KUW_BIN ?? join(SKILL, 'scripts/bin', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'kuw.exe' : 'kuw');
assert.ok(isAbsolute(BIN), 'KUW_BIN must be an absolute native executable path');
const EXAMPLE = readFileSync(join(ROOT, 'evals/fixtures/minimal/audit.json'), 'utf8');
const PERSPECTIVE = readFileSync(join(ROOT, 'evals/fixtures/minimal/user-perspective.json'), 'utf8');
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
  const perspectivePath = join(directory, 'user-perspective.json');
  writeFileSync(perspectivePath, PERSPECTIVE);
  const state = {
    report: JSON.parse(EXAMPLE) as any,
    perspective: JSON.parse(PERSPECTIVE) as any,
    directory,
    skill,
    reportPath,
    perspectivePath,
    raw(extra: string[] = [], env: NodeJS.ProcessEnv = process.env, cwd = directory) {
      const result = spawnSync(BIN, ['audit', reportPath, '--json', '--skill-dir', skill, ...extra], {
        encoding: 'utf8', cwd, env, timeout: 15_000, maxBuffer: 2_000_000,
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null, `Unexpected signal: ${result.signal}`);
      return result;
    },
    errors(options: Options = {}): string[] {
      writeFileSync(reportPath, JSON.stringify(state.report));
      writeFileSync(perspectivePath, JSON.stringify(state.perspective));
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

function addFlowCopy(f: ReturnType<typeof fixture>) {
  f.report.evidence.push({ id: 'E-AUTH', kind: 'user', ref: 'task request', detail: 'The requester explicitly authorized adding an explanation of the existing save/history flow at its first point of need.' });
  f.perspective.ux_findings.push({
    id: 'FLOW-HISTORY', type: 'flow', node_ids: ['saved'], occurrence_ids: ['saved.action'],
    missing_context: 'The history boundary needs to be introduced before the history choice.',
    first_needed: 'At the saved view before choosing the history link.', facts: ['E-CODE'],
    ux: [{ rule: 'UX-01', reason: 'Explain the existing destination at the point of choice.', evidence: ['E-CODE'] }],
    proposal: 'Add prerequisite context before the choice.', applied_scope: 'Added source-declared context before the history action.',
    remaining: '', status: 'resolved',
  });
  const addition = {
    id: 'copy.history-context', text: '저장 기록에서 이전 결과를 확인할 수 있어요.', reason: 'Authorized prerequisite guidance at the point of choice.',
    authorization: ['E-AUTH'], finding_ids: ['FLOW-HISTORY'],
    occurrences: [{ id: 'saved.context', node_id: 'saved', file: 'copy.ts', anchor: 'views.saved.priorContext', state: 'saved', role: 'description', context_id: 'MC-SAVED' }],
    ux: [{ rule: 'UX-01', reason: 'Supplies the context required for the history choice.', evidence: ['E-CODE'] }],
    ko: [{ rule: 'KO-07', reason: 'The history/result wording fits the confirmed destination.', evidence: ['E-CODE'] }],
    occurrence_reviews: [{ occurrence_id: 'saved.context', note: 'Read with the adjacent history action in its intended order.', evidence: ['E-CODE'] }],
  };
  f.report.additions = [addition];
  f.perspective.recheck[0].steps[0].occurrence_ids.push('saved.context');
  return addition;
}

function relocateExistingCopy(f: ReturnType<typeof fixture>) {
  f.report.evidence.push({ id: 'E-MOVE', kind: 'user', ref: 'task request', detail: 'The requester authorized a guidance stage and relocation of the existing history link into it.' });
  f.report.scope.routes.push('/settings/history-intro');
  f.report.scope.states.push('history-intro');
  f.report.funnel.nodes.push({ id: 'history-intro', route: '/settings/history-intro', state: 'history-intro', kind: 'screen', reviewed: true, context_files: ['copy.ts'], evidence: ['E-CODE'] });
  f.report.funnel.edges.push(
    { id: 'open-intro', from: 'saved', to: 'history-intro', trigger: 'Open the guidance stage', reviewed: true, evidence: ['E-CODE'] },
    { id: 'continue-history', from: 'history-intro', to: 'history', trigger: 'The relocated history link', reviewed: true, evidence: ['E-CODE'] },
  );
  f.report.meaning_contexts.push({ ...f.report.meaning_contexts[0], id: 'MC-INTRO', node_id: 'history-intro', current_decision: 'Open the existing history from the authorized guidance stage.' });
  const review = f.report.decisions[1].occurrence_reviews[0];
  review.final_location = { node_id: 'history-intro', file: 'copy.ts', anchor: 'views.historyIntro.action', state: 'history-intro', role: 'link', context_id: 'MC-INTRO' };
  review.note = 'The original link text is retained at the authorized new location and still opens history.';
  review.evidence.push('E-MOVE');
  f.perspective.recheck[0].steps[0].occurrence_ids = ['saved.message'];
  f.perspective.recheck[0].steps.splice(1, 0, {
    id: 'intro-step', node_id: 'history-intro', occurrence_ids: ['saved.action'],
    available_information: [{ detail: 'The original history link is now presented in this guidance stage.', ref: 'copy.ts:views.historyIntro.action' }],
    before_action: 'The unchanged link should open the existing save history.',
    after_action: 'The relocated link opens the same existing history view.',
  });
  return review;
}

check('complete shared copy contract passes', f => {
  assert.deepEqual(f.errors(), []);
});

check('required companion cannot be omitted in final or diagnosis mode', f => {
  delete f.report.user_perspective_ref;
  for (const options of [{}, { requireComplete: true }, { diagnosisOnly: true }]) {
    f.rejected('user_perspective_ref: must be a relative JSON path', options);
  }
});

check('companion is resolved from the report directory regardless of cwd', f => {
  writeFileSync(f.reportPath, JSON.stringify(f.report));
  const result = f.raw(['--require-complete'], process.env, f.skill);
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

check('missing, invalid UTF-8 and duplicate-key companions fail without echoing their contents', f => {
  writeFileSync(f.reportPath, JSON.stringify(f.report));
  for (const content of [null, Buffer.from([0xff]), Buffer.from('{"sensitive-sentinel":1,"sensitive-sentinel":2}'), Buffer.from('{')]) {
    if (content === null) rmSync(f.perspectivePath);
    else writeFileSync(f.perspectivePath, content);
    const result = f.raw(['--require-complete']);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.complete, false);
    assert.match(output.errors.join('\n'), /cannot read a valid UTF-8 JSON companion/);
    assert.doesNotMatch(result.stdout + result.stderr, /sensitive-sentinel/);
  }
});

check('absolute, remote and traversal companion references are rejected', f => {
  for (const ref of [f.perspectivePath, '../user-perspective.json', 'nested/../user-perspective.json', 'https://example.test/user-perspective.json', 'C:\\user-perspective.json', './user-perspective.json']) {
    f.report.user_perspective_ref = ref;
    f.rejected('user_perspective_ref: must be a relative JSON path');
  }
});

test('companion symlinks cannot escape the report directory', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t);
  symlinkSync(join(ROOT, 'evals/fixtures/minimal/user-perspective.json'), join(f.directory, 'outside.json'));
  f.report.user_perspective_ref = 'outside.json';
  f.rejected('must remain below the report directory after resolving symlinks');
});

check('a placeholder companion cannot pass its structured contract', f => {
  for (const value of [null, {}, { version: 1, method: 'participant-observation', task: 'task', reviewer_knowledge: 'known', paths: 'reviewed', recheck: [], ux_findings: [], limitations: [] }]) {
    f.perspective = value;
    f.rejected('user_perspective');
  }
});

check('companion requires method, separate expectations, outcomes and information locations', f => {
  f.perspective.method = 'usability-certified';
  f.rejected('must be participant-observation, independent-agent or informed-expert');
  f.perspective.method = 'informed-expert';
  const step = f.perspective.paths[0].steps[0];
  for (const field of ['before_action', 'after_action']) {
    const original = step[field];
    step[field] = ' ';
    f.rejected(`${field}: must be a nonempty string`);
    step[field] = original;
  }
  step.available_information[0].ref = '';
  f.rejected('available_information[0].ref: must be a nonempty string');
});

check('original usage coverage cannot be supplied only by a later recheck', f => {
  f.perspective.paths[0].steps[1].occurrence_ids = [];
  f.rejected('must cover every original occurrence');
  f.rejected('usage absent from user-perspective paths must remain uncertain');
  f.report.complete = false;
  const diagnosis = f.report.translationese[0];
  diagnosis.status = 'uncertain';
  diagnosis.context_reviews[1].fit = 'uncertain';
  Object.assign(f.report.decisions[0], { status: 'blocked', after: diagnosis.before, diagnosis_resolution: 'The history path remains unreviewed.' });
  assert.deepEqual(f.errors(), []);
});

check('one entry path cannot stand in for the usage review on another path', f => {
  const direct = structuredClone(f.perspective.paths[0]);
  direct.id = 'another-declared-entry';
  direct.steps[0].occurrence_ids = [];
  f.perspective.paths.push(direct);
  f.rejected('must cover every declared usage at this node on each complete path');
});

check('companion links must identify real occurrences on their step node', f => {
  const step = f.perspective.paths[0].steps[0];
  step.occurrence_ids.push('invented');
  f.rejected("unknown occurrence 'invented'");
  step.occurrence_ids.pop();
  step.occurrence_ids.push('history.message');
  f.rejected('occurrence node differs from step node');
});

check('complete review covers every entry and transition with unambiguous ordered paths', f => {
  f.report.funnel.edges.push({ ...f.report.funnel.edges[0], id: 'alternate-history', trigger: 'an alternate history action' });
  f.rejected('required to distinguish parallel transitions');
  f.perspective.paths[0].steps[1].via_edge_id = 'open-history';
  f.perspective.recheck[0].steps[1].via_edge_id = 'open-history';
  f.rejected('must cover every declared transition');
  f.perspective.recheck[0].steps[1].via_edge_id = 'alternate-history';
  assert.deepEqual(f.errors(), []);
  f.perspective.recheck[0].entry_node_id = 'history';
  f.rejected('must reference a declared entry node');
});

check('wrong adjacent path nodes and duplicate path IDs are rejected', f => {
  f.perspective.paths[0].steps[1].node_id = 'saved';
  f.rejected('adjacent steps have no declared transition');
  f.perspective.paths[0].steps[1].node_id = 'history';
  f.perspective.recheck[0].id = f.perspective.paths[0].id;
  f.rejected('path id must be unique across paths and recheck');
});

check('unfinished user-perspective checks and missing rechecks prevent completion', f => {
  f.perspective.limitations = ['The direct-entry behavior is still unverified.'];
  f.rejected('unverified review prevents completion');
  f.perspective.limitations = [];
  f.perspective.recheck = [];
  f.rejected('changed copy requires user-perspective recheck at every usage');
});

check('authorized new flow copy preserves the original inventory and diagnosis', f => {
  const originals = structuredClone({ inventory: f.report.inventory, translationese: f.report.translationese, decisions: f.report.decisions, paths: f.perspective.paths });
  addFlowCopy(f);
  assert.deepEqual(f.errors({ requireComplete: true }), []);
  assert.deepEqual({ inventory: f.report.inventory, translationese: f.report.translationese, decisions: f.report.decisions, paths: f.perspective.paths }, originals);
  f.rejected('new copy belongs in the final audit', { diagnosisOnly: true });
});

check('new copy cannot fabricate an original or be smuggled into original diagnoses', f => {
  const addition: any = addFlowCopy(f);
  for (const field of ['original', 'before', 'translationese']) {
    addition[field] = '';
    f.rejected('new copy must not fabricate an original or diagnosis');
    delete addition[field];
  }
  f.report.translationese.push({ ...f.report.translationese[0], id: addition.id });
  f.rejected('translationese: must match inventory ids exactly');
});

check('new copy requires distinct IDs, authorization, finding, location and meaning', f => {
  const addition = addFlowCopy(f);
  const originalId = addition.id;
  addition.id = f.report.inventory[0].id;
  f.rejected('id collides with immutable inventory');
  addition.id = originalId;
  addition.authorization = ['E-CODE'];
  f.rejected("must reference user evidence of the requester's authorization");
  addition.authorization = [];
  f.rejected('authorization: must not be empty');
  addition.authorization = ['E-AUTH'];
  addition.finding_ids = ['missing'];
  f.rejected('unknown user-perspective finding');
  addition.finding_ids = ['FLOW-HISTORY'];
  addition.occurrences[0].context_id = 'MC-HISTORY';
  f.rejected('meaning context node differs from occurrence node');
  addition.occurrences[0].context_id = 'MC-SAVED';
  addition.occurrences[0].anchor = 'views.saved.action';
  addition.occurrences[0].role = 'link';
  f.rejected('duplicate usage site');
});

check('new copy needs both writing bases, all usage reviews and a separate recheck', f => {
  const addition = addFlowCopy(f);
  addition.ko = [];
  f.rejected('ko: must not be empty');
  addition.occurrence_reviews = [];
  f.rejected('must cover each declared usage site exactly once');
  f.perspective.recheck[0].steps[0].occurrence_ids = ['saved.message', 'saved.action'];
  f.rejected('must cover every added occurrence');
  f.perspective.paths[0].steps[0].occurrence_ids.push('saved.context');
  f.rejected('new copy belongs in recheck, not the preserved pre-edit paths');
});

check('open flow findings remain unresolved after adding copy', f => {
  addFlowCopy(f);
  const finding = f.perspective.ux_findings[0];
  Object.assign(finding, { status: 'open', remaining: 'The direct entry still bypasses the prerequisite guidance.' });
  f.rejected('open UX finding prevents completion');
  f.rejected('must link open user-perspective finding with the same id');
  f.report.complete = false;
  f.report.unresolved = [{ id: finding.id, reason: finding.remaining, evidence: ['E-CODE'] }];
  assert.deepEqual(f.errors(), []);
  finding.status = 'resolved';
  f.rejected('resolved findings must have no remaining issue');
});

check('a newly added stage is covered in recheck while baseline paths remain intact', f => {
  const baseline = structuredClone(f.perspective.paths);
  const addition = addFlowCopy(f);
  f.report.scope.routes.push('/settings/history-intro');
  f.report.scope.states.push('history-intro');
  f.report.funnel.nodes.push({ id: 'history-intro', route: '/settings/history-intro', state: 'history-intro', kind: 'screen', reviewed: true, context_files: ['copy.ts'], evidence: ['E-CODE'] });
  f.report.funnel.edges.push(
    { id: 'open-intro', from: 'saved', to: 'history-intro', trigger: 'Open the added guidance stage', reviewed: true, evidence: ['E-CODE'] },
    { id: 'continue-history', from: 'history-intro', to: 'history', trigger: 'Continue to history', reviewed: true, evidence: ['E-CODE'] },
  );
  f.report.meaning_contexts.push({ ...f.report.meaning_contexts[0], id: 'MC-INTRO', node_id: 'history-intro' });
  Object.assign(addition.occurrences[0], { node_id: 'history-intro', state: 'history-intro', context_id: 'MC-INTRO' });
  f.perspective.recheck[0].steps[0].occurrence_ids = ['saved.message', 'saved.action'];
  f.perspective.recheck[0].steps.splice(1, 0, {
    id: 'intro-step', node_id: 'history-intro', occurrence_ids: ['saved.context'],
    available_information: [{ detail: 'The authorized guidance appears in the new stage.', ref: 'copy.ts:views.saved.priorContext' }],
    before_action: 'The new guidance explains the history boundary before continuing.',
    after_action: 'Continuing opens the existing history view.',
  });
  assert.deepEqual(f.errors({ requireComplete: true }), []);
  assert.deepEqual(f.perspective.paths, baseline);
  f.perspective.recheck = [];
  f.rejected('paths and recheck must cover every declared node');
  f.rejected('must cover every added occurrence');
});

check('authorized relocation keeps original copy and diagnosis at their baseline locations', f => {
  const baseline = structuredClone({ inventory: f.report.inventory, translationese: f.report.translationese, paths: f.perspective.paths });
  const decision = structuredClone(f.report.decisions[1]);
  relocateExistingCopy(f);
  assert.equal(f.report.decisions[1].status, 'keep');
  assert.equal(f.report.decisions[1].id, decision.id);
  assert.equal(f.report.decisions[1].before, decision.before);
  assert.equal(f.report.decisions[1].after, decision.after);
  assert.deepEqual({ inventory: f.report.inventory, translationese: f.report.translationese, paths: f.perspective.paths }, baseline);
  assert.deepEqual(f.errors({ requireComplete: true }), []);
});

check('relocation needs a scoped final location and the meaning context of its final node', f => {
  const review = relocateExistingCopy(f);
  const location = structuredClone(review.final_location);
  delete review.final_location.context_id;
  f.rejected('final_location.context_id: must be a nonempty string');
  review.final_location.context_id = 'MC-SAVED';
  f.rejected('meaning context node differs from occurrence node');
  review.final_location = { ...location, file: 'unread.ts' };
  f.rejected('final_location: file outside scope');
  review.final_location = { ...location, state: 'saved' };
  f.rejected('final_location: state differs from node state');
  review.final_location = { ...location, node_id: 'missing' };
  f.rejected('final_location: unknown node');
  review.final_location = null;
  f.rejected('final_location: must be an object');
});

check('recheck at a baseline node cannot claim coverage of relocated copy', f => {
  relocateExistingCopy(f);
  f.perspective.recheck[0].steps[0].occurrence_ids.push('saved.action');
  f.perspective.recheck[0].steps[1].occurrence_ids = [];
  f.rejected('occurrence node differs from step node');
  f.rejected('must cover every relocated occurrence at its final location');
  f.perspective.recheck = [];
  f.rejected('must cover every relocated occurrence at its final location');
});

check('relocated copy cannot occupy another surviving final usage site', f => {
  const review = relocateExistingCopy(f);
  review.final_location = { ...f.report.inventory[0].occurrences[1], context_id: 'MC-HISTORY' };
  f.rejected('duplicate usage site in final locations');
});

check('a vacated original site can host distinct authorized new copy', f => {
  relocateExistingCopy(f);
  const addition = addFlowCopy(f);
  Object.assign(addition.occurrences[0], { anchor: 'views.saved.action', role: 'link' });
  assert.deepEqual(f.errors({ requireComplete: true }), []);
});

check('removed text is rechecked as absence at a surviving node without inventing visible copy', f => {
  const review = relocateExistingCopy(f);
  Object.assign(f.report.decisions[1], { status: 'changed', after: '', reason: 'The authorized flow removes the redundant history label.' });
  review.note = 'Verified absence of the removed label in the replacement stage; this ID remains an audit target, not visible text.';
  const step = f.perspective.recheck[0].steps[1];
  step.available_information = [];
  step.before_action = 'The replacement stage has no redundant history label; the next action follows its verified structure.';
  step.after_action = 'Verified that the removed label is absent in the replacement stage.';
  assert.deepEqual(f.errors({ requireComplete: true }), []);
  step.occurrence_ids = [];
  f.rejected('must cover every relocated occurrence at its final location');
  f.rejected('changed copy requires user-perspective recheck at every usage');
});

check('flow findings may identify missing guidance without inventing existing copy', f => {
  addFlowCopy(f);
  const finding = f.perspective.ux_findings[0];
  finding.occurrence_ids = [];
  assert.deepEqual(f.errors(), []);
  finding.node_ids = ['missing-node'];
  f.rejected("unknown node 'missing-node'");
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
  assert.match(result.stdout.trim(), /(?:^|\s)3\.0\.1$/);
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
