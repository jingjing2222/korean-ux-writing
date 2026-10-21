# Korean UX Writing

[한국어](README.md) · English

An Agent Skill for reviewing Korean frontend copy in context, using published UX guidance and Korean-language references. It helps improve awkward translations, unnecessary wording, and unclear instructions, with a reason and source for each change.

The review starts with the user journey and checks for translationese before rewriting. It then establishes what users need to know from the product's actual behavior and refines the Korean. Copy that already works stays as it is.

## Install

Install with [Vercel's skills CLI](https://github.com/vercel-labs/skills). Requires Node.js 22.20+ and Python 3.10+.

```sh
npx skills add jingjing2222/korean-ux-writing --skill korean-ux-writing
```

Designed for tools that support Agent Skills, including Claude Code and Codex. Installation locations and ways to invoke a skill may vary by tool.

## Try it

To review the entire frontend:

```text
Use korean-ux-writing to review all Korean copy in this frontend.
Track every original string, its proposed wording, and the evidence for the
decision in a one-to-one record, then apply the changes to the code.
```

To start with a specific flow:

```text
Use korean-ux-writing to improve the signup flow.
Review everything from the entry screen through error recovery and completion.
```

## How it works

1. **Read the connected user journey.** Check entry points, earlier promises, branches, exits, error recovery, and what happens after completion.
2. **Collect the copy.** Map buttons, form instructions, errors, empty states, notifications, and accessibility text to their screens and states.
3. **Check for translationese before rewriting.** Look for wording that follows English too closely, even when its basic meaning is understandable. Assess the actual action and how Korean users would understand the words in that situation.
4. **Review meaning before wording.** Verify product facts in code, establish the information users need, then refine the language using documented Korean guidance.
5. **Record and check each decision.** Keep a one-to-one record of the original and reviewed copy, its evidence, and the verification scope. Check rendered screens where the environment allows.

Every item is marked **change, keep, or hold**. Meaning, behavior, variables, amounts, dates, conditions, and other important details must be preserved. Items without enough context stay on hold, with the missing information noted.

## Where the guidance comes from

The [evidence documentation](docs/evidence/README.md) records external sources, their scope, and exceptions. It is maintained separately from the installed skill.

- **UX references** inform what a particular situation needs to communicate.
- **Korean-language references** inform how to express that meaning clearly and naturally.
- **Product code** establishes the actual behavior and conditions.

Official guidance, usability findings, and expert recommendations are treated as different kinds of evidence. The skill does not impose a single brand voice or conversational Korean ending on every product.

## Scope

This skill reviews and improves existing Korean UI copy. Translating an entire product into Korean or creating new content requires a separate workflow.

The review also records screens and states that could not be checked. Automated checks alone cannot guarantee that every phrase is natural or that every interaction is usable.

See [SKILL.md](skills/korean-ux-writing/SKILL.md) for the workflow and completion criteria.

## License

Original work in this repository is available under the [MIT License](LICENSE). Referenced external materials remain subject to their respective owners' rights and terms.
