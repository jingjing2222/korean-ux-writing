import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(root: string, directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const file = directory + '/' + entry.name;
    if (entry.isDirectory()) result.push(...sourceFiles(root, file));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}

/** Share this inventory between builds and validation so new modules cannot drift. */
export function nativeSourceDigest(root: string): string {
  const digest = createHash('sha256');
  for (const file of [...sourceFiles(root, 'src'), 'pnpm-lock.yaml'].sort()) {
    digest.update(file + '\0').update(readFileSync(join(root, file)));
  }
  return digest.digest('hex');
}
