# Audit report contract — version 2

This report records the declared funnel, intended meaning, current Korean reading,
and revision decision at every discovered usage site. Assume a product written in
Korean with no English source. The report does not require or infer a translation
history. It does not replace reading the product or checking the rendered UI.

## Before the first copy edit

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
| `diagnostic_patterns_reviewed` | Every installed `translationese.json` pattern ID exactly once. Records catalog review, not a keyword search. |
| `scope.files` | Unique project-relative files needed to understand all affected copy and its funnel, including routes, shared resources, validation and service adapters. |
| `scope.routes`, `scope.states` | Unique routes and states. All must have declared nodes before completion. Distinguish conditional, loading, failure and success states. |
| `scope.discovery` | `{methods: [string], evidence: [evidence ID], limitations: [string]}`. Record discovery work actually performed. |
| `scope.exclusions` | `[{target, reason, evidence: [evidence ID]}]`. Excluded discovered UI prevents a whole-scope completion claim. Optional `scope.rationale` explains scope selection. |
| `evidence` | `[{id, kind, ref, detail}]`; kind is `code`, `runtime`, `spec` or `user`. An inspectable location and observed product fact, not a writing standard. |
| `context_reads` | `[{file, evidence: [evidence ID]}]`. Every scoped file must be covered before completion. Reading a file does not prove understanding its meaning. |
| `funnel.nodes` | `[{id, route, state, kind, reviewed, evidence: [evidence ID], context_files: [file]}]`; kind is `entry`, `screen` or `terminal`. Terminal means a verified outcome/boundary, not an unvisited destination. |
| `funnel.edges` | `[{id, from, to, trigger, reviewed, evidence: [evidence ID]}]`. Include normal, back, cancel, error and recovery transitions. |
| `meaning_contexts` | `[{id, node_id, user_goal, prior_context, current_decision, immediate_outcome, later_outcome, evidence: [evidence ID]}]`. All five explanations are required. |
| `inventory` | `[{id, original, protected_tokens: [string], occurrences: [occurrence]}]`. Keep the original unchanged. Split different meanings of a shared source key into separate IDs before diagnosis, preserving the original key/location. Do not edit source code at this stage. |
| Occurrence | `{id, node_id, file, anchor, state, role}`. Globally unique ID and a stable key/AST/component anchor. |
| `translationese` | `[{id, before, status, patterns: [pattern ID], intent, korean_fit, reason, exception_review, evidence: [evidence ID], context_reviews: [context review]}]`. Exactly one diagnosis per inventory ID. The field name does not imply a known translation origin. |
| Context review | `{occurrence_id, context_id, korean_reading, fit, reason, evidence: [evidence ID]}`. Exactly one per declared usage, referencing a meaning context with the same node. `fit` is `fit`, `mismatch` or `uncertain`. |
| `decisions` | `[{id, status, before, after, reason, ux: [basis], ko: [basis], occurrence_reviews: [review]}]`. Exactly one per inventory ID. `diagnosis_resolution` is also required for candidate/uncertain diagnoses. |
| Basis | `{rule, reason, evidence: [evidence ID]}`. Rule must exist in `rules.json` under the matching axis. Explain its applicability and the product fact separately. |
| Review | `{occurrence_id, evidence: [evidence ID], note}`. Check the final wording's role and consequence at each usage. |
| `unresolved` | `[{id, reason, evidence: [evidence ID]}]`. Include missing business facts, inaccessible screens and unverified behavior. |

`decisions` and `unresolved` are required only for the final audit. The tool reads
its adjacent installed rule and pattern catalogs. `diagnosis_ref` and any
old-to-new mappings are provenance fields that require manual comparison.

## Meaning before wording

Use product facts and the applicable `UX-*` guidance to write `meaning_contexts`.
Explain the user's goal, what earlier steps promised or collected, what must be
understood or decided now, and the immediate and later consequences. A handler
name, resource key or paraphrase of the current copy is not enough. Code-derived
intent is an interpretation of product behavior, not a user-research finding.

Several strings can reference one meaning context if they share the task, state
and consequences. Different meanings need separate contexts. For passive status
text, `current_decision` can explain what the user needs to know rather than invent
a choice. If there is no prior step or further consequence, explain the verified
boundary. If it is unknown, say what is unknown and retain the uncertainty.

Compare the current Korean with that context in every `context_review`:

- `korean_reading`: the action, referent or relationship the expression conveys in
  this usage. This is the reviewer's interpretation, not an observed user quote.
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

## Completion and preservation

Before completion, every node/edge is reviewed, every scoped file is read, every
route/state has a node, every node is reachable from an entry and can reach a
terminal. Every copy ID has a diagnosis and decision preserving its original.
Every occurrence has both contextual diagnosis and final review; all diagnostic
patterns have been reviewed. Limitations, exclusions, unresolved items, uncertain
diagnoses and blocked/excluded decisions prevent completion.

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
