import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseJson, readJson } from './json.ts';

const MAX_BYTES = 2_000_000;

function record(value: unknown, description: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object`);
  }
  return value as Record<string, unknown>;
}

function loadLock(skillDir: string): { url: string; sha256: string } {
  const lock = record(readJson(join(skillDir, 'sources.lock.json')), 'Source lock');
  const evidence = record(lock.evidence, 'Evidence lock');
  if (typeof evidence.url !== 'string' || typeof evidence.sha256 !== 'string') {
    throw new Error('Evidence lock needs a fixed URL and SHA-256 digest');
  }
  const url = evidence.url;
  if (!/^https:\/\/raw\.githubusercontent\.com\/[^/?#]+\/[^/?#]+\/[0-9a-f]{40}\/docs\/evidence\/sources\.json$/.test(url)) {
    throw new Error('Evidence URL must identify a fixed Git commit and sources.json');
  }
  const parsed = new URL(url);
  if (parsed.href !== url || parsed.search || parsed.hash || parsed.username || parsed.password || parsed.port) {
    throw new Error('Evidence URL must identify a fixed Git commit and sources.json');
  }
  if (!/^[0-9a-f]{64}$/.test(evidence.sha256)) {
    throw new Error('Evidence lock needs a SHA-256 digest');
  }
  return { url, sha256: evidence.sha256 };
}

function readLimited(path: string): Buffer {
  const file = openSync(path, 'r');
  const bytes = Buffer.alloc(MAX_BYTES + 1);
  let total = 0;
  try {
    while (total < bytes.length) {
      const count = readSync(file, bytes, total, bytes.length - total, null);
      if (count === 0) break;
      total += count;
    }
    if (total > MAX_BYTES) throw new Error('Evidence registry exceeds the size limit');
    return bytes.subarray(0, total);
  } finally {
    closeSync(file);
  }
}

async function downloadLimited(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { 'User-Agent': 'korean-ux-writing' },
    });
    if (!response.ok) throw new Error(`Evidence download failed: HTTP ${response.status}`);
    if (!response.body) throw new Error('Evidence download has no response body');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.length;
        if (total > MAX_BYTES) {
          controller.abort();
          throw new Error('Evidence registry exceeds the size limit');
        }
        chunks.push(chunk.value);
      }
      return Buffer.concat(chunks);
    } finally {
      try { await reader.cancel(); } catch { /* An aborted request is already closed. */ }
    }
  } finally {
    clearTimeout(timer);
  }
}

function verify(data: Buffer, expectedHash: string): number {
  if (data.length > MAX_BYTES) throw new Error('Evidence registry exceeds the size limit');
  if (createHash('sha256').update(data).digest('hex') !== expectedHash) {
    throw new Error('Evidence checksum mismatch; do not use an unpinned replacement');
  }
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const registry = record(parseJson(decoder.decode(data)), 'Evidence registry');
  const sources = registry.sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error('Evidence registry has no sources');
  }
  const ids = new Set<string>();
  for (const value of sources) {
    const source = record(value, 'Evidence source');
    const id = source.id;
    if (typeof id !== 'string' || id.trim().length === 0 || ids.has(id)) {
      throw new Error('Evidence registry source IDs must be unique and nonempty');
    }
    ids.add(id);
  }
  return sources.length;
}

/** Copy only the registry matching the skill's immutable URL and checksum. */
export async function fetchEvidence(skillDir: string, outPath: string, localSource: string): Promise<number> {
  const lock = loadLock(skillDir);
  const data = localSource ? readLimited(localSource) : await downloadLimited(lock.url);
  const count = verify(data, lock.sha256);
  const parent = dirname(outPath);
  mkdirSync(parent, { recursive: true });
  const temporaryDirectory = mkdtempSync(join(parent, '.evidence-'));
  const temporaryFile = join(temporaryDirectory, 'sources.json');
  try {
    writeFileSync(temporaryFile, data);
    renameSync(temporaryFile, outPath);
  } finally {
    if (existsSync(temporaryFile)) unlinkSync(temporaryFile);
    rmdirSync(temporaryDirectory);
  }
  return count;
}
