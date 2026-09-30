---
status: accepted
---
# Persist link mappings before reporting creation success

## Context and Problem Statement

Visitors must be able to follow a generated link after the backend restarts. A creation response must not promise a mapping that storage failed to retain. The [URL creation design](../../openspec/changes/url-creation/design.md) needs a durability agreement without choosing component implementation technology.

## Considered Options

- Durable mappings committed before creation succeeds, with storage technology chosen by the backend owner.
- Process-local, in-memory mappings.
- Respond successfully before asynchronously persisting the mapping.

## Decision Outcome

Chosen option: "Durable mappings committed before creation succeeds, with storage technology chosen by the backend owner", because successful links must survive restarts and storage failures must be observable. This decision is accepted by the user-provided plan.

The backend returns `201` only after durable storage succeeds; unavailable storage yields `503` and makes backend readiness fail. Stored destinations retain their complete path, query, and fragment. Acceptance storage is isolated per run and retained across backend restarts within that run. Technology-specific provisioning and configuration are resolved at delivery inspection against this requirement. Ownership follows [ADR 0001](0001-component-boundaries-and-same-origin-proxy.md) and the [boundary](../boundary.md).

### Consequences

- Good, because acknowledged links survive process restarts.
- Good, because storage failure cannot produce a falsely successful creation response.
- Bad, because storage availability and write latency affect creation and readiness.
- Bad, because acceptance must provision isolated durable storage and retain it during restart checks.
