import assert from 'node:assert/strict';
import { rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { ROOT, fixture, check } from "./helpers/audit.ts";

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
