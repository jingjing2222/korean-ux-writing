# Bundled tools

The plugin includes native executables built from TypeScript with scriptc 0.4.0.
Users do not need Node.js, Python, npm packages or a WebAssembly runner to execute
the preparation, audit and evidence commands.

On macOS and Linux, `<skill-directory>/scripts/kuw` selects the bundled executable
for the host. On Windows x64, use `<skill-directory>\scripts\kuw.cmd` or invoke the
`.exe` directly. In PowerShell, use `&` before a quoted executable path.

| Host | Executable inside the skill |
| --- | --- |
| macOS 14+, Apple silicon | `scripts/bin/darwin-arm64/kuw` |
| macOS 14+, Intel | `scripts/bin/darwin-x64/kuw` |
| Linux, ARM64, glibc 2.35+ | `scripts/bin/linux-arm64/kuw` |
| Linux, x64, glibc 2.35+ | `scripts/bin/linux-x64/kuw` |
| Windows, x64 | `scripts/bin/win32-x64/kuw.exe` |

Use the packaged binary for the current host. Unsupported architectures and Linux
musl/Alpine are not covered by this package. Do not install a compiler or download
an unpinned replacement just to bypass a missing executable. Record the tool
limitation and continue only the review steps that can be verified.

`kuw prepare` validates a pre-edit diagnosis and creates a new revision directory
with a saved checkpoint, working companion and decision scaffolding. It refuses
to overwrite an existing directory. `kuw audit --require-checkpoint` compares the
final report with that checkpoint as well as checking the report contract.
Both commands load the rule and diagnostic catalogs next to the installed skill.
`kuw evidence` reads its pinned source lock and verifies the registry before
writing it into the reviewed project. A network connection is needed for that
fetch unless `--source` points to a local file with the same pinned hash.

`--skill-dir <path>` is available for package tests or explicit alternate skill
locations. It is not needed for normal installed use. `--version` prints the
plugin tool version; `--help` lists the commands. Each executable's adjacent
`build.json` records its source and binary hashes, and `licenses/` contains the
notices shipped with its compiled runtime.
