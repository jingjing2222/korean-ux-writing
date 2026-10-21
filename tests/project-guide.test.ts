import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addExample,
  createProject,
  exampleEnd,
  exampleStart,
  exportResult,
  startDevelopment,
} from '../evals/fixtures/project-guide/behavior.ts';

// These scenarios anchor the behavioral evaluation in executable product facts.
// They do not grade the agent's Korean copy or establish real CLI behavior.
test('project guide: creation accepts empty directories with or without Git', () => {
  assert.doesNotThrow(() => createProject([]));
  assert.doesNotThrow(() => createProject(['.git']));
  assert.throws(() => createProject(['README.md']), /Directory is not empty/);
  assert.throws(() => createProject(['.git', 'README.md']), /Directory is not empty/);
});

test('project guide: creating a page precedes starting the server and browser', () => {
  const created = createProject([]);
  assert.deepEqual(created.page, { title: '대시보드 개발 시작하기', link: '개발 문서' });
  assert.equal(created.serverRunning, false);
  assert.equal(created.browserOpened, false);
  assert.deepEqual(startDevelopment(), { serverRunning: true, browserOpened: true });
});

test('project guide: the edit-first path blocks the promised later first example', () => {
  const created = createProject([]);
  assert.match(addExample(created.entry, ['stats']), /showExample\('stats'\)/);
  const edited = `${created.entry}renderCustomPanel();\n`;
  assert.throws(() => addExample(edited, ['stats']), /Entry changed before the first example/);
});

test('project guide: later additions preserve outside edits but replace inside edits', () => {
  const first = addExample(createProject([]).entry, ['stats']);
  const prefix = 'renderHeader();\n';
  const suffix = 'renderFooter();\n';
  const edited = prefix + first.replace("showExample('stats');", 'renderCustomChart();') + suffix;
  const updated = addExample(edited, ['activity']);
  assert.equal(updated.slice(0, updated.indexOf(exampleStart)),
    edited.slice(0, edited.indexOf(exampleStart)));
  assert.equal(updated.slice(updated.indexOf(exampleEnd) + exampleEnd.length),
    edited.slice(edited.indexOf(exampleEnd) + exampleEnd.length));
  assert.match(updated, /showExample\('activity'\)/);
  assert.ok(!updated.includes('renderCustomChart();'));
  assert.ok(!updated.includes("showExample('stats');"));
});

test('project guide: incomplete markers block addition instead of inventing recovery', () => {
  const first = addExample(createProject([]).entry, ['stats']);
  for (const marker of [exampleStart, exampleEnd]) {
    assert.throws(() => addExample(first.replace(marker, ''), ['activity']));
  }
});

test('project guide: export requires a saved result but a custom filename is optional', () => {
  assert.throws(() => exportResult(false), /Save a result first/);
  assert.throws(() => exportResult(false, '2026-10-21.json'), /Save a result first/);
  assert.deepEqual(exportResult(true), { fileName: 'result.json', format: 'JSON' });
  assert.deepEqual(exportResult(true, '2026-10-21.json'), {
    fileName: '2026-10-21.json', format: 'JSON',
  });
});
