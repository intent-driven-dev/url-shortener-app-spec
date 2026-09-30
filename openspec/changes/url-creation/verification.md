# URL creation verification

## Acceptance preparation — 2026-09-30

Read proposal, specification, Design, Tasks, boundary, registry, and both accepted ADRs. Parent INT-54 was fetched as Ready and moved to In Progress successfully at 2026-09-30T02:26:05.155Z through Linear.

All commands below ran from `verification/`:

```sh
npm install --save-dev playwright
npx playwright install chromium
npm test -- --change url-creation
```

Playwright Chromium installed successfully. The harness composed only canonical specifications plus `url-creation`, producing all four authoritative scenarios. JavaScript bindings in `verification/acceptance/steps/url-creation.mjs` exercise browser UI, observe the real creation response, assert status/payload/public origin, resolve real links, and observe redirect and destination navigation. Binding validation resolved every step, including downstream assertions; no undefined, ambiguous or pending steps.

Additional executable Design checks are in `verification/acceptance/boundaries.mjs`: invalid JSON and destinations, unknown codes, full path/query/fragment redirect and browser preservation, both health dependencies, proxy connectivity errors, storage errors with no successful UI result, and durability after backend restart. Delivery-specific operational controls remain to be resolved after the gate. They must preserve the run's backend port and storage across restart; missing controls fail explicitly. No component startup configuration was populated.

Initial run: exit 1; 4 scenarios failed, 22 specification steps (4 failed, 18 skipped). Browser startup and cleanup succeeded. Every failure was genuine `net::ERR_CONNECTION_REFUSED` opening `http://127.0.0.1:3100/`. This is **unavailable-application evidence**, not exercised behavior. Downstream skips are retained only as initial-run evidence.

Reports retained locally under `verification/.acceptance/2026-09-30T02-27-46.889Z-71498/`: `features/url-creation/spec.feature`, `bindings.json`, `bindings.log`, `results.json`, `execution.log`, and `summary.json`. These generated reports are ignored by Git. No components were started or inspected.

## Delivery gate

User-requested fresh report run after deletion of prior reports: `npm test -- --change url-creation` from `verification/`, 2026-09-30T02:32:04.699Z. Reports now retained at `verification/.acceptance/2026-09-30T02-32-04.699Z-72578/`, including `bindings.html`, `results.html`, JSON reports and logs. Binding validation succeeded for all four scenarios; execution exited 1 with 4 connection-refused failures and 18 skipped specification steps. Prior report paths above are historical and may no longer exist after user deletion. No applications were started.

HTML reporting follow-up: added Cucumber's built-in HTML formatter for binding validation and execution. Re-ran `npm test -- --change url-creation` from `verification/` on 2026-09-30 at 02:30 UTC. All bindings resolved again; execution again failed solely on connection refusal (4 failed, 18 skipped specification steps). Standard reports are retained at `verification/.acceptance/2026-09-30T02-30-45.904Z-72432/bindings.html` and `results.html`. No applications were inspected or started; this reporting-only rerun does not complete any dependent delivery task.

Retrieved both issues and their complete comment lists on **2026-09-30 02:28:31 UTC**. Both remote reads succeeded; both comment lists were empty, and neither issue contained delivery revision/setup evidence or attachments.

| Component | Current issue/status | Issue updated at | Immutable revision/setup evidence |
| --- | --- | --- | --- |
| backend | [INT-58](https://linear.app/intent-driven-dev/issue/INT-58/implement-url-creation-backend-backend) — Ready (unstarted) | 2026-09-30T02:20:32.356Z | Absent; description contains handoff requirements only |
| frontend | [INT-59](https://linear.app/intent-driven-dev/issue/INT-59/implement-url-creation-frontend-frontend) — Ready (unstarted) | 2026-09-30T02:20:11.601Z | Absent; description contains handoff requirements only |

**Apply paused at the delivery gate: 2/7 tasks complete.** Task 2.1 remains unchecked because neither child is Done with usable delivery evidence. No delivery repositories were inspected, checked out, installed, or started; dependent tasks were not executed. Parent remains In Progress. No review request was posted. Resume by refreshing this gate once both children have usable immutable revision and setup evidence.

## Refreshed delivery gate — 2026-09-30

User authorized acceptance of completed published deliveries. Updated the existing delivery comments (no duplicates), moved both children to Done, and fetched both again successfully. INT-54 was fetched In Progress with no comments; canceled historical children were untouched.

| Component | Status | Updated / completed UTC | Published revision and setup | Component evidence |
| --- | --- | --- | --- | --- |
| [INT-58](https://linear.app/intent-driven-dev/issue/INT-58/implement-url-creation-backend-backend) | Done | 05:28:39.533 / 05:28:39.515 | [75d3e6c5366c4cd4699c9b3768bc65fad01cad01 README](https://github.com/intent-driven-dev/url-shortener-be/blob/75d3e6c5366c4cd4699c9b3768bc65fad01cad01/README.md) | Published README: 7/7 tests, strict validation; contracts, storage outage/recovery, actual restart |
| [INT-59](https://linear.app/intent-driven-dev/issue/INT-59/implement-url-creation-frontend-frontend) | Done | 05:28:59.449 / 05:28:59.421 | [9af081d85d52d010ae9ca3a87d339293044ed7b2 README](https://github.com/intent-driven-dev/url-shortener-fe/blob/9af081d85d52d010ae9ca3a87d339293044ed7b2/README.md) | [Published evidence](https://github.com/intent-driven-dev/url-shortener-fe/blob/9af081d85d52d010ae9ca3a87d339293044ed7b2/openspec/changes/url-creation/verification.md): 12 HTTP tests, 5 browser tests, strict validation |

Published setup was fetched successfully with approved network execution after sandbox DNS denial. Backend: npm ci; npm run storage:init once with unique STORAGE_DIR; npm start with PORT/PUBLIC_LINK_ORIGIN. Frontend: npm ci; npm start with PORT/BACKEND_ORIGIN. Both document loopback binding and dependency-aware /health.

## Live integration and completion — 2026-09-30

Delivery gate refreshed on both resumptions: INT-58/INT-59 remained Done at the timestamps above; INT-54 remained In Progress. No canceled issue changed.

### Startup and addressing

From `verification/`, `npm run app:start` initially hit sandbox loopback `EPERM`; the first escalation request was interrupted. No active state remained. On continuation, approved `npm run app:start` succeeded at 06:09:13.631 UTC. Fresh workspace: `/var/folders/7y/kl1g2nmx6mncjx3mrv42zwq80000gn/T/app-checkout-1X68fu`.

For each component, the harness executed `git clone --no-checkout -- <repository> <checkout>`, `git rev-parse --verify <pinned-revision>^{commit}`, and `git checkout --detach <resolved-revision>`. Resolved revisions exactly matched the gate pins. Commands executed in these checkouts:

| Component | Working directory below workspace | Resolved revision | Commands | Readiness 200 UTC |
| --- | --- | --- | --- | --- |
| backend | `backend/` | `75d3e6c5366c4cd4699c9b3768bc65fad01cad01` | `npm ci`; `npm run storage:init` once; `npm start` | 06:09:11.324 |
| frontend | `frontend/` | `9af081d85d52d010ae9ca3a87d339293044ed7b2` | `npm ci`; `npm start` | 06:09:13.631 |

Backend origin/health: `http://127.0.0.1:57447` and `/health`. Frontend origin/health: `http://127.0.0.1:57448` and `/health`. Distinct loopback ports were allocated before startup. Backend received `PORT=57447`, `PUBLIC_LINK_ORIGIN=http://127.0.0.1:57448`, and `STORAGE_DIR=<workspace>/storage`; frontend received `PORT=57448`, `BACKEND_ORIGIN=http://127.0.0.1:57447`. Consumer/browser/API/public-link origins conform to accepted Design.

Isolated storage `<workspace>/storage` was initialized once, outside source. Backend restarts used only `npm start` in the original backend checkout, retaining storage and port. Genuine outage renamed storage to `<workspace>/storage.offline`, then restored it; mappings were never edited or reinitialized. Nonsecret endpoints and storage location are retained in `<workspace>/startup.json`, along with exact commits, commands, readiness timestamps, owned process records and logs.

### Acceptance and boundaries

All commands ran from `verification/` with approved loopback/browser execution:

```sh
FRONTEND_ORIGIN=http://127.0.0.1:57448 npm test -- --change url-creation
FRONTEND_ORIGIN=http://127.0.0.1:57448 BACKEND_ORIGIN=http://127.0.0.1:57447 ACCEPTANCE_CONTROLS=./acceptance/controls.mjs node acceptance/boundaries.mjs
npm run test:harness
npm run app:verify
```

First live acceptance passed all 4 scenarios and all 22 specification steps, exit 0. Reports: `verification/.acceptance/2026-09-30T06-15-41.683Z-6450/`. Standard `bindings.html` and `results.html`, JSON reports, logs and summary are retained. Every binding resolved, including downstream steps; execution had no undefined, ambiguous, pending, skipped or filtered cases. Visible result assertions now target the delivered `role=status` region and its exact selectable link. Navigation exceptions are no longer caught as success. Real external Manning navigation succeeded.

The additional boundary command exited 0: invalid JSON/missing/non-string/relative/non-HTTP(S) input; unknown codes; exact path/query/fragment `Location` and browser navigation; frontend dependency readiness/proxy errors during real backend outage; acknowledged link survival after owned backend restart; real storage failure yielding backend/frontend health 503, API/resolution 503 envelopes and visible browser error without a successful link; restoration with retained mappings.

`app:verify` was added to use the persisted runtime and guarantee restoration plus `npm run app:stop` in a finally block, including failures. Its real verification run exited 0: repeated all 4 scenarios/22 steps, passed all 8 boundary checkpoints including successful creation after recovery, restored storage, and invoked `npm run app:stop` successfully. Final standard Cucumber reports: `verification/.acceptance/2026-09-30T06-21-44.622Z-8997/bindings.html` and `results.html`; features, JSON reports, logs and summary remain alongside them. Boundary/runtime/cleanup result: `verification/.acceptance/2026-09-30T06-21-44.506Z-integration/integration.json`.

### Harness checks and known repository failure

`npm run test:harness` exited 1: **20 passed, 1 failed**, 0 skipped/canceled/todo. The sole failure remains `repository layout isolates all verification tooling`: root `README.md` is absent. This existing failure was reported separately; its assertion was neither weakened nor removed. Product acceptance and the new focused harness check passed.

The new harness check verifies persisted distinct origins/storage, ownership rejection without stopping a foreign process record, restart with the same endpoint/storage and renewed cleanup records, restored storage contents, cleanup after a leftover outage, closed endpoints and removed active state. Existing unconfigured CLI checks now test an explicitly empty configuration instead of attempting the newly configured live startup. Temporary fixture processes were stopped in finally blocks.

### Cleanup

`app:verify` ran `npm run app:stop`, exit 0, stopping all owned groups at 06:21:50.225 UTC. Storage was restored. A final process-group and endpoint check succeeded at **07:00:09.956 UTC**: no owned group leaders or descendants in `ps`, frontend/backend endpoints closed, active state removed, `storage.offline` absent, retained `storage/links.json` present. Evidence: `verification/.acceptance/2026-09-30T06-21-44.506Z-integration/cleanup.json`. Startup evidence and temporary checkouts remain available at the workspace above. A first audit invocation used stdin filename `-` and hit the existing CLI realpath guard; the corrected invocation passed.

Parent comments were inspected successfully and empty before the review request. Application Done and archival remain separate: human acceptance and successful archive are required. No component changes, commits or pushes were performed.

Review reconciliation succeeded: one comment `74ffdfed-507e-4456-bc2f-979cb052b158` posted on INT-54 at 2026-09-30T07:05:35.898Z after inspecting its empty comment list; fetched again to confirm one request and parent In Progress. All 7/7 Apply tasks complete. `openspec validate url-creation --strict` and `git diff --check` passed. Known root README layout failure remains separately reported.
