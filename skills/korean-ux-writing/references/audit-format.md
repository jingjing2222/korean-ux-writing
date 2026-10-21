# Audit report contract — version 2

This report records the declared funnel, intended meaning, current Korean reading,
and revision decision at every discovered usage site. Assume a product written in
Korean with no English source. The report does not require or infer a translation
history. It does not replace reading the product or checking the rendered UI.

## Before the first copy edit

Follow [the user-perspective review](user-perspective.md) before judging copy.
Save `user-perspective.json` and link it as `user_perspective_ref` in the diagnosis
and final audit. Record what this user could know on this entry path and the
pre-action expectation separately from the actual outcome. Native tool 3.0.1
requires a readable, structured companion in both modes and checks its declared
coverage and links. Interpretation, observation truth and review order still need
manual comparison. It does not replace the per-usage diagnosis below.

Read the funnel and fix the original inventory first. Reconstruct what each
screen/state needs to communicate, then compare the current Korean at each usage
site with that meaning. Save the completed review as `diagnosis.json`, with
`complete: false`:

```sh
/path/to/korean-ux-writing/scripts/kuw audit /path/to/diagnosis.json --diagnosis-only
```

This validates context, funnel, inventory, meaning contexts and diagnosis without
requiring revision decisions or `unresolved`. It does not authorize a rewrite.
Preserve this snapshot, keep the same originals and IDs in the final report, and
record its location in `diagnosis_ref`.

If new evidence changes a diagnosis, retain the old snapshot and explain the new
evidence in a new snapshot. If a later discovery requires splitting a copy ID,
retain an explicit old-to-new mapping and every original occurrence. Revalidate
the new diagnosis before dependent edits. The validator does not read snapshots
or prove that diagnosis preceded editing.

After revision, run:

```sh
/path/to/korean-ux-writing/scripts/kuw audit /path/to/audit.json --require-complete
```

Without `--require-complete`, a well-formed partial report can pass. Failures exit
with status 1. `--diagnosis-only` and `--require-complete` cannot be combined. Add
`--json` for `{valid, complete, mode, errors, limitation}`. Diagnostic output always
has `complete: false`. Final output is complete only if the input claims it and
the declared contract passes; this is not independent quality certification.

## Fields

Unknown extra fields are allowed. Duplicate JSON keys are rejected. Every
referenced ID must exist; every required explanation must be nonempty.

| Field | Content |
| --- | --- |
| `version` | Integer `2`. Version 1 is rejected; migration requires a real contextual review, not just changing this number. |
| `complete` | Boolean; false while coverage, context or product facts remain unresolved. |
| `user_perspective_ref` | Required relative `.json` path below this report's directory, e.g. `user-perspective.json` or `review/user-perspective.json`. The CLI resolves it relative to the report, independent of its working directory. Use forward slashes; absolute paths, URLs, `.`/`..` components and symlink escapes are rejected. |
| `diagnostic_patterns_reviewed` | Every installed `translationese.json` pattern ID exactly once. Records catalog review, not a keyword search. |
| `scope.files` | Unique project-relative files needed to understand all affected copy and its funnel, including routes, shared resources, validation and service adapters. |
| `scope.routes`, `scope.states` | Unique routes and states. All must have declared nodes before completion. Distinguish conditional, loading, failure and success states. |
| `scope.discovery` | `{methods: [string], evidence: [evidence ID], limitations: [string]}`. Record discovery work actually performed. |
| `scope.exclusions` | `[{target, reason, evidence: [evidence ID]}]`. Excluded discovered UI prevents a whole-scope completion claim. Optional `scope.rationale` explains scope selection. |
| `evidence` | `[{id, kind, ref, detail}]`; kind is `code`, `runtime`, `spec` or `user`. An inspectable location and observed product fact, not a writing standard. `user` may identify the task requester; specify who supplied it. A developer/requester statement is not evidence of end-user knowledge or observation. |
| `context_reads` | `[{file, evidence: [evidence ID]}]`. Every scoped file must be covered before completion. Reading a file does not prove understanding its meaning. |
| `funnel.nodes` | `[{id, route, state, kind, reviewed, evidence: [evidence ID], context_files: [file]}]`; kind is `entry`, `screen` or `terminal`. Terminal means a verified outcome/boundary, not an unvisited destination. |
| `funnel.edges` | `[{id, from, to, trigger, reviewed, evidence: [evidence ID]}]`. Include normal, back, cancel, error and recovery transitions. |
| `meaning_contexts` | `[{id, node_id, user_goal, prior_context, current_decision, immediate_outcome, later_outcome, evidence: [evidence ID]}]`. All five explanations are required. |
| `inventory` | `[{id, original, protected_tokens: [string], occurrences: [occurrence]}]`. Keep the original unchanged. Split different meanings of a shared source key into separate IDs before diagnosis, preserving the original key/location. Do not edit source code at this stage. |
| Occurrence | `{id, node_id, file, anchor, state, role}`. Globally unique ID and a stable key/AST/component anchor. |
| `translationese` | `[{id, before, status, patterns: [pattern ID], intent, korean_fit, reason, exception_review, evidence: [evidence ID], context_reviews: [context review]}]`. Exactly one diagnosis per inventory ID. The field name does not imply a known translation origin. |
| Context review | `{occurrence_id, context_id, korean_reading, fit, reason, evidence: [evidence ID]}`. Exactly one per declared usage, referencing a meaning context with the same node. `fit` is `fit`, `mismatch` or `uncertain`. |
| `decisions` | `[{id, status, before, after, reason, ux: [basis], ko: [basis], occurrence_reviews: [review]}]`. Exactly one per inventory ID. `diagnosis_resolution` is also required for candidate/uncertain diagnoses. |
| `additions` | Optional final-audit collection for newly introduced copy: `[{id, text, reason, occurrences: [new occurrence], ux: [basis], ko: [basis], occurrence_reviews: [review], finding_ids: [finding ID], authorization: [evidence ID]}]`. See authorized additions below. |
| Basis | `{rule, reason, evidence: [evidence ID]}`. Rule must exist in `rules.json` under the matching axis. Explain its applicability and the product fact separately. |
| Review | `{occurrence_id, evidence: [evidence ID], note}`. Check the final wording's role and consequence at each usage. A decision review may also declare `final_location: {node_id, file, anchor, state, role, context_id}` for authorized relocation or an absence-check location after removal. The original occurrence ID stays unchanged. |
| `unresolved` | `[{id, reason, evidence: [evidence ID]}]`. Include missing business facts, inaccessible screens, unverified behavior and unresolved flow findings from the user-perspective review. |

`decisions` and `unresolved` are required only for the final audit. The tool reads
its adjacent installed rule and pattern catalogs. `diagnosis_ref` and any
old-to-new mappings are provenance fields that require manual comparison.

## User-perspective companion — version 1

The companion is a separate JSON object with these fields. Empty arrays are valid
where there are no findings, rechecks, limitations or available information; do
not invent observations to fill an array. Required explanations are nonempty.

| Field | Content |
| --- | --- |
| `version` | Integer `1`, independent of audit report version `2`. |
| `method` | `participant-observation`, `independent-agent` or `informed-expert`, matching the work actually performed. Expert review can complete its declared scope; this does not certify a participant study. |
| `task` | Nonempty explanation of the user's goal, its source, known circumstances and assumptions. Mark a task hypothesis as such. |
| `reviewer_knowledge` | Nonempty explanation of internal information known at the start and materials supplied to the reviewer. Disclose knowledge of outcomes before the walkthrough. |
| `paths` | Preserved pre-edit paths, each `{id, entry_node_id, steps: [step]}`. Path IDs must be unique across both collections. |
| Step | `{id, node_id, occurrence_ids: [occurrence ID], available_information: [{detail, ref}], before_action, after_action}`. Step IDs are unique within a path. `before_action` separately records the goal, finding the action, choice differences, expected result and unknowns. `after_action` separately records the actual result and differences, including anything already known beforehand. Explain passive states or unperformed actions truthfully. |
| `recheck` | Paths with the same shape, recording the task after changes. Append these instead of overwriting pre-edit steps. New copy appears only here. |
| `ux_findings` | `[{id, type, node_ids: [node ID], occurrence_ids: [occurrence ID], missing_context, first_needed, facts: [evidence ID], ux: [basis], proposal, applied_scope, remaining, status}]`. Type is `copy`, `flow` or `mixed`. Status is `open` or `resolved`. |
| `limitations` | Unique strings describing unverified review scope. A nonempty array prevents completion. Internal knowledge and a nonparticipant method must be disclosed, but do not by themselves prevent a complete expert review. |

Every path starts at its declared entry node. Adjacent steps must follow a
declared edge. If multiple edges connect the same pair of nodes, put
`via_edge_id` on the destination step to identify the action actually reviewed;
it is otherwise optional, and absent on the first step. Each occurrence must
belong to its step's node: `paths` uses its inventory location, while `recheck`
uses the decision review's `final_location` when supplied, otherwise its original
location. Split distinct entry contexts into separate nodes and
occurrences as described below; if equivalent paths are grouped, retain their
names and the equivalence reason as additional provenance.

For a complete report, every original occurrence must appear in `paths`, every
declared node and edge must be covered by `paths` or `recheck`, and each step must
list every audit target at that node: originals in `paths`, effective final
locations of originals plus additions in `recheck`. Changed original copy needs recheck
coverage at every usage before completion. Every declared relocation also needs
recheck coverage at its final location, including text retained with `keep`.
In a partial report, an original usage absent from `paths` must have an
`uncertain` context diagnosis and remain blocked or excluded in the final audit.

Those automated checks aggregate occurrence coverage and the union of recorded
edges; they do not compare the complete set of pre-edit and final paths. Manually
confirm that every affected current path was rechecked, including distinct
actions between the same nodes. A recheck on one path cannot stand in for another
unless their available information and consequences remain equivalent after the
change and that equivalence is recorded. Keep any unverified path in `limitations`
and `unresolved`, even when the structural validator would otherwise pass.

Findings require at least one known `node_id`; a referenced occurrence must have
its baseline or final node included, and the prose identifies the reviewed phase.
Their occurrence list may be empty
when the problem is missing guidance or a missing stage. `first_needed` explains
where and why information first becomes necessary and can describe a proposed
stage that does not exist yet. `facts` references report evidence; `ux` uses the
same installed UX bases as decisions. `applied_scope` explains what was actually
changed, including no change. Open findings need nonempty `remaining` text and a
final `unresolved` row with the same ID. They prevent completion even if that row
was omitted. Resolved findings have `remaining: ""`; the truth of resolution is a
manual judgment. Copy changes alone do not establish that a flow issue is fixed.

When an authorized flow change inserts or replaces stages/transitions, preserve
baseline graph declarations so pre-edit steps remain linkable, and add the nodes
and edges followed in the final recheck. Mark historical and current declarations
with additional phase/provenance fields. Keep their routes, states and context
files in scope. The `paths` collection records the baseline; `recheck` records the
changed flow. Do not move an occurrence in the original inventory or rewrite
earlier expectations to describe the changed flow. Record a moved existing
occurrence's `final_location` in its decision review instead of treating it as
new copy. Inspect the actual final behavior
separately; graph coverage includes historical declarations and is not a claim
that every old transition remains live.

The CLI rejects missing/unreadable companions, invalid UTF-8, malformed JSON and
duplicate JSON keys. It never writes to the companion. It validates structure,
not whether information was visible, understood, recorded in order or observed
from a real participant. Review those claims against the actual artifacts.

## Meaning before wording

Use a supported user goal (or an explicitly labeled task hypothesis), the
applicable `UX-*` guidance and verified product facts to write `meaning_contexts`.
Internal implementation establishes behavior, not user needs or understanding.
`prior_context` describes information actually provided along this entry path,
not the reviewer's session knowledge or another branch. Explain what must be
understood or decided now and the actual immediate and later consequences. Those
consequences must not be used to retroactively fill gaps in the user's pre-action
knowledge. A handler name, resource key or paraphrase of the copy is not enough.

Several strings can reference one meaning context if they share the task, state
and consequences. Different meanings need separate contexts. For passive status
text, `current_decision` can explain what the user needs to know rather than invent
a choice. If there is no prior step or further consequence, explain the verified
boundary. If it is unknown, say what is unknown and retain the uncertainty.

The same rendered screen can require separate nodes, meaning contexts and
occurrences when entry paths provide different prior information and lead to
different interpretations or guidance needs. Keep a shared inventory ID if the
copy's meaning remains the same, but diagnose and review each path's occurrence.
If equivalent paths are grouped, record the paths and the reason their available
context is equivalent. Do not apply a normal-entry finding to an unseen direct entry.

Compare the current Korean with that context in every `context_review`:

- `korean_reading`: the action, referent or relationship the expression conveys in
  this usage using information available to the user at this point. This is the
  reviewer's interpretation, not an observed user quote or the meaning revealed
  by implementation details or a later screen.
- `fit`: whether that reading and expression fit the intended message and UI role.
  Grammatical correctness or being able to guess the feature is not sufficient.
- `reason`: the concrete agreement, mismatch or missing evidence. Include the
  relevant product evidence; diagnostic pattern references supply the external
  criteria and exceptions.

For example, this is the shape of a context and one usage review, not a complete
report or a fixed answer for every saved message:

```json
{
  "meaning_contexts": [{
    "id": "context.saved",
    "node_id": "saved",
    "user_goal": "선택한 표시 설정을 적용한다.",
    "prior_context": "설정 화면에서 표시 방식을 선택하고 저장했다.",
    "current_decision": "저장이 끝났는지 확인한다.",
    "immediate_outcome": "확인한 저장 처리 이후 결과 알림이 나타난다.",
    "later_outcome": "설정 화면으로 돌아가 저장된 값을 다시 변경할 수 있다.",
    "evidence": ["E-SAVED"]
  }],
  "context_reviews": [{
    "occurrence_id": "saved.toast",
    "context_id": "context.saved",
    "korean_reading": "설정 저장이 완료되었다는 결과 안내로 읽힌다.",
    "fit": "fit",
    "reason": "설정이 성공적으로 저장되었습니다의 대상·행동·완료 시점이 확인한 저장 결과와 맞는다. 중복 수식과 말투는 별도로 검토한다.",
    "evidence": ["E-SAVED"]
  }]
}
```

Place `context_reviews` inside the corresponding `translationese` item in a real
report. `intent` and `korean_fit` summarize the usage reviews; they do not replace
them. `reason`, `exception_review` and product evidence remain required for every
diagnosis, including `clear`.

## Diagnosis outcomes

Review LT-05 first, then LT-01 through LT-04 as supporting checks. These describe
review categories, not exhaustive detection of all unsuitable Korean.

- `candidate`: at least one usage has `mismatch`, none has `uncertain`, and at least
  one known diagnostic pattern applies. It is a reasoned review candidate, not
  proof of translation origin or automatic rewrite authority.
- `clear`: all usages have `fit`. The reviewed patterns do not establish a problem
  in those contexts. UX facts, repetition, spelling or other concerns can still
  require revision; do not relabel all issues as translationese.
- `uncertain`: at least one usage has `uncertain`. Other usages may fit or mismatch.
  Explain what cannot be resolved. This prevents overall completion.

`before` must equal the inventory original. All pattern IDs must be known;
`patterns` may be empty for clear/uncertain results. Ordinary passives, noun
labels and familiar technical terms are not automatically unsuitable.

Normally there is no foreign-language original. Do not search for one as a
prerequisite, invent one, or infer translation origin from the Korean alone. Only
when an actual source expression is supplied or encountered may the optional
`source_expression` record it, with evidence of where it was inspected. It is
supplementary context, never the default standard for judging Korean copy.

## Revision decisions

Status is `changed`, `keep`, `blocked` or `excluded`. Both changed and keep require
nonempty UX and Korean bases and reviews of every declared usage. Keeping suitable
copy is a reviewed outcome. Blocked/excluded decisions preserve the original and
may have empty basis arrays.

For candidate/uncertain diagnoses, `diagnosis_resolution` explains how the final
decision addresses the finding or why it remains on hold. A smoother ending alone
does not resolve a mismatch in the action, referent or outcome. Uncertain diagnoses
cannot be changed or kept, even in a partial audit: obtain evidence, update the
diagnosis and save a new checkpoint before editing. Preserve the old snapshot.

Changed decisions must have different `after` text; other statuses must preserve
it. Removing redundant text is `changed` with `after: ""`; retain the inventory row.
Different replacements for different meanings require distinct inventory IDs
before diagnosis, as described above. Source-key separation, if needed, follows
diagnosis and preserves behavior and every call site.

For authorized relocation, keep the baseline occurrence and diagnosis unchanged
and add `final_location` to that occurrence's decision review. Its scoped file,
stable anchor, node state and role identify the final location; `context_id` must
reference the meaning context of that final node. Use `keep` when the wording is
unchanged, and `changed` when the wording also changes. Blocked/excluded copy
cannot declare an applied relocation. Explain the new role and consequences in
the review and recheck. Surviving copy and additions cannot share the same final
usage site, but a vacated baseline site can host genuinely new copy with a new ID.
The tool checks locations and context links; authorization and semantic fit for
relocation still require inspection of the request and evidence.

For removal, `occurrence_ids` in recheck identifies audit targets, not necessarily
visible text. Keep the original ID and use the review's `note` and the step's
`after_action` to record verified absence. Do not put removed text in
`available_information` as though it were displayed. If the original node was
replaced, `final_location` identifies the successor node and stable region where
absence was checked, with its meaning context. A null location or an omitted
recheck does not establish removal. A removed target does not occupy a final
copy site, so its checked region may contain a separately reviewed replacement.

## Authorized additions

An approved flow change can require copy that did not exist before the review.
Record it in `additions`, leaving the original `inventory`, `translationese` and
`decisions` IDs and originals intact. An addition has `text`, not a fabricated
empty `original` or `before`; do not manufacture a translationese diagnosis for
it. `original`, `before` and `translationese` fields on additions are rejected,
and additions cannot be included in the original diagnostic checkpoint.

Each addition has a new globally distinct copy ID and new occurrence IDs and
locations. A new occurrence uses the ordinary occurrence fields plus
`context_id`, referencing a meaning context at the same node. It requires
nonempty UX and Korean bases, a final review for every occurrence, and separate
`recheck` coverage of every new usage, including in a partial final report.

`finding_ids` must reference known `flow` or `mixed` companion findings.
`authorization` must reference nonempty report evidence of kind `user` identifying
the requester and the permission to change this flow. Existing implementation
or a writing rule is not authorization. The validator checks these references
and their kinds, not the truth or scope of permission. A proposed addition without
authorization remains a finding/proposal; do not record it as applied copy.

No before/after token comparison exists for genuinely new text. Inspect its
interpolation, material facts, syntax, accessibility and behavior with the
product's tooling and evidence. Original text still receives all existing token
and immutable-original checks. Adding a row does not close an open flow finding.

## Completion and preservation

Compare the companion's substantive judgments manually at completion. Missing
prerequisite context is a flow issue: identify where the user first needed it,
rather than resolving it by adding an explanation to the current string.
Copy-only improvements do not close a flow finding. Reference unresolved flow
findings in `unresolved`, which prevents a complete audit. Record the actual review
method and limitations; an independent agent walkthrough is not participant testing.

Before completion, every node/edge is reviewed, every scoped file is read, every
route/state has a node, every node is reachable from an entry and can reach a
terminal. Every copy ID has a diagnosis and decision preserving its original.
Every occurrence has both contextual diagnosis and final review; all diagnostic
patterns have been reviewed. Authorized additions have their own locations,
meaning contexts, bases, final usage reviews and recheck coverage, without a
fictional original diagnosis. Limitations, exclusions, unresolved items, open UX
findings, uncertain diagnoses and blocked/excluded decisions prevent completion.

The validator preserves multisets of common `{name}`, `{{name}}`, `${expression}`,
positional braces, printf-style tokens and ICU argument headers. It compares
common ICU branch selectors, offsets and number markers, but is not a full ICU,
JavaScript or template parser. Use `protected_tokens` for additional syntax or
material facts. Each token must exist in the original and keep its occurrence
count. Also validate syntax and behavior with the product's actual tooling.

These checks verify record consistency. They cannot discover omitted UI, verify
product evidence, judge the truth of a Korean interpretation, certify fluency,
prove diagnosis happened first, or prove a revision was applied. Inspect actual
artifacts and rendered states separately. Never turn a passing report into an
unsupported completeness claim or relabel an unread destination as a terminal.
