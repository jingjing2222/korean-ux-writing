import assert from 'node:assert/strict';

import { check, addFlowCopy } from "./helpers/audit.ts";

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
