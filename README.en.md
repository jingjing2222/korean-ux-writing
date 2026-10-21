# Korean UX Writing

[한국어](README.md) · English

A skill that checks whether Korean frontend copy fits the user’s goal and the product’s actual behavior, then improves it. It traces what users have already been told, their current choices, and what happens next. No English source text is needed.

Published UX guidance and Korean-language references help it identify wording that does not fit its context before refining the phrasing.

## Install

Install as a Codex or Claude Code plugin. The tools are included as executables, so you do not need to install Node.js or Python separately to use this skill.

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
Use korean-ux-writing to improve the signup flow.
Review everything from the entry screen through error recovery and completion.
```

## How it works

1. **The agent reviews the full user journey.** It follows the flow from entry through branches, cancellation, error recovery, and what happens after completion. It also checks what earlier screens have already told users.
2. **It finds where the copy appears.** It collects button labels, form instructions, errors, empty states, notifications, and accessibility text, and records when and where each item appears.
3. **It establishes what users need to know at each step.** It verifies behavior in code and uses UX references to identify the user’s goal, earlier guidance, current choice, and later consequences.
4. **It checks whether the wording fits that meaning, then refines it.** It looks for words that are unsuitable or unclear in context, even when the grammar is correct. It reviews shared copy wherever it appears, resolves meaning problems, and then polishes the sentences.
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

The review also records screens and states that could not be checked. Automated checks alone cannot determine whether every phrase sounds natural or every interaction is easy to use.

See [SKILL.md](skills/korean-ux-writing/SKILL.md) for the workflow and completion criteria.

[Supported platforms](skills/korean-ux-writing/references/runtime.md) · [Development](docs/development.md)

## License

Original work in this repository is available under the [MIT License](LICENSE). Referenced external materials remain subject to their respective owners' rights and terms.

Bundled runtime licenses are included in the `licenses/` directory beside each executable.
