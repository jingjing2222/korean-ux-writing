import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { isCompanionReference } from './audit.ts';
import { readJson } from './json.ts';

export type Row = Record<string, unknown>;

export function record(value: unknown, label: string): Row {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ': must be an object');
  return value as Row;
}

/** All report attachments use the same report-relative, symlink-aware boundary. */
export function attachmentPath(reportPath: string, ref: unknown, label: string): string {
  if (!isCompanionReference(ref)) throw new Error(label + ': must be a relative JSON path below the report directory without traversal');
  const directory = realpathSync(dirname(resolve(reportPath)));
  let path: string;
  try { path = realpathSync(resolve(directory, ref)); }
  catch { throw new Error(label + ': cannot read a valid UTF-8 JSON companion'); }
  const local = relative(directory, path);
  if (isAbsolute(local) || local === '..' || local.startsWith('../') || local.startsWith('..\\')) {
    throw new Error(label + ': companion must remain below the report directory after resolving symlinks');
  }
  return path;
}

export function readAttachment(reportPath: string, ref: unknown, label: string): unknown {
  const path = attachmentPath(reportPath, ref, label);
  try { return readJson(path); }
  catch { throw new Error(label + ': cannot read a valid UTF-8 JSON companion'); }
}
