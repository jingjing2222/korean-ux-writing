import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SKILL = join(ROOT, 'skills/korean-ux-writing');
export const PLUGIN_NAME = 'korean-ux-writing';
export const PLUGIN_VERSION = '3.2.0';
// Skill and evidence releases can reuse the same verified native executable.
export const NATIVE_TOOL_VERSION = '3.2.0';
export const TARGETS = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'];
export const LICENSES = ['scriptc-runtime.txt', 'v8-number-radix.txt', 'mbedtls.txt', 'quickjs-ng.txt', 'zlib.txt', 'unicode.txt', 'ryu.txt'];

export type Row = Record<string, unknown>;

export function object(value: unknown, label: string): Row {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected an object`);
  return value as Row;
}

export function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}: expected an array`);
  return value as unknown[];
}

export function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label}: expected a string`);
  return value;
}

export function readJson(path: string): Row {
  return object(JSON.parse(readFileSync(path, 'utf8')) as unknown, relative(ROOT, path));
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function markdownFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(path);
  }
  return result;
}

export type Check = (condition: boolean, message: string) => void;
