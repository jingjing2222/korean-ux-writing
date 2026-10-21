import assert from 'node:assert/strict';

import { check } from "./helpers/audit.ts";

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
