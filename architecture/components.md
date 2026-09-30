# Component registry

These stable IDs and Git repositories are supplied by the accepted user plan. Governing decisions: [ADR 0001](adrs/0001-component-boundaries-and-same-origin-proxy.md) and [ADR 0002](adrs/0002-durable-link-mappings.md). The [boundary](boundary.md) is the shared integration contract.

| Stable ID | Git repository | Responsibilities | Runtime inputs |
| --- | --- | --- | --- |
| `frontend` | https://github.com/intent-driven-dev/url-shortener-fe | Form at `/`, result and creation-error display, unchanged same-origin proxy for `/api` and `/s`. | Allocated `PORT`; `BACKEND_ORIGIN` equal to backend consumer origin. |
| `backend` | https://github.com/intent-driven-dev/url-shortener-be | Destination validation, short-link generation, durable mappings, redirects. | Allocated `PORT`; `PUBLIC_LINK_ORIGIN` equal to frontend consumer origin; run-isolated durable storage provisioned using delivered instructions. |

## Known runtime setup

Acceptance allocates distinct ports before startup. Both components listen on `127.0.0.1`; their consumer origins are `http://127.0.0.1:<allocated-port>`, with no additional prefix. Browser origin, API base origin, and public-link origin are the frontend origin. Frontend-to-backend traffic uses the backend origin. No authentication, cookies, credentials, API version prefix, or browser CORS setup is needed.

Both expose `GET /health`, returning `200` when usable and `503` otherwise. Backend usability requires available storage. Frontend usability requires connectivity to a usable backend. Start the backend and establish readiness before testing frontend readiness. Keep each run's storage across backend restarts; never reuse another run's mappings.

## Delivery inspection

Owners choose technology. Resolve repository-specific install/start commands, storage provisioning, and internal configuration from delivered instructions. Record those details during delivery inspection and verify they implement the accepted external contract. No component implementation belongs in this repository.
