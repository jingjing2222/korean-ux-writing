# Development

Plugin users install the bundled executables through Codex or Claude Code. The
tools below are only needed when changing and rebuilding this repository.

- Node.js 24 or later runs development scripts and the test harness.
- pnpm 11.17.0 manages dependencies; `pnpm-lock.yaml` pins their versions.
- [TypeScript 7.1.0-beta](https://github.com/microsoft/TypeScript) checks types.
  Version 7.1 is currently a prerelease; its exact version is pinned.
- [scriptc 0.4.0](https://github.com/vercel-labs/scriptc/releases/tag/v0.4.0)
  compiles the tools into native executables. It needs the host platform's
  linker and SDK: Xcode Command Line Tools on macOS, a C/C++ toolchain on Linux,
  or Zig 0.16.0 on Windows.

From the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm build
pnpm test
pnpm validate
```

Dependency installation skips lifecycle scripts. `pnpm build` explicitly prepares
the pinned scriptc compiler. The build produces the current host's
executable, its runtime license notices, and a `build.json` containing binary and
source hashes. Tests exercise that executable, including execution without Node
or Python on `PATH`.

The CI matrix builds and tests macOS ARM64/x64, Linux ARM64/x64, and Windows x64
on their respective hosts, including TypeScript checks. Before publishing,
include all five tested bundles and
run `pnpm validate --require-all-binaries`. Artifact downloads may lose executable
permissions; restore those permissions for macOS and Linux binaries before
committing. Source hashes include the TypeScript sources and pnpm lockfile, so
changing either requires rebuilding every bundle.

The audit report format remains version 2; plugin and executable releases have
independent versions. A skill or evidence update can reuse the same verified
native executable. The user-perspective companion record is reviewed manually;
the v2 validator does not inspect it. See [behavioral evaluations](../evals/README.md) for the report
contract and skill evaluation procedure. Passing automated tests does not grade
the quality of Korean copy.

Writing criteria belong in [the evidence documentation](evidence/README.md).
Packaging changes must preserve the distinction between product facts, UX
criteria, and Korean-language criteria.
