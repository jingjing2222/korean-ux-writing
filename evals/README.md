# Behavioral evaluation

Run the mechanical regression suite from the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm build
pnpm test
skills/korean-ux-writing/scripts/kuw audit evals/fixtures/minimal/audit.json --require-complete
```

The minimal fixture demonstrates the report contract, including one shared string
with two usage sites and one diagnosis per original. Its `clear` diagnoses coexist
with a separate Korean-expression revision; `clear` does not mean that every UX
and writing concern is resolved. It is deliberately small. Passing it does not
establish coverage, diagnostic accuracy or writing quality on another project.

The regression suite checks omitted or duplicate diagnoses, immutable originals,
required meaning contexts and per-usage Korean readings, intent and Korean-fit explanations for every status, reasons and
exception reviews, unknown pattern IDs, full catalog review including LT-05,
context/node consistency, fit/status consistency, diagnosis resolution, and rejection of uncertain changes even in partial reports. Version 1 reports must be reviewed again against version 2. It also checks that
`--diagnosis-only` accepts a report before revision decisions exist, continues to
validate context and diagnosis, and never emits a final completion claim.

For an independent skill evaluation, copy `fixtures/subscription/` to a temporary
workspace. Give a fresh agent only the installed skill, that fixture, and this task:

> Review every user-facing Korean string in this subscription flow. Read the whole
> flow and diagnose each original against the installed translationese criteria
> and exceptions. Start with the actual UI intent and whether its Korean vocabulary
> and word combinations express that intent naturally in context; grammatical
> correctness alone is insufficient. Before the first copy edit, save diagnosis.json and check it with
> --diagnosis-only. Then improve the copy with separate UX and Korean-language
> reasons, and produce a final audit that retains the original strings and refers
> to the diagnostic snapshot. Preserve product behavior and report what you cannot verify.

These are raw React/TypeScript source fixtures, not a bundled application. A source
review needs no dependency installation. Do not claim that rendering was tested.
Do not supply this evaluator rubric or the minimal answer report to that agent.

## Evaluator rubric

- The agent saves a diagnostic checkpoint before its first copy edit. Check the
  observed execution order and compare the snapshot with the final audit; the
  deterministic validator cannot prove chronology or snapshot authenticity.
- Every discovered original has one diagnosis with a pattern-based explanation,
  exception review and inspected product evidence. The agent reviews the full
  installed pattern catalog instead of matching a few keywords.
- Every diagnosis, including clear results, records the confirmed UI intent and
  explains the Korean vocabulary and word combinations in that role. LT-05 is
  reviewed before the supporting form checks. Grammatically correct wording is
  still assessed for an wording that does not fit the intended meaning or UI role; absence
  of a grammatical warning pattern does not complete the review.
- An optional foreign-language source expression must have been inspected. When
  it is unavailable, the agent does not invent an original or assert translation
  origin. Example alternatives are not treated as fixed answers for every UI.
- A candidate is not proof of translation origin or automatic rewrite authority.
  A clear diagnosis does not bypass UX or Korean review. Uncertain diagnoses
  remain explicit and prevent an overall completion claim. Ordinary passives,
  concise noun labels and familiar loanwords are not blanket violations.
- The agent traces signup, invalid email, review, processing, pending, confirmed,
  declined and cancelled states, plus all external destinations and return paths.
- The initial Next action goes to review and does not charge; it must not become
  a purchase commitment. The review action submits a payment request.
- Pending, including a request whose outcome is unknown, must not promise that
  payment succeeded, that subscription is active, or a guaranteed wait time.
- A declined result has no known network cause. Rewriting must not invent a cause,
  promise that retrying works, or change the payment-methods link into a retry.
- The fee, monthly renewal timing, email interpolation, consent requirement and
  disabled/busy behavior remain intact. Natural wording does not justify erasing
  material conditions or adding recovery functions.
- The two different Confirm links must be assessed at their separate destinations.
  Placeholder, accessible text, conditional strings, processing labels and shared
  pricing occurrences must appear in the inventory, with explicit review outcomes.
- UX reasons and Korean expression reasons each cite installed rules and identify
  the applicable product facts. The same rule can justify retaining suitable copy.
- Missing destination screens and absent rendered evidence remain explicit. The
  report cannot claim complete coverage merely because the supplied component was
  fully scanned. Good local edits can accompany a partial audit.

Judge explanations against product behavior and rule scope, not an exact expected
sentence. Record observed failures before changing a rule. The deterministic
validator checks reporting invariants; it cannot replace this behavioral review.

## Lexical and contextual evaluation

For a separate fresh-agent run, supply only `fixtures/editor/Editor.tsx` and the
installed skill, using the same review task above for the writing flow. The file
contains inspected English counterparts and a Korean editor, exit confirmation,
and final list. Keep this rubric out of the agent's input.

Check whether the agent considers Korean word choice even when the grammar and
basic action are understandable. It must inspect initial writing, saved drafts,
later unsaved changes, and both exit choices before judging a label. A dictionary
equivalent is neither sufficient justification nor an automatic error. Judge the
reasoning and preserved behavior, not a fixed replacement for any one expression.
The in-memory storage limit, persistent save notice, and unverified rendered
interaction must remain visible in the report; prose changes do not resolve them.


## Korean copy without an English source

For a fresh run, copy `fixtures/context/` to an isolated workspace. Give the agent
only that raw fixture, the installed skill, verified source evidence when needed,
and a request to review and improve its Korean UI copy. Assume there is no English
original. Do not provide other evaluation artifacts or the rubric below.

Evaluate these observed behaviors, not a fixed replacement string:

- The agent reads the entry promises, shared preference UI, stored values and
  result branches. The generic `updatePreference(id, boolean)` call alone does
  not reveal the user's task.
- The shared `연결 유지` label has different roles: course email updates and
  headphone background connectivity. The agent diagnoses the email label against
  that funnel's meaning while retaining a fitting connection term in the device
  context. It does not need an English source or infer one.
- Different meanings of the shared key receive separate inventory IDs before
  diagnosis. Each usage refers to its own meaning context and current Korean
  reading. Any source-key change follows the diagnostic checkpoint.
- A recorded mismatch is resolved in the revision or has a justified hold/keep
  explanation. Merely changing an ending does not fix the meaning.
- Save, cancel, reset, initial values and result branches retain their behavior.
  The fixture only stores mock preferences in memory; it does not send email or
  control real hardware. The report preserves this distinction.
- UI/runtime checks and absent user research are reported accurately. A
  mechanically valid report is not evidence that native readers prefer a phrase.

The source fixture has an entry point but no dependency manifest. A source review
requires no installation. If the evaluator builds a temporary browser harness,
record its dependency versions and actual checks without changing the fixture's
product behavior or committing generated files.

## User perspective and missing prerequisites

For a fresh evaluation, give the agent a realistic user goal, raw user-facing
screens in navigable order, the skill, and product sources for later fact checks.
Keep evaluator conclusions and implementation explanations out of a separate
screen-only reviewer's input. Include both a normal entry and a direct entry,
a choice with consequences disclosed only afterwards, and a control case whose
needed context is already available. This is an agent evaluation, not participant
research. Static screen transcripts do not establish visual discoverability.

Inspect the actual artifacts and work order:

- Before-action interpretations are saved before later screens or implementation
  details are revealed. If that was impossible, the reviewer records its prior
  knowledge instead of claiming an independent first encounter.
- Product facts, user-visible information, task hypotheses, and real participant
  evidence remain distinct. A different entry path does not inherit unseen context.
- Missing prerequisite context produces a flow finding that identifies where the
  context first becomes necessary. A longer label, inline explanation or tooltip
  at the current point does not close that finding.
- Safe copy edits can proceed independently, but behavior stays within the task's
  authorization. Unresolved flow issues remain in the final audit's `unresolved`.
- Already adequate guidance is retained; technical information is assessed for
  the actual audience and task rather than removed categorically.
- The companion user-perspective record is manually compared with every usage
  and the final audit. The native v2 validator does not validate that companion
  file or certify user understanding.

Do not give this rubric or a target replacement sentence to the evaluating agent.
