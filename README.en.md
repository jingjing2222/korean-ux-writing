# Korean UX Writing

[한국어](README.md) · English

A skill that reviews and improves Korean frontend copy from the user’s perspective. It checks whether the information users have actually received helps them understand what to do next and what to expect. No English source text is needed.

The review uses published UX guidance and Korean-language references. If earlier steps have not provided the context users need, it identifies the flow problem before refining the wording.

## Install

Install as a Codex or Claude Code plugin.

### Codex

Run these commands in order in your terminal:

```sh
codex plugin marketplace add jingjing2222/korean-ux-writing
codex plugin add korean-ux-writing@korean-ux-writing
```

### Claude Code

Run these commands one at a time in a Claude Code conversation. The second command opens a panel where you choose the installation scope.

```text
/plugin marketplace add jingjing2222/korean-ux-writing
/plugin install korean-ux-writing@korean-ux-writing
```

After installing, start a new conversation to request a review. The plugin is distributed through this repository’s marketplace and is not listed in either product’s official plugin directory.

## Try it

To review the entire frontend:

```text
Use korean-ux-writing to review all Korean copy in this frontend.
For each string, record the original, the final wording, and the reasons and
sources for the decision. Apply the changes to the code.
```

To start with a specific flow:

```text
Use korean-ux-writing to improve the copy in the signup flow.
Review everything from the entry screen through error recovery and completion.
```

## How it works

1. **The agent reviews the screens with the user’s goal in mind.** It follows the journey from the first screen through choices, cancellation, error recovery, and completion. At each step, it checks what users have been told and what they can expect to happen.
2. **It finds where the copy appears.** It collects button labels, form instructions, errors, empty states, notifications, and accessibility text, and records when and where each item appears.
3. **It identifies unclear wording and steps where information is missing.** If users lack information they need before making a choice, it proposes adding that information at the first step where it is needed. It does not assume users know what developers know or count a longer explanation in the current copy as a fix for an earlier gap.
4. **It checks whether the wording matches the user’s goal and what the product actually does.** It looks for words that are unsuitable or unclear in context, even when the grammar is correct. It reviews the meaning of shared copy wherever it appears, resolves mismatches, and then polishes the sentences.
5. **It compares the original and final wording.** It records both, along with the reasons and sources for each decision. It also checks rendered screens where the environment allows.

Every item is marked **change, keep, or hold**. The agent preserves actual product behavior, variables, amounts, durations, conditions, and other essential details. If the copy misstates how the product works, it corrects the wording using verified facts. When information is missing, it puts the item on hold and records why and what still needs to be checked.

## Where the guidance comes from

The [reference documentation](docs/evidence/README.md) links to the original sources and records their scope and exceptions. It is maintained separately from the installed skill.

- **UX references** inform what a particular situation needs to communicate.
- **Korean-language references** help assess whether the wording fits its context and guide revisions.
- **Product code** establishes the actual behavior and conditions.

Official guidance, usability findings, and expert recommendations are treated as different kinds of evidence. The skill does not impose the same brand voice or Korean sentence-ending style on every product.

## Scope

This skill reviews and improves existing Korean UI copy. Translating a product into Korean for the first time or writing new content requires a separate request.

The review also records inaccessible screens and unresolved flow problems. An agent’s preliminary review is kept distinct from usability testing with real participants.

See [SKILL.md](skills/korean-ux-writing/SKILL.md) for the workflow and completion criteria.

[Supported platforms](skills/korean-ux-writing/references/runtime.md) · [Development](docs/development.md)

## License

The code, documentation, and other original work created for this repository are covered by the [MIT License](LICENSE). This repository’s MIT License does not cover the external documents cited here. When using those documents, follow each document’s own terms of use.

Bundled runtime licenses are included in the `licenses/` directory beside each executable.
