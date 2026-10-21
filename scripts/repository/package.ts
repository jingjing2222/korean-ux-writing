import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { ROOT, SKILL, PLUGIN_NAME, PLUGIN_VERSION, object, array, readJson, markdownFiles, type Check } from './context.ts';

export function validatePackage(check: Check): void {
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

}
