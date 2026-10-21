import assert from 'node:assert/strict';

import { check } from "./helpers/audit.ts";

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
