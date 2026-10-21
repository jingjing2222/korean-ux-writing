/** Check traceability and package structure, not source truth or prose quality. */
import { checkCodeLengths } from './code-length.ts';
import { ROOT } from './repository/context.ts';
import { validateEvidence } from './repository/evidence.ts';
import { validatePackage } from './repository/package.ts';
import { validateNative } from './repository/native.ts';

function main(): number {
  const errors = checkCodeLengths(ROOT);
  const check = (condition: boolean, message: string): void => {
    if (!condition) errors.push(message);
  };
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== '--require-all-binaries')) {
    throw new Error('Usage: pnpm validate [--require-all-binaries]');
  }
  const evidence = validateEvidence(check);
  validatePackage(check);
  const binaries = validateNative(check, args.includes('--require-all-binaries'));
  for (const error of errors) console.error(`FAIL: ${error}`);
  if (errors.length > 0) return 1;
  console.log(`PASS: code files <=200 lines, ${evidence.sources} sources, ${evidence.rules} traced rules, ${evidence.patterns} diagnostics, pinned evidence, plugin manifests and ${binaries} native platform package(s)`);
  console.log('This validates records and references; it does not independently verify source claims or copy quality.');
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
