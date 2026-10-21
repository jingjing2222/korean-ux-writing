import assert from 'node:assert/strict';

import { check, addFlowCopy, relocateExistingCopy } from "./helpers/audit.ts";

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
