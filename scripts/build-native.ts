import { mkdirSync, readFileSync, readdirSync, chmodSync, statSync, cpSync, writeFileSync, realpathSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { nativeSourceDigest } from './native-sources.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Independent of the plugin release: docs and skills need no native rebuild.
const NATIVE_TOOL_VERSION = '3.2.0';
const supported = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'];
const host = `${process.platform}-${process.arch}`;
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--target')) throw new Error('Usage: pnpm build [--target <platform-arch>]');
const target = args[1] ?? host;
if (!supported.includes(target)) throw new Error(`Unsupported build target: ${target}`);
const cross = target !== host;
const platform = target.split('-')[0];
const triples: Record<string, string> = {
  'darwin-arm64': 'aarch64-macos', 'darwin-x64': 'x86_64-macos',
  'linux-arm64': 'aarch64-linux-gnu', 'linux-x64': 'x86_64-linux-gnu',
  'win32-x64': 'x86_64-windows-gnu',
};
// Cross builds use an explicitly supplied, version-matched runtime pack and linker.
const runtimePack = process.env.SCRIPTC_RUNTIME_PACK;
if (cross && !runtimePack) throw new Error('Cross builds require SCRIPTC_RUNTIME_PACK for the selected target');
if (!cross && (runtimePack || process.env.SCRIPTC_TARGET)) throw new Error('Host builds must use the bundled runtime; use --target for cross builds');
if (runtimePack) {
  const metadata = JSON.parse(readFileSync(resolve(runtimePack, 'package.json'), 'utf8'));
  const suffix = platform === 'linux' ? '-gnu' : platform === 'win32' ? '-msvc' : '';
  if (metadata.name !== `@scriptc/runtime-${target}${suffix}` || metadata.version !== '0.4.0') {
    throw new Error('Runtime pack must match the selected target and scriptc 0.4.0');
  }
}
const outDir = resolve(root, 'skills/korean-ux-writing/scripts/bin', target);
mkdirSync(outDir, { recursive: true });
const output = resolve(outDir, platform === 'win32' ? 'kuw.exe' : 'kuw');
const packageInfo = JSON.parse(readFileSync(resolve(root, 'node_modules/scriptc/package.json'), 'utf8'));
if (packageInfo.version !== '0.4.0') throw new Error('Build requires the pinned scriptc 0.4.0');
// The installer compares argv[1] with import.meta.url; resolve pnpm's symlink first.
execFileSync(process.execPath, [realpathSync(resolve(root, 'node_modules/scriptc/scripts/install-native.mjs'))], { cwd: root, stdio: 'inherit' });
const compiler = realpathSync(resolve(root, 'node_modules/scriptc/bin/scriptc.exe'));
const buildDirectory = mkdtempSync(resolve(tmpdir(), 'korean-ux-native-'));
try {
  const built = resolve(buildDirectory, platform === 'win32' ? 'kuw.exe' : 'kuw');
  execFileSync(compiler, ['build', 'src/cli.ts', '-o', built], {
    cwd: root, stdio: 'inherit',
    env: cross ? { ...process.env, SCRIPTC_TARGET: triples[target] } : process.env,
  });
  cpSync(built, output);
} finally {
  rmSync(buildDirectory, { recursive: true, force: true });
}
if (platform !== 'win32') chmodSync(output, 0o755);
console.log(`Built ${target}: ${statSync(output).size} bytes`);
if (!cross) {
  const nativeVersion = execFileSync(output, ['--version'], { cwd: root, encoding: 'utf8' }).trim();
  if (nativeVersion !== NATIVE_TOOL_VERSION) throw new Error(`Expected native tool ${NATIVE_TOOL_VERSION}, received ${nativeVersion}`);
  console.log(nativeVersion);
} else console.log('Cross-compiled only: run pnpm test on the target host before publishing.');

const runtimeTarget = platform === 'linux' ? `${target}-gnu` : platform === 'win32' ? `${target}-msvc` : target;
const compilerRequire = createRequire(realpathSync(resolve(root, 'node_modules/scriptc/package.json')));
const licenses = runtimePack
  ? resolve(runtimePack, 'artifacts/licenses')
  : resolve(dirname(compilerRequire.resolve(`@scriptc/cli-${runtimeTarget}/package.json`)), 'dist/lib', `runtime-${runtimeTarget}`, 'artifacts/licenses');
cpSync(licenses, resolve(outDir, 'licenses'), { recursive: true });
// Keep the distributed notices byte-consistent across native and cross hosts.
for (const name of readdirSync(resolve(outDir, 'licenses'))) {
  if (name.endsWith('.txt')) {
    const path = resolve(outDir, 'licenses', name);
    writeFileSync(path, readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
  }
}
writeFileSync(resolve(outDir, 'build.json'), JSON.stringify({
  version: NATIVE_TOOL_VERSION, target, compiler: 'scriptc@0.4.0',
  sha256: createHash('sha256').update(readFileSync(output)).digest('hex'),
  sourceSha256: nativeSourceDigest(root),
}, null, 2) + '\n');
