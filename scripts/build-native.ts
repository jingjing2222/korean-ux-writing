import { mkdirSync, readFileSync, chmodSync, statSync, cpSync, writeFileSync, realpathSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Independent of the plugin release: docs and skills need no native rebuild.
const NATIVE_TOOL_VERSION = '3.0.0';
const platform = process.platform;
const architecture = process.arch;
const supported = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'];
const target = `${platform}-${architecture}`;
if (!supported.includes(target)) throw new Error(`Unsupported build host: ${target}`);
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
  execFileSync(compiler, ['build', 'src/cli.ts', '-o', built], { cwd: root, stdio: 'inherit' });
  cpSync(built, output);
} finally {
  rmSync(buildDirectory, { recursive: true, force: true });
}
if (platform !== 'win32') chmodSync(output, 0o755);
console.log(`Built ${target}: ${statSync(output).size} bytes`);
const nativeVersion = execFileSync(output, ['--version'], { cwd: root, encoding: 'utf8' }).trim();
if (nativeVersion !== NATIVE_TOOL_VERSION) throw new Error(`Expected native tool ${NATIVE_TOOL_VERSION}, received ${nativeVersion}`);
console.log(nativeVersion);

const runtimeTarget = platform === 'linux' ? `${target}-gnu` : platform === 'win32' ? `${target}-msvc` : target;
const compilerRequire = createRequire(realpathSync(resolve(root, 'node_modules/scriptc/package.json')));
const nativePackage = dirname(compilerRequire.resolve(`@scriptc/cli-${runtimeTarget}/package.json`));
const licenses = resolve(nativePackage, 'dist/lib', `runtime-${runtimeTarget}`, 'artifacts/licenses');
cpSync(licenses, resolve(outDir, 'licenses'), { recursive: true });
const sourceFiles = ['src/cli.ts', 'src/audit.ts', 'src/evidence.ts', 'src/json.ts', 'pnpm-lock.yaml'];
const sourceDigest = createHash('sha256');
for (const file of sourceFiles) sourceDigest.update(file + '\0').update(readFileSync(resolve(root, file)));
writeFileSync(resolve(outDir, 'build.json'), JSON.stringify({
  version: NATIVE_TOOL_VERSION, target, compiler: 'scriptc@0.4.0',
  sha256: createHash('sha256').update(readFileSync(output)).digest('hex'),
  sourceSha256: sourceDigest.digest('hex'),
}, null, 2) + '\n');
