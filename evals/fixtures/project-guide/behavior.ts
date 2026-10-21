// Pure source model supplied for fact checks, not a runnable CLI or browser UI.
export const initialEntry = 'renderDashboard();\n';
export const exampleStart = '// create-desk:examples:start';
export const exampleEnd = '// create-desk:examples:end';

export function canCreate(entries: string[]): boolean {
  return entries.every(entry => entry === '.git');
}

export function createProject(entries: string[]) {
  if (!canCreate(entries)) throw new Error('Directory is not empty');
  return {
    entry: initialEntry,
    page: { title: '대시보드 개발 시작하기', link: '개발 문서' },
    scripts: { dev: 'vite --open' },
    serverRunning: false,
    browserOpened: false,
  };
}

export function startDevelopment() {
  return { serverRunning: true, browserOpened: true };
}

export function addExample(entry: string, examples: string[]) {
  const start = entry.indexOf(exampleStart);
  const end = entry.indexOf(exampleEnd, start + exampleStart.length);
  const block = [exampleStart, ...examples.map(name => `showExample('${name}');`), exampleEnd].join('\n');
  if (start === -1 && end === -1) {
    if (entry !== initialEntry) throw new Error('Entry changed before the first example');
    return `${initialEntry}${block}\n`;
  }
  if (start === -1 || end === -1) throw new Error('Incomplete example markers');
  return entry.slice(0, start) + block + entry.slice(end + exampleEnd.length);
}

export function exportResult(saved: boolean, name?: string) {
  if (!saved) throw new Error('Save a result first');
  return { fileName: name ?? 'result.json', format: 'JSON' };
}
