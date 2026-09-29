# Architecture records

This setup makes no application architecture decisions. During the first feature's
Design, create `boundary.md` and `components.md` from accepted, user-provided
component decisions. Both are required for Design completion.

- `adrs/NNNN-title.md`: status, context, decision, alternatives, consequences and
  supersedes/superseded-by links. Reuse accepted decisions; preserve history.
- `boundary.md`: current component responsibilities, shared contracts and
  integration constraints; link governing ADRs.
- `components.md`: stable component ID, user-provided Git repository, responsibility,
  accepted external configuration, addressing, readiness and ADR links. Defer
  install/start commands and internal configuration until delivery inspection.

Ask for missing or conflicting splits/repositories. Do not infer them from folders.

Before Design completion and component handoff, resolve all applicable integration agreements: API operations (methods/paths), request/response payloads, statuses and errors, authentication, versions, dependencies and caller/provider relationships. Record schemes, consumer-facing hosts/ports and path prefixes separately from listening addresses. Require agreed acceptance-environment values or an explicit allocation/discovery mechanism. Capture browser origin, API base URL, public-link origin, browser connectivity, CORS/credential behavior, externally required configuration inputs and readiness checks. Mark inapplicable items explicitly. Component technology remains its owner's choice. Defer install/start commands and internal configuration details until delivery inspection, never externally required agreements.

Carry accepted contracts into every affected component handoff. Integrated acceptance
verifies these agreements, including browser connectivity, rather than adopting
incompatible delivered defaults.
