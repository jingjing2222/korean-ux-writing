import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.sh', '.bash', '.zsh', '.cmd', '.bat', '.ps1',
  '.c', '.h', '.cpp', '.hpp', '.rs', '.go', '.swift',
]);

/** Count the final unterminated line too; a trailing newline is not another line. */
export function lineCount(content: string): number {
  if (content.length === 0) return 0;
  const lines = content.split(/\r\n|\n|\r/);
  return lines.length - (lines[lines.length - 1] === '' ? 1 : 0);
}

export function checkCodeLengths(root: string): string[] {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  const errors: string[] = [];
  for (const file of [...new Set(output.split('\0').filter(Boolean))].sort()) {
    const path = join(root, file);
    if (!existsSync(path) || !lstatSync(path).isFile()) continue;
    const extension = extname(file);
    if (extension !== '' && !CODE_EXTENSIONS.has(extension)) continue;
    const content = readFileSync(path, 'utf8');
    if (extension === '' && !content.startsWith('#!')) continue;
    const count = lineCount(content);
    if (count > 200) errors.push(`${file}: ${count} lines exceeds the 200-line code-file limit`);
  }
  return errors;
}
