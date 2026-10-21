import assert from 'node:assert/strict';

import { check } from "./helpers/audit.ts";

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
