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

The checkpoint suite exercises the native stage handoff: invalid diagnoses and
post-edit observations produce no review directory; preparation cannot overwrite
an existing review; decision IDs and open findings are copied without inventing
judgments. Final checks reject changes to saved originals, diagnostic reasons or
pre-action expectations, dropped findings, invalid checkpoint references and
missing per-path rechecks. Valid partial reviews and recorded finding resolutions
remain possible. These tests check record preservation, not semantic correctness
or an agent's actual work order.

For an independent skill evaluation, copy `fixtures/subscription/` to a temporary
workspace. Give a fresh agent only the installed skill, that fixture, and this task:

> Review every user-facing Korean string in this subscription flow. Read the whole
> flow and diagnose each original against the installed translationese criteria
> and exceptions. Start with the actual UI intent and whether its Korean vocabulary
> and word combinations express that intent naturally in context; grammatical
> correctness alone is insufficient. Before the first copy edit, save diagnosis.json
> and run kuw prepare into a new review directory. Then improve the copy with
> separate UX and Korean-language reasons and finish the generated audit with
> --require-checkpoint. Preserve product behavior and report what you cannot verify.

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
- The native tool loads the required companion and checks its structure, usage
  coverage, paths and unresolved finding links. Missing files or open findings
  cannot be bypassed by an otherwise complete audit. Review order, visibility,
  evidence truth and user understanding still need substantive review.

Do not give this rubric or a target replacement sentence to the evaluating agent.

## Reader-facing explanations

For an independent evaluation, supply raw user-facing documentation and verified
product facts, with a concrete reader goal. Include an explanation built from
internal categories, a vague action/object combination, a scoped reuse notice,
and an appropriate familiar technical term. Do not supply this rubric, a list of
problem words, expected replacements or previous review conclusions.

Check that the agent identifies what the reader needs to know and what the text
actually conveys. It should improve concrete meaning, retain necessary technical
terms and license conditions, and review its own replacements by the same test.
Repeated generic keep reasons or compliance with internal procedure are not
evidence that the wording helps the reader. This is an agent evaluation, not an
observed participant study.

### Project guide regression

Use [fixtures/project-guide/](fixtures/project-guide/) as a concrete documentation
case. Copy only its `README.md` and `behavior.ts` to an isolated workspace and give
a fresh agent the installed skill, pinned source evidence, and this request:

> 대시보드 프로젝트를 만들어 개발하려는 개발자가 읽을 README의 한국어를
> 검토하고 다듬어 줘. 관련 동작은 behavior.ts로 확인할 수 있어. 명령과 동작은
> 바꾸지 말고, 문구 수정으로 해결하지 못한 문제가 있으면 알려 줘.

The TypeScript file is a pure source model, not a CLI or browser application. It
establishes fixture behavior only. Do not claim installation, rendering or real
participant testing. The fixture is synthetic; it is neither a writing authority
nor a record of a real user's behavior. Do not give the following rubric to the
agent or include it in the installed skill.

`pnpm test` runs [the scenario tests](../tests/project-guide.test.ts) to preserve
the fixture's creation conditions, edit-then-add failure, replacement boundaries,
launch timing and export controls. These tests check the supplied model, not the
real product or the quality of an agent's diagnosis. The semantic assessment below
still requires review of the agent's actual artifacts.

Inspect the actual diagnosis, final document and unresolved findings:

- Trace the promise of adding an example later through the instruction to edit
  the entry file. The first addition rejects that edited state. Identify the
  initial example choice as a point needing the condition, as well as the later
  command. Moving the warning immediately above that command alone is partial.
- Distinguish the creation example involving Git from the actual directory
  condition. Empty directories work without Git; other files block creation.
  Preserve `.git` and command text, and do not turn examples into universal
  forbidden wording.
- Make the preserved and replaced regions identifiable from actual markers.
  Renaming “관리 영역” without explaining the boundary or the effect on edits
  inside it does not resolve the issue. Preserve marker spelling and avoid
  inventing an automatic merge or recovery path. A proposal for a new example
  is different from an authorized, applied addition.
- Distinguish creating the starter page from starting the development server and
  opening the browser. Check the proposed wording together with the following
  command; do not add a separate launch step the model does not require.
- Keep the accurate CSR terminology, the saved-result requirement already
  presented before export, and the explicitly optional filename example.
  Rephrasing for a specific reason is allowed; labelling these as unexplained
  jargon, late prerequisites or mandatory steps is a false positive.
- Recheck revised and retained copy against the same conditions. Preserve
  commands, paths, foreign-language spans and product behavior. Any unapplied
  flow changes and unverified runtime checks remain explicit.

For a before/after comparison, give separate fresh agents identical copies and
the same request, changing only the skill snapshot. Record findings and false
positives from their actual artifacts outside the repository. A single run may
find the issues with either snapshot; it does not establish a detection rate or
prove that a past miss was caused by missing instructions. Mechanical `pnpm test`
checks report invariants, not these semantic outcomes.

For the staged skill, also inspect the actual sequence of file reads and writes:
the agent reads the entrypoint and context guide, records the reader's task and
paths with original copy and product facts, then loads diagnosis criteria and the
audit contract. It saves and checks diagnosis before loading revision guidance
and editing copy. Verification returns to the original task, conditions and
unresolved questions. Do not count a report claiming this order as proof; inspect
the tool trace. The diagnosis handoff uses `kuw prepare`, and final validation uses
`--require-checkpoint`; deleting the references is not a valid workaround.
Bulk-reading all stage guides before context discovery fails this
workflow check even if the final wording is good. Reusing a valid prior context
record is allowed, with its version and scope checked instead of a fabricated
fresh walkthrough.

## Korean-only editing scope

Give the evaluator a frontend containing Korean copy, mixed-language sentences,
other-language labels and accessibility text, and a separate locale resource.
Request Korean copy review without supplying target replacements or preservation
answers. In a separate task, use an interface containing no Korean.

Inspect the actual diff: Korean wording may improve, while existing foreign-language
copy and spans remain unchanged. Other-language screens must still inform the
funnel review. The agent must not fabricate Korean diagnoses for those strings,
translate to populate an empty inventory, or treat clarity and flow changes as
translation permission. Check declared protected tokens and the complete diff;
the native validator is not a language classifier. Explicitly requested
translation or other-language editing remains a separate task.
