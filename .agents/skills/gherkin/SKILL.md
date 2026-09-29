---
name: gherkin
description: Author concrete Gherkin examples inside OpenSpec requirements. Use when expressing or reviewing acceptance behavior.
---

# Gherkin

Start spec.md with one # <capability> title. Use ### Requirement: and #### Scenario: or #### Scenario Outline: headings. Every live requirement includes acceptance scenarios in fenced gherkin; these are the authoritative acceptance behavior, so do not duplicate their steps in prose. Column-zero gherkin fences contain only steps, tables, doc strings, and Examples; never repeat Feature, Rule, or Scenario declarations. Markdown headings supply structure and reports identify requirements and scenarios (original Markdown line numbers are not preserved). Given establishes state, When triggers an action, Then asserts observable results. Use concrete business examples including boundaries and failures. Match outline placeholders and Examples columns. Use explicit Given setup; Background and tag declarations are not supported. Each scenario must have exactly one fence. Examples must have matching placeholders and at least one data row. Do not place tags in discarded prose or hide failures. Do not embed Markdown headings or backtick fences in doc strings. Cucumber validates syntax.


Read canonical specs and only the selected change's deltas, matching full relative
capability paths (including nested paths). Use ADDED, MODIFIED, REMOVED and RENAMED
Requirements sections. ADDED/MODIFIED use SHALL or MUST; MODIFIED includes the full
replacement and all surviving scenarios. REMOVED includes Reason and Migration.
RENAMED uses paired - FROM: and - TO: entries with backticked ### Requirement: names;
renames change only titles and apply before modifications addressed to the new name.
REMOVED/RENAMED have no scenarios. New capabilities need a meaningful Purpose.
See the [harness documentation](../../../verification/README.md) for composition
and generation; edit spec.md, never generated features.
