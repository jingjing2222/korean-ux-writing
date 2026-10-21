# Working on this skill

Read `docs/evidence/README.md` before changing writing rules. UX rules govern what a funnel must communicate; Korean rules govern how to express that meaning. Product code establishes facts, not writing standards.

Never promote an invented preference or another agent skill into a writing rule. Preserve source scope, exceptions, and verification limits. Keep the full source evidence in `docs/evidence/`, outside `skills/`.

Product context is not user context. Judge UX using the user's goal and information available on their actual path, not session explanations or implementation knowledge. Record pre-action expectations separately from later results; distinguish expert walkthroughs from observed participant tests. Missing prerequisite context is a flow problem: identify where it first needs to be provided instead of appending an explanation to the current string. Preserve unresolved flow findings even when copy edits are finished.

Assume a product written in Korean with no English source. Interpret its Korean copy using the user's task and information available along that path, then compare expectations with verified behavior. Do not reconstruct an imagined English original. Read the entire affected funnel before editing product copy. Diagnose intent and Korean word choice before rewriting; grammatical pattern checks alone are insufficient. Track entry points, earlier promises, branches, exits, recovery, and later consequences. A component in isolation is not sufficient context. Record the current Korean reading against the intended meaning at every usage site. Split inventory meanings before diagnosis when one source key serves different tasks; polish only after resolving the mismatch.

Keep the two READMEs concise and equivalent. Run the repository validator and behavioral tests before publishing changes. Do not add local work reports, private checklists, credentials, or workstation paths.

Korean polishing authorizes edits to existing Korean only. Read all languages for funnel context; preserve other-language copy and foreign-language spans in mixed text. Do not infer translation or English-editing permission from clarity, consistency, UX findings or full-frontend coverage. An explicitly requested bilingual README task is separate from the skill's default editing scope.

Review public instructions for the intended reader, not the internal procedure they describe. Explain concrete actors, objects, actions and outcomes where the reader needs them. A generic keep reason or accurate internal terminology does not establish clarity. Apply the same reader check to revised copy; preserve license scope and necessary specialist terms.

Use pnpm for development dependencies, TypeScript 7.1 for type checking, and scriptc for native builds. Follow `docs/development.md`. Ship the executables inside the Codex and Claude Code plugins; installing the skill must not require Node.js, Python, or a WebAssembly runner.
