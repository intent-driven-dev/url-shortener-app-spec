---
status: accepted
---
# Separate frontend and backend with a same-origin proxy

## Context and Problem Statement

The [URL creation specification](../../openspec/changes/url-creation/specs/url-creation/spec.md) needs a browser form, result display, creation-error display, durable link creation, and redirects. The user-approved design plan assigns implementation to two supplied repositories; this repository owns application specifications, contracts, delivery coordination, and integrated acceptance.

## Considered Options

- Separate frontend and backend, with the frontend proxying browser requests.
- Separate frontend and backend, with direct cross-origin browser requests.
- One component owning both browser UI and link storage/resolution.

## Decision Outcome

Chosen option: "Separate frontend and backend, with the frontend proxying browser requests", because it matches accepted ownership and gives the browser one origin for the form, API, and public links. This decision is accepted by the user-provided plan.

`frontend` owns the form, result and error display, and unchanged `/api` and `/s` proxying. `backend` owns validation, generation, durable mappings, and redirects. The [component registry](../components.md) records the supplied repositories; the [boundary](../boundary.md) records contracts and runtime addressing. Component owners select their technology independently. Persistence is governed by [ADR 0002](0002-durable-link-mappings.md).

### Consequences

- Good, because responsibilities and independent component delivery are explicit.
- Good, because same-origin browser requests need no CORS or credential agreement.
- Bad, because the frontend must preserve proxy payloads, statuses, and redirect headers, and depends on backend connectivity.
- Bad, because integrated acceptance must coordinate two processes and verify the proxy as well as the backend.
