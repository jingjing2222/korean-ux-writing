/** Check traceability and package structure, not source truth or prose quality. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills/korean-ux-writing');
const PLUGIN_NAME = 'korean-ux-writing';
const PLUGIN_VERSION = '3.1.0';
// Skill and evidence releases can reuse the same verified native executable.
const NATIVE_TOOL_VERSION = '3.0.0';
const TARGETS = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'];
const LICENSES = ['scriptc-runtime.txt', 'v8-number-radix.txt', 'mbedtls.txt', 'quickjs-ng.txt', 'zlib.txt', 'unicode.txt', 'ryu.txt'];
const SOURCE_FILES = ['src/cli.ts', 'src/audit.ts', 'src/evidence.ts', 'src/json.ts', 'pnpm-lock.yaml'];

type Row = Record<string, unknown>;

function object(value: unknown, label: string): Row {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected an object`);
  return value as Row;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}: expected an array`);
  return value as unknown[];
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label}: expected a string`);
  return value;
}

function readJson(path: string): Row {
  return object(JSON.parse(readFileSync(path, 'utf8')) as unknown, relative(ROOT, path));
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function markdownFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(path);
  }
  return result;
}

function main(): number {
  const errors: string[] = [];
  const check = (condition: boolean, message: string): void => { if (!condition) errors.push(message); };
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== '--require-all-binaries')) throw new Error('Usage: pnpm validate [--require-all-binaries]');
  const requireAllBinaries = args.includes('--require-all-binaries');
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

  const entry = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(entry);
  check(frontmatterMatch !== null, 'Missing skill frontmatter');
  const frontmatter = frontmatterMatch?.[1] ?? '';
  check(/^name: korean-ux-writing$/m.test(frontmatter), 'Unexpected skill name');
  check(/^description: \S.+/m.test(frontmatter), 'Missing discovery description');
  const skillVersion = /^  version:\s*["']?([^"'\s]+)["']?\s*$/m.exec(frontmatter)?.[1];
  check(skillVersion === PLUGIN_VERSION, 'Skill metadata version must match the plugin release');
  const documents = [join(ROOT, 'README.md'), join(ROOT, 'README.en.md'), ...markdownFiles(SKILL), ...markdownFiles(join(ROOT, 'docs')), join(ROOT, 'evals/README.md')];
  for (const document of documents) {
    // Only Markdown link destinations are paths. Inline code examples are not links.
    const body = readFileSync(document, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '').replace(/`[^`\n]*`/g, '');
    for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const destination = match[1];
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(destination) || destination.startsWith('#')) continue;
      const target = decodeURIComponent(destination.split('#', 1)[0].replace(/^<|>$/g, ''));
      check(existsSync(resolve(dirname(document), target)), `${relative(ROOT, document)}: broken link ${destination}`);
    }
  }

  const packageInfo = readJson(join(ROOT, 'package.json'));
  check(packageInfo.version === PLUGIN_VERSION, 'Package version must match the plugin release');
  for (const file of ['plugin.json', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json']) {
    const manifest = readJson(join(ROOT, file));
    check(manifest.name === PLUGIN_NAME, `${file}: unexpected plugin identity`);
    check(manifest.version === PLUGIN_VERSION, `${file}: expected version ${PLUGIN_VERSION}`);
  }
  const codex = readJson(join(ROOT, '.codex-plugin/plugin.json'));
  check(codex.skills === './skills/' && existsSync(join(ROOT, 'skills')), 'Codex plugin must expose the existing ./skills/ directory');
  for (const file of ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json']) {
    const marketplace = readJson(join(ROOT, file));
    check(marketplace.name === PLUGIN_NAME, `${file}: unexpected marketplace identity`);
    const plugins = array(marketplace.plugins, `${file}.plugins`).map((value, index) => object(value, `${file}.plugins[${index}]`));
    check(plugins.length === 1 && plugins[0].name === PLUGIN_NAME, `${file}: expected the matching plugin identity`);
    for (const plugin of plugins) {
      if (file.startsWith('.agents/')) {
        const source = object(plugin.source, `${file}.source`);
        check(source.source === 'local' && source.path === './', `${file}: plugin source must resolve to this repository`);
      } else check(plugin.source === './', `${file}: plugin source must resolve to this repository`);
    }
  }
  const ignored = readFileSync(join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
  check(ignored.includes('!/.agents/plugins/') && ignored.includes('!/.agents/plugins/marketplace.json'), 'Gitignore must retain the Codex marketplace exceptions');
  for (const file of ['.agents/plugins/marketplace.json', 'skills/korean-ux-writing/scripts/kuw', 'skills/korean-ux-writing/scripts/kuw.cmd']) {
    check(existsSync(join(ROOT, file)), `Missing package entry: ${file}`);
  }
  const marketplaceIgnored = spawnSync('git', ['check-ignore', '--no-index', '-q', '.agents/plugins/marketplace.json'], { cwd: ROOT });
  check(marketplaceIgnored.status === 1, 'Codex marketplace must not be ignored by Git');

  const binDirectory = join(SKILL, 'scripts/bin');
  const available = existsSync(binDirectory)
    ? readdirSync(binDirectory, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name)
    : [];
  check(available.length > 0, 'At least one native platform package is required');
  for (const target of available) check(TARGETS.includes(target), `Unsupported native platform directory: ${target}`);
  if (requireAllBinaries) for (const target of TARGETS) check(available.includes(target), `Missing native platform package: ${target}`);
  const sourceDigest = createHash('sha256');
  for (const file of SOURCE_FILES) sourceDigest.update(file + '\0').update(readFileSync(join(ROOT, file)));
  const sourceSha256 = sourceDigest.digest('hex');
  for (const target of available.filter(value => TARGETS.includes(value))) {
    const directory = join(binDirectory, target);
    const manifestPath = join(directory, 'build.json');
    check(existsSync(manifestPath), `${target}: missing build.json`);
    if (!existsSync(manifestPath)) continue;
    const build = readJson(manifestPath);
    check(build.version === NATIVE_TOOL_VERSION && build.target === target && build.compiler === 'scriptc@0.4.0', `${target}: unexpected native tool version, target or compiler`);
    check(build.sourceSha256 === sourceSha256, `${target}: binary source digest differs from current source files`);
    const binary = join(directory, target.startsWith('win32-') ? 'kuw.exe' : 'kuw');
    check(existsSync(binary), `${target}: missing native executable`);
    if (existsSync(binary)) {
      check(statSync(binary).isFile() && statSync(binary).size > 0, `${target}: native executable must be a nonempty file`);
      check(build.sha256 === sha256(readFileSync(binary)), `${target}: binary SHA-256 mismatch`);
      if (process.platform !== 'win32' && !target.startsWith('win32-')) check((statSync(binary).mode & 0o111) !== 0, `${target}: native executable lacks execute permission`);
    }
    for (const name of LICENSES) {
      const path = join(directory, 'licenses', name);
      check(existsSync(path) && statSync(path).isFile() && statSync(path).size > 0, `${target}: missing runtime license ${name}`);
    }
  }

  for (const error of errors) console.error(`FAIL: ${error}`);
  if (errors.length > 0) return 1;
  console.log(`PASS: ${sources.length} sources, ${rules.length} traced rules, ${patterns.length} diagnostics, pinned evidence, plugin manifests and ${available.length} native platform package(s)`);
  console.log('This validates records and references; it does not independently verify source claims or copy quality.');
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
