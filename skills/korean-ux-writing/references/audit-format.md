# Audit report contract

Use this format after reading the workflow. The report records the declared funnel,
all discovered strings, and each usage site. It is not a replacement for inspecting
the source, rendered UI, external content, or later consequences of an action.

Before the first copy edit, save the original inventory and completed diagnostic
review as `diagnosis.json`, with `complete: false`. Run the diagnostic checkpoint:

```sh
python3 /path/to/korean-ux-writing/scripts/audit.py /path/to/diagnosis.json --diagnosis-only
```

This checks context, funnel, inventory and diagnosis without requiring decisions
or `unresolved`. It does not authorize a rewrite or certify a completed audit.
Preserve this snapshot. In the final report, retain the same inventory originals
and diagnostic copy IDs, and record the snapshot location in `diagnosis_ref`. If
later evidence changes a diagnosis, retain the original snapshot and explain the
new evidence. The validator compares fields within one report; it does not read
the referenced snapshot or prove that diagnosis preceded editing.

After the UX and Korean reviews, run the final validator. It reads its adjacent
installed writing-rule and diagnostic-pattern catalogs:

```sh
python3 /path/to/korean-ux-writing/scripts/audit.py /path/to/audit.json --require-complete
```

Without `--require-complete`, a well-formed partial report can pass. A failed audit
exits with status 1. `--diagnosis-only` and `--require-complete` cannot be combined.
Add `--json` for `{valid, complete, mode, errors, limitation}` output.
`complete` in that output is true only when the input claims completeness and the
final declared contract passes. Diagnostic-only output always has `complete:
false` and `mode: "diagnosis-only"`. This is not an independent quality certification.

## Required fields

Unknown extra fields are allowed for project-specific observations. Required keys,
IDs and references are checked; duplicate JSON keys are rejected.

| Field | Content |
| --- | --- |
| `version` | Integer `1`. |
| `complete` | Boolean; false while any coverage, context or product fact is unresolved. |
| `diagnostic_patterns_reviewed` | Every installed `references/translationese.json` pattern ID exactly once; records the catalog review, not a keyword search. |
| `scope.files` | Unique project-relative source/content files in the affected scope. Include shared copy, route definitions, validation and API adapters needed to understand the funnel. |
| `scope.routes`, `scope.states` | Unique routes and states; all must have declared nodes before completion. Name hidden, conditional, loading, failure and success states separately. |
| `scope.discovery` | `{methods: [string], evidence: [evidence ID], limitations: [string]}`. Describe actual discovery methods, not intended checks. |
| `scope.exclusions` | `[{target, reason, evidence: [evidence ID]}]`. Discovered but excluded UI prevents a whole-scope completion claim. Non-UI files need not enter the scope in the first place. Explain scope selection in an optional `scope.rationale`. |
| `evidence` | `[{id, kind, ref, detail}]`; kind is `code`, `runtime`, `spec` or `user`. Record an inspectable location and what was actually observed. These establish product facts, not writing standards. |
| `context_reads` | `[{file, evidence: [evidence ID]}]`; every scoped file must be covered before completion. |
| `funnel.nodes` | `[{id, route, state, kind, reviewed, evidence: [evidence ID], context_files: [file]}]`; kind is `entry`, `screen` or `terminal`. Terminal means an actual outcome or verified boundary, not an unvisited destination. |
| `funnel.edges` | `[{id, from, to, trigger, reviewed, evidence: [evidence ID]}]`; include normal, back, cancel, error and recovery transitions. |
| `inventory` | `[{id, original, protected_tokens: [string], occurrences: [occurrence]}]`; original remains unchanged in this ledger throughout revision. |
| Occurrence | `{id, node_id, file, anchor, state, role}`. Use a stable key/AST or component anchor rather than only a shifting line number. Every occurrence ID is globally unique. |
| `translationese` | `[{id, before, status, patterns: [pattern ID], intent, korean_fit, reason, exception_review, evidence: [evidence ID]}]`; exactly one diagnosis per inventory ID. Optional `source_expression` contains a foreign-language original actually inspected. |
| `decisions` | `[{id, status, before, after, reason, ux: [basis], ko: [basis], occurrence_reviews: [review]}]`; exactly one decision per inventory ID. |
| Basis | `{rule, reason, evidence: [evidence ID]}`. `rule` must exist in installed `references/rules.json` under the matching axis. Explain the rule's applicability and the product fact separately. |
| Review | `{occurrence_id, evidence: [evidence ID], note}`; assess that usage site's context and consequence. |
| `unresolved` | `[{id, reason, evidence: [evidence ID]}]`; include inaccessible screens, missing business facts and unverified behaviors. |

`decisions` and `unresolved` are required for the final audit, but not for the
diagnostic checkpoint. `diagnosis_ref` is a workflow provenance field; its path
and the snapshot contents require manual comparison.

## Diagnosis before revision

Read the diagnostic catalog's cited criteria and exceptions, then inspect each
original in its funnel and all declared usage sites. Begin with lexical and
pragmatic fit: identify what this UI is actually communicating or doing, then
explain whether its Korean word choices and combinations express that intent in
this role. A grammatically valid phrase can still follow an unsuitable
foreign-language expression frame. Absence of a suspicious grammatical form is
not sufficient to finish the diagnosis. Review LT-05 first; LT-01 through LT-04
provide supporting checks and do not replace this contextual assessment.

`translationese.status` is:

- `candidate`: a cited diagnostic pattern may apply in this context. This requires
  at least one known pattern ID. It neither proves translation origin nor permits
  automatic correction.
- `clear`: the reviewed patterns do not establish a translationese problem in the
  inspected context. UX, repetition, spelling or other Korean-expression issues
  may still require revision.
- `uncertain`: the available context or evidence cannot resolve the diagnosis.
  Explain what remains uncertain; this prevents `complete: true`.

Every diagnosis requires the following, including `clear` decisions:

- `intent`: the communicated meaning or executed action confirmed in the product's
  code, specification or other cited product evidence.
- `korean_fit`: a concrete explanation of why the current Korean vocabulary and
  word combinations fit or conflict with that intent and UI role. A statement
  that a keyword or grammatical pattern was not found is insufficient.
- `reason`, `exception_review` and product `evidence`: the diagnosis, the applicable
  exceptions and the inspected context that supports it.

`before` must equal the immutable inventory original. All listed pattern IDs must
exist in the installed catalog; `patterns` may be empty for `clear` or `uncertain`.
Record any considered pattern and why its exception applies rather than assuming
that a passive, noun form or loanword is necessarily translationese. Diagnostic
pattern references supply the external criteria; product evidence supplies the
actual context. The validator checks that explanations are present, not whether
they demonstrate the required reasoning.

If an actual foreign-language original is available, `source_expression` may
record it; cite where it was observed in product `evidence`. Omit this field when
the original is unavailable, and do not reconstruct or assert a translation
origin from the Korean phrase alone. No example expression or suggested
alternative is a universal answer independent of the UI's actual role.

## Revision decisions

`decisions.status` is `changed`, `keep`, `blocked`, or `excluded`. Both `changed` and `keep`
require nonempty UX and Korean bases and reviews for every declared occurrence.
Keeping suitable wording is an outcome, not a skipped review. Blocked and excluded
items preserve the original text and remain in the inventory. Empty basis arrays
are permitted only for those unfinished decisions.

`before` must equal the inventory original. A changed decision must have different
`after` text; other statuses must preserve it. To remove redundant text, retain the
inventory entry and use `status: "changed"`, `after: ""`, with reasons. Do not delete
the ledger row. If a shared string needs different replacements in different
contexts, first split it into distinct stable inventory IDs/source keys while
retaining all original occurrences and their provenance; never apply one global
replacement to incompatible uses.

## Example: one shared message

This excerpt shows one inventory/diagnosis/decision set, not a complete report. Full reports
also need scope, evidence, context reads, `diagnostic_patterns_reviewed` and the
entire funnel graph above. Rule
IDs here illustrate the reference shape; choose rules by their actual meaning.

```json
{
  "inventory": [{
    "id": "copy.saved",
    "original": "설정이 성공적으로 저장되었습니다",
    "protected_tokens": [],
    "occurrences": [
      {"id": "saved.toast", "node_id": "saved", "file": "copy.ts", "anchor": "views.saved.message", "state": "saved", "role": "status"},
      {"id": "history.message", "node_id": "history", "file": "copy.ts", "anchor": "views.history.message", "state": "history", "role": "status"}
    ]
  }],
  "translationese": [{
    "id": "copy.saved",
    "before": "설정이 성공적으로 저장되었습니다",
    "status": "clear",
    "patterns": [],
    "intent": "완료가 확인된 설정 저장 사실을 저장 직후와 기록 화면에서 안내함.",
    "korean_fit": "설정과 저장되었다의 결합은 이미 일어난 저장 결과를 가리키므로 두 화면의 상태 안내 의도와 맞음. 수식의 중복과 제품 말투는 별도로 검토함.",
    "reason": "저장 어휘와 완료 결과를 알리는 서술이 실제 역할에 맞음. 외국어 원문 없이 번역 기원을 추측하지 않음.",
    "exception_review": "피동형이나 격식체만으로 번역투로 판정하지 않고 저장 결과를 전하는 맥락을 확인함.",
    "evidence": ["E-SAVED", "E-VOICE"]
  }],
  "decisions": [{
    "id": "copy.saved",
    "status": "changed",
    "before": "설정이 성공적으로 저장되었습니다",
    "after": "설정을 저장했어요",
    "reason": "저장 결과를 유지하면서 불필요한 수식과 긴 표현을 줄임.",
    "ux": [{"rule": "UX-04", "reason": "실제로 확인한 저장 결과만 전달함.", "evidence": ["E-SAVED"]}],
    "ko": [{"rule": "KO-01", "reason": "제품 말투와 문장 맥락을 확인한 뒤 표현을 다듬음.", "evidence": ["E-VOICE"]}],
    "occurrence_reviews": [
      {"occurrence_id": "saved.toast", "evidence": ["E-SAVED"], "note": "저장 직후의 결과 안내를 확인함."},
      {"occurrence_id": "history.message", "evidence": ["E-SAVED"], "note": "기록 화면에서도 같은 저장 사실을 가리킴."}
    ]
  }]
}
```

## Completion and invariants

A complete report must have every node and transition reviewed, all scoped context
files read, every route/state represented, every node reachable from an entry, and
every node able to reach a terminal. Every discovered copy ID needs a diagnosis
and a decision, with the same immutable original; all diagnostic patterns must
have been reviewed. An uncertain diagnosis prevents completion;
every reviewed copy needs every usage site checked. Limitations, exclusions,
unresolved issues, and blocked/excluded decisions all prevent completion.

The validator preserves a multiset of common `{name}`, `{{name}}`, `${expression}`,
positional braces, printf-style tokens and ICU argument headers. It also compares
common ICU branch selectors, offsets and number markers. It is not a full ICU,
JavaScript or template parser. Use explicit `protected_tokens` for additional
syntax, prices, dates, product names or legally meaningful fragments. Each listed
token must exist in the original and retain the same occurrence count. Validate
framework syntax and meaning with the project's actual tooling as well.

The validator cannot discover omitted UI, verify that an evidence note is true,
detect translation origin, establish diagnostic accuracy, judge Korean fluency,
prove the order of diagnosis and editing, or prove a proposed revision was applied. Source inventory,
funnel inspection, rendered checks and diff verification are separate required
work. Do not turn a mechanically passing report into an unsupported completion
claim. If a destination cannot be inspected, record it as unreviewed and explain
the gap; do not relabel it as a terminal or silently narrow the scope.
