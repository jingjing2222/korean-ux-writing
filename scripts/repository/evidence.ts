import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SKILL, object, array, text, readJson, sha256, type Check, type Row } from './context.ts';

export function validateEvidence(check: Check) {
  const sourcesPath = join(ROOT, 'docs/evidence/sources.json');
  const sourceBytes = readFileSync(sourcesPath);
  const sources = array(readJson(sourcesPath).sources, 'sources').map((value, index) => object(value, `sources[${index}]`));
  const sourceIds = sources.map(source => text(source.id, 'source.id'));
  check(sources.length >= 50, 'At least 50 Korean source records are required');
  check(sources.filter(source => source.language === 'ko').length >= 50, 'At least 50 records must have Korean source content');
  check(new Set(sourceIds).size === sourceIds.length, 'Source IDs must be unique');
  check(new Set(sources.map(source => source.url)).size === sources.length, 'Source URLs must be unique');
  const byId = new Map<string, Row>();
  const cards = readFileSync(join(ROOT, 'docs/evidence/sources.md'), 'utf8');
  for (const source of sources) {
    const id = text(source.id, 'source.id');
    byId.set(id, source);
    for (const field of ['title', 'url', 'publisher', 'kind', 'locator', 'claim', 'scope', 'limitations']) {
      const value = source[field];
      check(typeof value === 'string' && value.trim().length > 0, `${id}: missing ${field}`);
    }
    check(source.language === 'ko' || source.language === 'ko-en' || source.language === 'en', `${id}: unknown source language`);
    check(typeof source.url === 'string' && source.url.startsWith('https://'), `${id}: expected an HTTPS source`);
    const verification = object(source.verification, `${id}.verification`);
    check(verification.status === 'passage-checked' || verification.status === 'partial', `${id}: unknown verification status`);
    check(typeof verification.checked_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(verification.checked_on), `${id}: invalid check date`);
    check(cards.includes(`id="${id.toLowerCase()}"`), `${id}: missing source-card anchor`);
  }

  const rules = array(readJson(join(SKILL, 'references/rules.json')).rules, 'rules').map((value, index) => object(value, `rules[${index}]`));
  const patterns = array(readJson(join(SKILL, 'references/translationese.json')).patterns, 'patterns').map((value, index) => object(value, `patterns[${index}]`));
  check(new Set(patterns.map(pattern => pattern.id)).size === patterns.length, 'Diagnostic IDs must be unique');
  for (const pattern of patterns) {
    const id = text(pattern.id, 'pattern.id');
    const references = array(pattern.sources, `${id}.sources`);
    check(references.length > 0, `${id}: no diagnostic basis`);
    for (const reference of references) {
      const sourceId = text(reference, `${id}.sources[]`);
      const source = byId.get(sourceId);
      check(source !== undefined && object(source.verification, `${sourceId}.verification`).status === 'passage-checked', `${id}: unverified diagnostic source ${sourceId}`);
    }
  }
  check(new Set(rules.map(rule => rule.id)).size === rules.length, 'Rule IDs must be unique');
  for (const rule of rules) {
    const id = text(rule.id, 'rule.id');
    const axis = text(rule.axis, `${id}.axis`);
    check(axis === 'ux' || axis === 'ko', `${id}: unknown responsibility`);
    check(id.startsWith(axis.toUpperCase() + '-'), `${id}: mismatched responsibility`);
    const references = array(rule.sources, `${id}.sources`);
    check(references.length > 0, `${id}: no external basis`);
    for (const reference of references) {
      const sourceId = text(reference, `${id}.sources[]`);
      const source = byId.get(sourceId);
      check(source !== undefined, `${id}: unknown source ${sourceId}`);
      if (source !== undefined) check(object(source.verification, `${sourceId}.verification`).status === 'passage-checked', `${id}: partial source cannot authorize an active rule: ${sourceId}`);
    }
  }

  const lock = object(readJson(join(SKILL, 'sources.lock.json')).evidence, 'sources.lock.evidence');
  check(sha256(sourceBytes) === lock.sha256, 'Evidence digest differs from the installed lock');
  const lockUrl = text(lock.url, 'sources.lock.evidence.url');
  const url = new URL(lockUrl);
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const pinned = /^https:\/\/raw\.githubusercontent\.com\/[^/?#]+\/[^/?#]+\/[0-9a-f]{40}\/docs\/evidence\/sources\.json$/.test(lockUrl)
    && url.href === lockUrl && !url.search && !url.hash && !url.username && !url.password && !url.port;
  check(pinned, 'Evidence URL must identify a fixed Git commit and sources.json');
  if (pinned) {
    const committed = spawnSync('git', ['show', `${parts[2]}:docs/evidence/sources.json`], { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 });
    check(committed.status === 0 && committed.stdout !== null && committed.stdout.equals(sourceBytes), 'Pinned evidence commit must contain this registry (use a full clone)');
  }
  check(!existsSync(join(SKILL, 'docs')), 'Keep evidence documentation outside the skill');

  return { sources: sources.length, rules: rules.length, patterns: patterns.length };
}
