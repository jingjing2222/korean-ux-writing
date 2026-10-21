import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { nativeSourceDigest } from '../native-sources.ts';
import { ROOT, SKILL, NATIVE_TOOL_VERSION, TARGETS, LICENSES, readJson, sha256, type Check } from './context.ts';

export function validateNative(check: Check, requireAllBinaries: boolean): number {
  const binDirectory = join(SKILL, 'scripts/bin');
  const available = existsSync(binDirectory)
    ? readdirSync(binDirectory, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name)
    : [];
  check(available.length > 0, 'At least one native platform package is required');
  for (const target of available) check(TARGETS.includes(target), `Unsupported native platform directory: ${target}`);
  if (requireAllBinaries) for (const target of TARGETS) check(available.includes(target), `Missing native platform package: ${target}`);
  const sourceSha256 = nativeSourceDigest(ROOT);
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

  return available.length;
}
