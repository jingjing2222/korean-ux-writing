
import { check } from "./helpers/audit.ts";

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
