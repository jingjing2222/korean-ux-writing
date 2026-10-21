import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SKILL = join(ROOT, 'skills/korean-ux-writing');
export const BIN = process.env.KUW_BIN ?? join(SKILL, 'scripts/bin', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'kuw.exe' : 'kuw');
assert.ok(isAbsolute(BIN), 'KUW_BIN must be an absolute native executable path');
export const EXAMPLE = readFileSync(join(ROOT, 'evals/fixtures/minimal/audit.json'), 'utf8');
export const PERSPECTIVE = readFileSync(join(ROOT, 'evals/fixtures/minimal/user-perspective.json'), 'utf8');
export const CATALOG = {
  version: 1,
  rules: [
    ...['UX-01', 'UX-04'].map(id => ({ id, axis: 'ux', sources: ['SRC-001'] })),
    ...['KO-01', 'KO-04', 'KO-07'].map(id => ({ id, axis: 'ko', sources: ['SRC-001'] })),
  ],
};
export const DIAGNOSTIC_CATALOG = {
  patterns: [5, 1, 2, 3, 4].map(n => ({ id: `LT-${String(n).padStart(2, '0')}` })),
};

type Options = { diagnosisOnly?: boolean; requireComplete?: boolean };

export function fixture(t: TestContext) {
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

export function check(name: string, run: (f: ReturnType<typeof fixture>) => void) {
  test(name, t => run(fixture(t)));
}

export function addFlowCopy(f: ReturnType<typeof fixture>) {
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

export function relocateExistingCopy(f: ReturnType<typeof fixture>) {
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

