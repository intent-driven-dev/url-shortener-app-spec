---
name: adrs
description: Consult and record durable architectural decisions during design. Use when a significant lasting choice needs rationale and consequences.
---

# ADRs

Reuse accepted decisions without asking for confirmation again. Read `architecture/adrs/` during Design and link relevant decisions from the change's `design.md`. Create an ADR for a consequential boundary, persistence model, external dependency, or similar choice whose rationale should survive the change. Routine implementation choices stay in `design.md`.

Use the next available numeric filename, such as `0001-<decision>.md`. Read and use [the MADR minimal template](assets/adr-template-minimal.md) for every new ADR, based on [MADR 4.0.0](https://github.com/adr/madr/blob/4.0.0/template/adr-template-minimal.md). Preserve its headings and replace its placeholders with the context, considered options, chosen option and justification, and positive and negative consequences. Link related specs or prior ADRs within the relevant sections.

Prepend YAML frontmatter with `status: proposed` for a new undecided record. Distinguish a proposed decision from an accepted decision and follow the project's actual decision authority; do not infer acceptance from file creation. Record an accepted status only when supported by that authority.

When replacing a decision, create a successor and link both records with supersedes/superseded-by references and their status. Preserve the historical rationale. Do not create empty ADRs merely to populate the directory.
