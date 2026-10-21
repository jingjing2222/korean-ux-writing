# Korean UX Writing

[한국어](README.md) · English

An Agent Skill for refining Korean frontend copy. It reviews the screens users move through and how each one works, then uses published UX guidance and Korean-language references to improve awkward translations and unclear instructions.

## Install

Install with [Vercel's skills CLI](https://github.com/vercel-labs/skills). Requires Node.js 22.20+ and Python 3.10+.

```sh
npx skills add jingjing2222/korean-ux-writing --skill korean-ux-writing
```

Built for tools that support Agent Skills, including Claude Code and Codex. Where you install the skill and how you use it may vary by tool.

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
3. **Check for translationese before editing.** Look for wording that follows English too closely and sounds unnatural in Korean, even if it is grammatically correct. Check whether it expresses the intended meaning and action naturally in that situation.
4. **Establish what to communicate, then refine the wording.** Verify actual behavior in code and use UX references to decide what users need to know. Use Korean-language references to refine that content.
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

## License

Original work in this repository is available under the [MIT License](LICENSE). Referenced external materials remain subject to their respective owners' rights and terms.
