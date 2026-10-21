import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DIAGNOSTIC_CATALOG, check } from "./helpers/audit.ts";

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
