import { dirname, resolve } from 'node:path';
import { validate, LIMITATION } from './audit.ts';
import { fetchEvidence } from './evidence.ts';
import { readJson } from './json.ts';
import { readAttachment, record } from './report-files.ts';
import { prepare, validateCheckpoint } from './checkpoint.ts';

const VERSION = '3.2.0';
const HELP = `Korean UX Writing ${VERSION}

kuw prepare <diagnosis.json> --out <new-review-directory>
kuw audit <report.json> [--diagnosis-only | --require-complete] [--require-checkpoint] [--json]
kuw evidence --out <path> [--source <local-registry.json>]
kuw --version

--skill-dir <path> overrides the bundled skill directory for all commands.
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
  requireCheckpoint: boolean;
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
    requireCheckpoint: false,
  };
  if (options.command === '--version' || options.command === '--help' || options.command === '-h' || options.command === 'help') return options;
  if (!['audit', 'evidence', 'prepare'].includes(options.command)) throw new Error('Expected audit, evidence or prepare');
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.command = 'help';
      return options;
    } else if (arg === '--skill-dir' || arg === '--out' || arg === '--source') {
      i += 1;
      if (i >= args.length || args[i].length === 0) throw new Error('Missing value for ' + arg);
      if (arg === '--skill-dir') options.skillDir = resolve(args[i]);
      else if (arg === '--out' && (options.command === 'evidence' || options.command === 'prepare')) options.output = args[i];
      else if (arg === '--source' && options.command === 'evidence') options.source = args[i];
      else throw new Error('Unexpected argument: ' + arg);
    } else if (arg === '--json' && options.command === 'audit') {
      options.json = true;
    } else if (arg === '--diagnosis-only' && options.command === 'audit') {
      options.diagnosisOnly = true;
    } else if (arg === '--require-complete' && options.command === 'audit') {
      options.requireComplete = true;
    } else if (arg === '--require-checkpoint' && options.command === 'audit') {
      options.requireCheckpoint = true;
    } else if (!arg.startsWith('-') && (options.command === 'audit' || options.command === 'prepare') && options.report === '') {
      options.report = arg;
    } else {
      throw new Error('Unexpected argument: ' + arg);
    }
  }
  if (options.diagnosisOnly && options.requireComplete) throw new Error('--diagnosis-only and --require-complete cannot be combined');
  if (options.diagnosisOnly && options.requireCheckpoint) throw new Error('--diagnosis-only and --require-checkpoint cannot be combined');
  if ((options.command === 'audit' || options.command === 'prepare') && options.report === '') throw new Error('A report path is required');
  if ((options.command === 'evidence' || options.command === 'prepare') && options.output === '') throw new Error('--out is required');
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
    const rules = readJson(resolve(options.skillDir, 'references/rules.json'));
    const patterns = readJson(resolve(options.skillDir, 'references/translationese.json'));
    if (options.command === 'prepare') {
      prepare(options.report, options.output, rules, patterns);
      console.log('Prepared revision: ' + resolve(options.output, 'audit.json'));
      console.log('Next: read references/revision.md. Fill decisions, then record rechecks.');
      console.log('Audit with --require-checkpoint; preparation does not approve wording or prove review order.');
      return 0;
    }
    const audit: unknown = readJson(options.report);
    let perspective: unknown;
    const companionErrors: string[] = [];
    if (audit !== null && typeof audit === 'object' && !Array.isArray(audit)) {
      const row = record(audit, 'audit');
      claimsComplete = row.complete === true;
      try { perspective = readAttachment(options.report, row.user_perspective_ref, 'user_perspective_ref'); }
      catch (error) { companionErrors.push(message(error)); }
      if (!options.diagnosisOnly) companionErrors.push(...validateCheckpoint(options.report, row, perspective, rules, patterns, options.requireCheckpoint));
    }
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
