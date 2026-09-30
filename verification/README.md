# Acceptance verification

Node/Cucumber is verification tooling; components may use any implementation language.

## Commands

Requires Node.js 22+ and Git. Startup/process cleanup supports macOS/Linux (POSIX
process groups and `ps`); Windows needs a POSIX environment.

```sh
cd verification
npm ci
npm run test:harness
npm run app:start
npm run app:verify # url-creation: acceptance + boundaries + guaranteed app:stop
# Or run acceptance manually with FRONTEND_ORIGIN from startup.json, then app:stop.
```

All paths below are relative to `verification/` unless stated otherwise.
Specifications are read from the repository root, independently of the caller’s
working directory. Startup state is also keyed by that repository root, so start
and stop use the same identity from any working directory.

`npm test` without `--change` uses canonical specifications only. With `--change`,
it composes those specs with that one active change; other changes and archives
are excluded. ADDED adds, MODIFIED replaces the entire requirement, REMOVED removes,
and RENAMED renames. Authors must retain unaffected scenarios in full MODIFIED
requirements. Canonical requirements outside the delta remain intact.

A `#### Scenario: name` heading supplies the scenario name; exactly one fenced
`gherkin` block supplies its steps. An `Examples:` section makes it an outline.
Do not repeat Feature or Scenario headers inside fences. Tables and doc strings
are supported. Every Examples block must supply columns for placeholders in steps,
tables and doc strings. Empty scenarios/outlines, malformed rename entries and
unsupported delta operation sections are rejected. Renames are read only from
RENAMED Requirements outside fenced content and apply before other operations.

Implement JavaScript step definitions in `acceptance/steps/*.mjs` (or ESM `.js`),
using `@cucumber/cucumber`, real HTTP/browser interactions, and assertions. Read
endpoints from environment variables appropriate to the accepted Design. Browser
acceptance requires a separately installed browser driver; Cucumber does not provide
one. Install the chosen driver and its required browsers when browser acceptance is
needed (see [Cucumber browser automation](https://cucumber.io/docs/guides/browser-automation/)). No generic
product steps, stub assertions, forced failures or pending placeholders are supplied.
The harness validates every binding with a full dry run before executing anything.
A failing earlier step may skip later bound steps in the initial failure run; final
acceptance requires every scenario and step to pass. Reviewing real assertions and
rejecting intentionally manufactured failure remain the apply agent's responsibility.

Generated features, binding reports, execution logs and summaries are disposable
under `.acceptance/<run>/`; `spec.md` remains authoritative.
Each run also includes Cucumber's standard `bindings.html` (dry-run binding
validation) and `results.html` (execution). Undefined or ambiguous bindings appear
in binding validation; bound steps appear skipped during a dry run. Execution
distinguishes passed, failed, and skipped steps. A skipped step is not evidence
that its definition is missing.

Copy durable commands,
results, report locations, revisions and delivery evidence into the feature's
`openspec/changes/<name>/verification.md` at the repository root. Reports flag connection failures as unavailable-application
evidence, which does not demonstrate that behavior was exercised. Reports may
contain application data; do not commit secrets.

## Application startup configuration

The `application` section in `scripts/app.mjs` pins the published URL creation
deliveries. It allocates distinct loopback ports and run-isolated storage. After the delivery gate passes, populate it from Design,
the component registry and delivered repository instructions. Each component has:

- Stable `id`, user-provided `repository`, and delivered `revision` when known.
- `install` and `start` shell commands, optional checkout-relative `cwd`, and `env`.
- HTTP `readiness.url`, expected `status` (default 200), and `timeoutMs` (default 60000).

List components in dependency order. Explicitly use a no-op install command if the
delivered repository needs no dependencies. Environment values are passed to the
component but not written into startup metadata; avoid putting secrets in commands.
Tests can also target an already-running application; `npm test` does not start or
stop it.

`app:start` clones fresh temporary checkouts, resolves pinned revisions or the remote
default branch to exact commits, installs, starts and awaits readiness. Temporary
state, checkouts and logs stay outside tracked source. Startup prints their location
and retains `startup.json` evidence after stopping. Partial failures clean up owned
process groups. `app:stop` checks an ownership token before signaling each group;
it leaves externally managed processes alone. Call it after verification, including
failed verification. A leftover startup lock after a hard kill requires inspecting
the printed temporary state and confirming no startup is active before removing
that lock. Temporary evidence/checkouts can be removed after recording needed results.

`npm test -- --change url-creation` selects the four application scenarios.
Without a selected change, empty canonical specifications still fail explicitly.
`npm run test:harness` tests infrastructure using temporary fixture repositories and
HTTP services; it is not application acceptance and makes no Linear changes.

Acceptance verifies accepted integration agreements, including addressing, browser
origins, API/public-link URLs, CORS/credentials and readiness. Delivered defaults
must conform to those agreements; resolve internal configuration after delivery.
Do not change specs, drop scenarios or weaken assertions to make acceptance pass.
Correct component behavior in its owning repository, obtain a new delivery and
repeat the delivery gate and integrated acceptance. Binding/harness defects may be
fixed while preserving the specified expectations.

## URL creation live verification

Refresh the Linear delivery gate before startup. Backend starts first with `npm ci`,
`npm run storage:init` once and `npm start`; frontend uses `npm ci` and `npm start`.
`startup.json` retains `runtime.frontendOrigin`, `runtime.backendOrigin`, and
`runtime.storageDirectory`, exact revisions, checkouts, commands and readiness times.
Only these nonsecret runtime inputs are persisted; arbitrary environment values are not.

After `npm run app:start`, run `npm run app:verify`. It reads the same persisted runtime,
runs `npm test -- --change url-creation` with the allocated frontend origin, then the
additional live boundary suite. It restores storage and invokes `npm run app:stop`
in a finally block, including after failures. Cucumber retains standard HTML reports;
`.acceptance/<timestamp>-integration/integration.json` records boundary checks and cleanup.
External navigation errors fail verification.

For manual boundary execution, set `FRONTEND_ORIGIN`, `BACKEND_ORIGIN`, and
`ACCEPTANCE_CONTROLS=./acceptance/controls.mjs`, then run
`node acceptance/boundaries.mjs`. Stop the services afterward, including after failures.
Restart controls verify ownership before stopping the backend and retain its port
and storage. Storage outages rename the directory to its sibling `.offline` path;
restoration never edits mappings or reinitializes storage. `app:stop` also restores
a leftover outage and records stopped processes in retained startup evidence.
