import assert from 'node:assert/strict';

import { check } from "./helpers/audit.ts";

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
