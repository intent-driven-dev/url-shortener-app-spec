# Run the integrated acceptance tests manually

```sh
# From the repository root, after the first-time setup below:
cd verification
npm run app:start && npm run app:verify
```

This starts both services, generates features, runs Cucumber and boundary checks,
and shuts down automatically—even when verification fails. The commands print
report locations: open `results.html` in the acceptance report directory and
`integration.json` at the printed integration and cleanup evidence path.


Follow the four steps below to test the frontend and backend together. Run all
commands from `verification/`, in the same terminal.

## Before your first run

You need Node.js 22+, Git, and macOS/Linux (or a POSIX environment on Windows).
Network access is needed to download dependencies and component repositories;
the browser scenarios also navigate to the external destination URL.

From the repository root:

```sh
cd verification
npm ci
npx playwright install chromium
```

## 1. Where are the Gherkin feature files generated?

**`scripts/specs.mjs` extracts the Gherkin. `npm test` calls it automatically on
every run**, before invoking Cucumber. There is no separate extraction npm command.

The flow is:

```text
openspec/specs/**/spec.md + openspec/changes/<active>/specs/**/spec.md
                                        (sources, excluding archive)
  → scripts/specs.mjs                    (extracts Gherkin scenarios)
  → .acceptance/<run>/features/**/*.feature
  → Cucumber.js                         (validates bindings, then runs tests)
```

For the current URL creation specification, the source is
[`../openspec/specs/url-creation/spec.md`](../openspec/specs/url-creation/spec.md)
and the generated file is `.acceptance/<run>/features/url-creation/spec.feature`.
Edit the source specification, not the generated file. The next `npm test` reads
your current local specs again; it does not fetch specifications from Git.

Every run uses the effective spec: canonical specs plus delta specs from every
direct active change folder under `openspec/changes/`. Archives and folders
without specs are ignored. With no active changes, canonical specs alone are used.
Active changes are expected to be compatible with each other and canonical specs.

## 2. Start both the frontend and backend

```sh
npm run app:start
```

This runs [`scripts/app.mjs`](scripts/app.mjs). It clones the configured component
revisions into temporary checkouts, installs dependencies, initializes backend
storage, starts the backend followed by the frontend, and waits for both to be
ready. You do not need to start either component separately.

It prints:

```text
Application ready. Revisions, commands and logs: <temporary-directory>
```

That directory contains `startup.json`, `backend-start.log`, and
`frontend-start.log`. The services keep running after the command finishes.
Ports are allocated for this run; `startup.json` records both service URLs under
`runtime.frontendOrigin` and `runtime.backendOrigin`.

Startup uses the pinned revisions in `scripts/app.mjs`, not your local component
working copies or necessarily the latest remote commits.

## 3. Verify everything and shut down automatically

```sh
npm run app:verify
```

The wrapper reads the saved frontend URL and calls plain `npm test`, then runs
the boundary checks. It restores storage and stops both services in a finally
block, including when verification fails. Failures return a nonzero exit code.

`npm test` runs [`scripts/acceptance.mjs`](scripts/acceptance.mjs), which:

1. Generates fresh feature files from the OpenSpec specifications.
2. Runs Cucumber.js with `--dry-run` to check that every step has a matching definition.
3. Runs Cucumber.js for real using `acceptance/steps/`, with Playwright opening
   Chromium and exercising the frontend and backend together.

If binding validation fails, execution does not start. Successful execution
requires all scenarios and steps to pass. `npm test` leaves both services running
when called directly. The `app:verify` wrapper handles shutdown for this walkthrough.

## 4. Find the reports

The test command prints the exact report directory:

```text
Acceptance reports: <path>/verification/.acceptance/<run>
```

Open `results.html` in your browser to see the test results.

| File inside that run directory | What it contains |
| --- | --- |
| `results.html` | Cucumber execution results: passed, failed, and skipped steps |
| `execution.log` | Execution output and error details |
| `bindings.html` / `bindings.log` | Step-binding validation results and output |
| `features/` | The generated `.feature` files used for this run |
| `results.json` / `summary.json` | Machine-readable execution results and summary |

If binding validation fails, start with `bindings.html` and `bindings.log`;
execution reports will not exist yet. Steps shown as skipped in the binding
report are normal for a dry run. A skipped execution step may follow an earlier
failure; it does not necessarily mean its definition is missing.

The wrapper also prints the exact `integration.json` path. That report records
boundary checks, acceptance exit status, and cleanup evidence. Shutdown is
automatic; test reports, temporary checkouts, service logs, and `startup.json`
remain available afterward. If you only started the services without verifying,
run `npm run app:stop` to stop them manually.

---

## Reference for maintaining the verification tooling

The sections below are for changing specs, configuring deliveries, or running
additional checks. They are not prerequisites for the manual walkthrough.

### Specification and step-definition rules

`npm test` composes canonical specs with all active change specs: ADDED adds a requirement, MODIFIED replaces the entire
requirement, REMOVED removes it, and RENAMED renames it before other operations.
Keep unaffected scenarios in full MODIFIED requirements. Canonical requirements
outside the delta remain intact. An empty suite fails explicitly.

Each `#### Scenario: name` heading supplies the scenario name; exactly one fenced
`gherkin` block supplies its steps. Do not repeat Feature or Scenario headers
inside fences. `Examples:` makes an outline; each Examples block must provide
columns for placeholders in steps, tables, and doc strings. Empty scenarios,
malformed renames, and unsupported delta operations are rejected. Renames are
read from RENAMED Requirements outside fenced content.

Implement step definitions in `acceptance/steps/*.mjs` or ESM `.js`, using
`@cucumber/cucumber`, real HTTP/browser interactions, and assertions. Do not use
stub assertions, forced failures, or pending placeholders. Connection failures
are marked as unavailable-application evidence, not exercised behavior.

Generated files under `.acceptance/` are disposable; `spec.md` is authoritative.
During delivery, record durable commands, results, report locations, revisions,
and delivery evidence in the active change's
`openspec/changes/<name>/verification.md`. Reports can contain application data;
do not commit secrets.

### Component startup configuration

The `application` section in `scripts/app.mjs` configures published deliveries.
For a new delivery, refresh the Linear delivery gate before startup and populate
configuration from the accepted Design, component registry, and delivered setup
instructions. List components in dependency order with:

- A stable `id`, user-provided `repository`, and delivered `revision` when known.
- `install` and `start` shell commands, optional `provision`, checkout-relative
  `cwd`, and `env`. Use an explicit no-op install command if none is needed.
- HTTP `readiness.url`, expected `status` (default 200), and `timeoutMs`
  (default 60000).

Startup allocates distinct loopback ports and isolated storage. The backend runs
`npm ci`, `npm run storage:init`, then `npm start`; the frontend runs `npm ci`
and `npm start`. `startup.json` records exact revisions, checkouts, commands,
readiness times, and the nonsecret runtime origins and storage directory.
Arbitrary environment values are not persisted; avoid secrets in commands.

Specification and startup-state paths are keyed to the repository root,
independently of the caller's working directory. Temporary state, checkouts,
and logs stay outside tracked source. Partial startup failures clean up owned
process groups; stopping checks ownership before signaling processes.

If a hard kill leaves a startup lock, inspect the reported state directory and
confirm no startup is active before removing the lock. Remove temporary evidence
and checkouts only after recording any needed results.

To test an externally managed application, set `FRONTEND_ORIGIN` to its frontend
URL and run `npm test`. Manage that application's lifecycle yourself.

### Boundary checks

`app:verify` runs these after Cucumber: readiness, invalid-input responses,
redirect preservation, backend restart durability, and storage outage/recovery.

Restart controls check ownership and retain backend port and storage. Storage
outages rename the storage directory to its sibling `.offline` path; restoration
does not edit mappings or reinitialize storage. External navigation errors fail
the checks.

The existing `app:verify` wrapper writes
`.acceptance/<timestamp>-integration/integration.json`, restores storage, and
calls `app:stop` in a finally block.

### Harness maintenance and acceptance failures

```sh
npm run test:harness
```

This tests the verification infrastructure with temporary fixture repositories
and HTTP services. It does not run application acceptance or change Linear.

Application acceptance checks the accepted integration agreements, including
origins, API/public-link URLs, CORS/credentials, and readiness. Correct component
behavior in its owning repository, obtain a new delivery, and repeat the delivery
gate and integrated acceptance. Do not drop scenarios or weaken assertions to
make acceptance pass. Harness or binding defects may be fixed while preserving
the specified expectations. Node/Cucumber is verification tooling; component
implementations may use any language.
