import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { validate, isCompanionReference, LIMITATION } from './audit.ts';
import { fetchEvidence } from './evidence.ts';
import { readJson } from './json.ts';

const VERSION = '3.0.1';
const HELP = `Korean UX Writing ${VERSION}

kuw audit <report.json> [--diagnosis-only | --require-complete] [--json]
kuw evidence --out <path> [--source <local-registry.json>]
kuw --version

--skill-dir <path> overrides the bundled skill directory for either command.
user_perspective_ref resolves below the report directory, independent of cwd.
Audit checks record consistency; it does not grade Korean copy.`;

type Options = {
  command: string;
  report: string;
  skillDir: string;
  output: string;
  source: string;
  json: boolean;
  diagnosisOnly: boolean;
  requireComplete: boolean;
};

function parseArguments(args: string[]): Options {
  const options: Options = {
    command: args.length > 0 ? args[0] : 'help',
    report: '',
    skillDir: resolve(dirname(process.execPath), '../../..'),
    output: '',
    source: '',
    json: false,
    diagnosisOnly: false,
    requireComplete: false,
  };
  if (options.command === '--version' || options.command === '--help' || options.command === '-h' || options.command === 'help') return options;
  if (options.command !== 'audit' && options.command !== 'evidence') throw new Error('Expected audit or evidence');
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.command = 'help';
      return options;
    } else if (arg === '--skill-dir' || arg === '--out' || arg === '--source') {
      i += 1;
      if (i >= args.length || args[i].length === 0) throw new Error('Missing value for ' + arg);
      if (arg === '--skill-dir') options.skillDir = resolve(args[i]);
      else if (arg === '--out' && options.command === 'evidence') options.output = args[i];
      else if (arg === '--source' && options.command === 'evidence') options.source = args[i];
      else throw new Error('Unexpected argument: ' + arg);
    } else if (arg === '--json' && options.command === 'audit') {
      options.json = true;
    } else if (arg === '--diagnosis-only' && options.command === 'audit') {
      options.diagnosisOnly = true;
    } else if (arg === '--require-complete' && options.command === 'audit') {
      options.requireComplete = true;
    } else if (!arg.startsWith('-') && options.command === 'audit' && options.report === '') {
      options.report = arg;
    } else {
      throw new Error('Unexpected argument: ' + arg);
    }
  }
  if (options.diagnosisOnly && options.requireComplete) throw new Error('--diagnosis-only and --require-complete cannot be combined');
  if (options.command === 'audit' && options.report === '') throw new Error('An audit report path is required');
  if (options.command === 'evidence' && options.output === '') throw new Error('--out is required');
  return options;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<number> {
  let options: Options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(message(error));
    console.error(HELP);
    return 2;
  }
  if (options.command === '--version') {
    console.log(VERSION);
    return 0;
  }
  if (options.command === 'help' || options.command === '--help' || options.command === '-h') {
    console.log(HELP);
    return 0;
  }
  if (options.command === 'evidence') {
    try {
      const count = await fetchEvidence(options.skillDir, options.output, options.source);
      console.log('Verified ' + count + ' source records: ' + options.output);
      console.log("Read each rule's cited passage, scope, and limitations before applying it.");
      return 0;
    } catch (error) {
      console.error('Evidence unavailable: ' + message(error));
      console.error('Keep affected judgments unresolved; do not invent replacement criteria.');
      return 1;
    }
  }
  let errors: string[] = [];
  let claimsComplete = false;
  try {
    const audit: unknown = readJson(options.report);
    let perspective: unknown;
    const companionErrors: string[] = [];
    if (audit !== null && typeof audit === 'object' && !Array.isArray(audit)) {
      const record = audit as Record<string, unknown>;
      claimsComplete = record['complete'] === true;
      const ref = record['user_perspective_ref'];
      if (isCompanionReference(ref)) {
        try {
          const reportDirectory = realpathSync(dirname(resolve(options.report)));
          const companionPath = realpathSync(resolve(reportDirectory, ref));
          const relativePath = relative(reportDirectory, companionPath);
          if (isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith('../') || relativePath.startsWith('..\\')) {
            companionErrors.push('user_perspective_ref: companion must remain below the report directory after resolving symlinks');
          } else perspective = readJson(companionPath);
        } catch {
          // Do not echo arbitrary file contents or parser keys from a bad reference.
          companionErrors.push('user_perspective_ref: cannot read a valid UTF-8 JSON companion');
        }
      }
    }
    const rules = readJson(resolve(options.skillDir, 'references/rules.json'));
    const patterns = readJson(resolve(options.skillDir, 'references/translationese.json'));
    errors = companionErrors.concat(validate(audit, rules, patterns, options.requireComplete, options.diagnosisOnly, perspective));
  } catch (error) {
    errors = [message(error)];
  }
  const valid = errors.length === 0;
  if (options.json) {
    console.log(JSON.stringify({
      valid,
      complete: valid && claimsComplete && !options.diagnosisOnly,
      mode: options.diagnosisOnly ? 'diagnosis-only' : 'final-audit',
      errors,
      limitation: LIMITATION,
    }, null, 2));
  } else {
    if (valid) console.log(options.diagnosisOnly ? 'PASS: diagnostic checkpoint' : 'PASS: declared audit contract');
    else for (const error of errors) console.error('FAIL: ' + error);
    console.log(LIMITATION);
  }
  return valid ? 0 : 1;
}

main().then((code: number) => { process.exitCode = code; }).catch((error: unknown) => {
  console.error(message(error));
  process.exitCode = 1;
});
