## Context and Scope

The completed [URL creation specification](specs/url-creation/spec.md) defines four visitor scenarios: view the form, create a short URL, see the result, and follow it. Affected stable components are `frontend` and `backend`. This new application needs no migration. Expiry, accounts, analytics, management, and custom aliases remain outside this change.

## Accepted Decisions

- [ADR 0001: component boundaries and same-origin proxy](../../../architecture/adrs/0001-component-boundaries-and-same-origin-proxy.md) accepts separate frontend/backend ownership and frontend proxying. Direct cross-origin requests and a single component were considered; the selected arrangement supports independent delivery and one browser origin.
- [ADR 0002: durable link mappings](../../../architecture/adrs/0002-durable-link-mappings.md) requires persistence before reporting success and survival across backend restarts. Process-local mappings and asynchronous persistence after success were rejected because they can lose acknowledged links.

Both decisions are accepted in the user-provided plan. Technology remains each component owner's choice.

## Maintained Architecture

The [application boundary](../../../architecture/boundary.md) records responsibilities, shared interfaces, addressing, and integration constraints. The [component registry](../../../architecture/components.md) registers `frontend` at https://github.com/intent-driven-dev/url-shortener-fe and `backend` at https://github.com/intent-driven-dev/url-shortener-be, including runtime inputs and deferred delivery details. These supporting records govern component handoffs.

## Boundary Definition and Dependencies

`frontend` owns the form at `/`, result and creation-error display, and proxy. `backend` owns validation, generation, durable mappings, and resolution. The browser calls the frontend; the frontend proxies `/api` and `/s` unchanged to the backend, preserving request bodies, response bodies, statuses, and headers. It relays `302` and `Location` without following redirects server-side.

- `POST /api/links` accepts JSON `{destinationUrl}` containing an absolute HTTP(S) URL. After durable storage succeeds, return `201` JSON `{shortUrl}`, with an absolute URL under `PUBLIC_LINK_ORIGIN` at `/s/{code}`.
- `GET /s/{code}` returns `302` with the complete stored destination in `Location`, preserving path, query, and fragment.
- Errors are JSON `{error:{code,message}}`: `400`/`INVALID_INPUT` for invalid input, `404`/`NOT_FOUND` for unknown codes, and `503`/`STORAGE_UNAVAILABLE` for unavailable storage. Proxy connectivity failure is `503`/`BACKEND_UNAVAILABLE`. Codes and messages are strings; message wording is not prescribed. JSON uses `Content-Type: application/json`.

Invalid input includes malformed JSON, missing/non-string destinations, relative URLs, and non-HTTP(S) schemes. Frontend creation failures display an error and do not appear as successful new links. No authentication, cookies, credentials, or version prefix are required. CORS is inapplicable because browser requests are same-origin. Code format and duplicate-destination reuse remain backend choices subject to correct resolution.

## Acceptance and Runtime

Before startup, acceptance allocates two distinct available ports and passes each component its `PORT`. Both listen on `127.0.0.1`; consumer origins are `http://127.0.0.1:<allocated-port>` without an additional prefix. Frontend receives `BACKEND_ORIGIN` equal to the backend origin; backend receives `PUBLIC_LINK_ORIGIN` equal to the frontend origin. Browser origin and API base origin are the frontend origin; creation uses `/api/links`, and public links use `/s/{code}`. Browser-to-frontend and frontend-to-backend connectivity are required.

Both expose `GET /health`: `200` when usable, otherwise `503`. Backend requires available storage; frontend requires connectivity to a usable backend. Establish backend readiness before frontend readiness. Acceptance storage is isolated per run and retained across backend restarts within the run. Delivery inspection will resolve storage provisioning, install/start commands, and internal configuration from component instructions while verifying these accepted external agreements.

Integrated browser acceptance will bind all four existing scenarios to live components:

| Existing scenario | Acceptance outline |
| --- | --- |
| Visitor views the URL creation form | Open frontend `/`; assert a visible destination field and **Shorten URL** button. |
| Visitor creates a short URL for a destination | Enter the specified Manning URL, submit via the UI, observe a successful proxied `201`, and verify its generated link resolves to that destination. |
| Visitor sees the generated short URL | Submit independently and assert the result area shows the returned absolute short URL. |
| Visitor follows the displayed short URL to its destination | Create independently, click the displayed link, observe the live proxy/backend redirect, and assert browser navigation to the exact specified destination. External destination content need not be asserted. |

Additional integrated boundary checks will exercise the public frontend endpoints and backend health: invalid input returns the agreed `400` envelope; an unknown code returns `404`; unavailable storage makes backend health `503` and link operations return the agreed `503` error without false success. Verify frontend readiness and proxy errors when backend connectivity is unavailable. Use a destination with path, query, and fragment to assert the complete `Location` and browser destination. Create a link, restart only the backend using the same run's storage and allocated port, wait for readiness, then verify the existing link still redirects correctly. Technology-specific failure injection is resolved from delivered storage instructions. These checks supplement the four authoritative scenarios without modifying them.

## Risks and Migration

Proxy header rewriting or redirect following could break destination preservation; integrated checks cover both the raw `Location` and browser navigation. Storage failure or premature success could lose links; creation, readiness, failure, and restart checks cover the durability contract. External destination availability can affect navigation tests; assertions target the outgoing destination and redirect rather than remote page content.

No data migration or existing deployment rollback is needed. Deferred questions are limited to implementation technology and delivery-specific setup. Component implementation and executable acceptance preparation follow later workflow stages; this Design does not create Tasks or implement components.
