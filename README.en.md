# Korean UX Writing

[한국어](README.md) · English

An Agent Skill that checks whether Korean frontend copy fits the user’s task and the product’s actual behavior, then refines it. It assumes a product written in Korean with no English source and reads the entire user journey. Published UX guidance and Korean-language references help it find misleading or unsuitable wording before polishing sentences.

## Install

Install as a Codex or Claude Code plugin. The review tools ship as executables, so you do not need a separate Node.js or Python installation.

### Codex

Run in your terminal:

```sh
codex plugin marketplace add jingjing2222/korean-ux-writing
codex plugin add korean-ux-writing@korean-ux-writing
```

### Claude Code

Run in a Claude Code session, then select an install option:

```text
/plugin marketplace add jingjing2222/korean-ux-writing
/plugin install korean-ux-writing@korean-ux-writing
```

Start a new conversation after installing. The plugin is distributed through this repository's marketplace; it is not listed in either product's official directory.

## Try it

To review the entire frontend:

```text
Use korean-ux-writing to review all Korean copy in this frontend.
For each string, record the original, the reviewed wording, and the reasons and
sources for the decision. Apply the changes to the code.
```

To start with a specific flow:

```text
Use korean-ux-writing to improve the signup flow.
Review everything from the entry screen through error recovery and completion.
```

## How it works

1. **Review the full user journey.** Follow the flow from entry through branches, cancellation, error recovery, and what happens after completion. Check what earlier screens have already told users.
2. **Find where the copy appears.** Collect buttons, form instructions, errors, empty states, notifications, and accessibility text. Record when and where each item appears.
3. **Establish what users need to know here.** Verify behavior in code and use UX references to identify the user’s goal, earlier guidance, current choice, and later consequences.
4. **Check whether the wording conveys that meaning, then refine it.** Look for words that are unsuitable or unclear in context, even when the grammar is correct. Review shared copy at each usage site, resolve meaning problems, and then polish the sentences.
5. **Compare the copy before and after editing.** Record each original, its reviewed wording, and the reasons and sources for the decision. Check rendered screens where the environment allows.

Every item is marked **change, keep, or hold**. Preserve actual product behavior, variables, amounts, durations, conditions, and other essential details. If the copy misstates how the product works, correct it using verified facts. When information is missing, put the item on hold and record what still needs to be checked.

## Where the guidance comes from

The [reference documentation](docs/evidence/README.md) links to the original sources and records their scope and exceptions. It is maintained separately from the installed skill.

- **UX references** inform what a particular situation needs to communicate.
- **Korean-language references** inform how to express that meaning clearly and naturally.
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
