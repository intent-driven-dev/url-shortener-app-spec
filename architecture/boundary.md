# Application boundary

The accepted [component split and proxy decision](adrs/0001-component-boundaries-and-same-origin-proxy.md) and [durability decision](adrs/0002-durable-link-mappings.md) govern this boundary. See the [component registry](components.md) and [URL creation design](../openspec/changes/url-creation/design.md).

## Responsibilities

| Owner | Responsibilities |
| --- | --- |
| `frontend` | Serve the creation form at `/`, display generated links and creation errors, proxy `/api` and `/s` unchanged to `backend`. |
| `backend` | Validate destinations, generate codes, durably store mappings, resolve short links and return redirects. |
| Application specification repository | Application behavior, shared contracts, delivery coordination, and integrated acceptance. |

Component owners choose implementation technology. Expiry, accounts, analytics, link management, and custom aliases are outside URL creation.

## Shared interfaces

The browser calls the frontend origin. The frontend is the backend's caller for proxied operations and preserves methods, paths, JSON bodies, response statuses, and headers, including `Location`; it must relay redirects without following them itself.

| Operation | Request | Success | Failure |
| --- | --- | --- | --- |
| `POST /api/links` | JSON `{destinationUrl}`; `destinationUrl` is a string containing an absolute HTTP(S) URL. | `201`, JSON `{shortUrl}` after durable storage succeeds; `shortUrl` is an absolute URL under `PUBLIC_LINK_ORIGIN` at `/s/{code}`. | `400` invalid input; `503` unavailable storage. |
| `GET /s/{code}` | Generated code in the path. | `302`, `Location` containing the complete stored destination, preserving path, query, and fragment. | `404` unknown code; `503` unavailable storage. |

JSON requests/responses use `Content-Type: application/json`. Errors use `{error:{code,message}}`, with string `code` and a human-readable string `message`. Stable codes are `INVALID_INPUT` for `400`, `NOT_FOUND` for `404`, and `STORAGE_UNAVAILABLE` for storage `503`. A frontend unable to reach the backend returns `503` with code `BACKEND_UNAVAILABLE` in the same envelope. Exact message wording is not a cross-component contract. Invalid input includes malformed JSON, a missing or non-string destination, relative URLs, and non-HTTP(S) schemes. Creation errors are visible in the frontend and must not be displayed as successful new links.

No authentication, cookies, credentials, or API version prefix are required. The browser uses same-origin requests; CORS is inapplicable to this flow. Code format and duplicate-destination reuse are backend choices, provided generated links resolve to their associated destinations.

## Addressing, configuration, and readiness

Acceptance allocates two distinct available ports before startup and passes each component its `PORT`. Both listen on `127.0.0.1`. Consumer origins use HTTP: frontend `http://127.0.0.1:<frontend-port>` and backend `http://127.0.0.1:<backend-port>`, with no additional path prefix. The browser can reach the frontend; the frontend can reach the backend.

The frontend receives `BACKEND_ORIGIN` equal to the allocated backend origin. The backend receives `PUBLIC_LINK_ORIGIN` equal to the allocated frontend origin. The browser's API base is its frontend origin, with `/api/links`; public links use that same origin with `/s/{code}`.

Each component exposes `GET /health`: `200` when usable, otherwise `503`. Backend readiness requires available storage; frontend readiness requires backend connectivity to a usable backend. Health response bodies are not prescribed.

Acceptance storage is isolated per run and survives backend restart during that run. Storage technology, provisioning details, install/start commands, and internal configuration remain for delivery inspection; delivered setup must satisfy these external agreements. No migration is required for this new application.
