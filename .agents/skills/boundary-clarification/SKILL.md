---
name: boundary-clarification
description: Resolve missing or conflicting component boundaries and repositories during application Design, reusing accepted architecture.
---

# Boundary clarification

Before completing Design or preparing dependent Tasks, read the proposal, completed
specs, existing Design, accepted ADRs, `architecture/boundary.md` and
`architecture/components.md`. Reuse accepted decisions and prior user answers
without repeated confirmation. Ask only about missing or conflicting decisions and
user-provided repositories. Every component requires a user-provided Git repository;
do not infer ownership or repositories from neighboring directories. Distinguish
observations, proposals and accepted decisions; silence is not acceptance.

Resolve responsibilities and exclusions. Before Design completion and component handoff, resolve all applicable integration agreements: API operations (methods/paths), request/response payloads, statuses and errors, authentication, versions, dependencies and caller/provider relationships. Record schemes, consumer-facing hosts/ports and path prefixes separately from listening addresses. Require agreed acceptance-environment values or an explicit allocation/discovery mechanism. Capture browser origin, API base URL, public-link origin, browser connectivity, CORS/credential behavior, externally required configuration inputs and readiness checks. Mark inapplicable items explicitly. Component technology remains its owner's choice. Defer install/start commands and internal configuration details until delivery inspection, never externally required agreements.

When frontend/backend components fit the accepted architecture, use the optional
[FE/BE questionnaire](references/fe-be-questionnaire.md) to identify unresolved
integration details. It is an example, not a required component split; reuse known
answers and ask only about missing or conflicting details.

Use [adrs](../adrs/SKILL.md) for durable decisions. Maintain both
`architecture/boundary.md` (responsibilities, shared interfaces, integration
constraints and governing ADR links) and `architecture/components.md` (stable IDs,
user-provided repositories, responsibilities, known runtime setup, deferred details
and ADR links). Update both when accepted decisions change; preserve unchanged
records. Both documents are mandatory before Design completion, supporting records
rather than lifecycle stages. Link them and affected component IDs from Design.

Draft useful work while questions are pending, marking unresolved decisions clearly.
Do not declare Design complete or prepare dependent handoffs until architectural
conflicts, required repository gaps and applicable integration agreements are resolved. File presence or CLI artifact
status alone does not establish completion. Keep implementation in component repos.
