## Component Handoffs

Parent: [INT-54 — URL Creation](https://linear.app/intent-driven-dev/issue/INT-54/url-creation). Governing records: [Design](design.md), [specification](specs/url-creation/spec.md), [boundary](../../../architecture/boundary.md), [component registry](../../../architecture/components.md), and accepted [ADR 0001](../../../architecture/adrs/0001-component-boundaries-and-same-origin-proxy.md) and [ADR 0002](../../../architecture/adrs/0002-durable-link-mappings.md).

| Component ID | Repository | Child | Child UUID | Responsibilities and dependencies |
| --- | --- | --- | --- | --- |
| `backend` | https://github.com/intent-driven-dev/url-shortener-be | [INT-58](https://linear.app/intent-driven-dev/issue/INT-58/implement-url-creation-backend-backend) | `a2f50d54-4349-42d9-862e-c90de007c8d6` | Validation, generation, durable mappings, creation API, redirects, storage-aware health. No frontend runtime dependency; integrated acceptance needs both deliveries. |
| `frontend` | https://github.com/intent-driven-dev/url-shortener-fe | [INT-59](https://linear.app/intent-driven-dev/issue/INT-59/implement-url-creation-frontend-frontend) | `408f599e-d275-4f69-b45d-4e80cf0c0eba` | Form, result/error display, selectable links, unchanged same-origin proxy, connectivity-aware health. Live creation and navigation require a usable backend; development can proceed against the agreed contract. |

Both children were retrieved and verified as active children of INT-54 after authoring. Each independently contains all four full application requirements and Gherkin scenarios, owned responsibilities, accepted API/error/proxy contracts, port/origin/configuration/readiness/storage agreements, dependencies, component SDD and test expectations, setup documentation, and reachable immutable delivery revision requirements. Neither delivery is complete; both are currently Ready. Refresh their current evidence during Apply rather than treating this authoring snapshot as delivery evidence.

The user authorized new active children in place of archived INT-56 and INT-57. Those archived issues retain the previous contracts as history and are excluded from this delivery gate. The stable mappings are recorded in [linear.yaml](linear.yaml). The team's unstarted status is named **Ready**, used as the Todo equivalent; no literal Todo status exists.

Use [.agents/skills/acceptance-testing/SKILL.md](../../../.agents/skills/acceptance-testing/SKILL.md). Run all npm commands from `verification/` (`cd verification` first); bindings live in `verification/acceptance/steps/` and generated reports in `verification/.acceptance/`. Follow the [harness documentation](../../../verification/README.md). Component implementation belongs in its supplied repository.

## 1. Prepare executable acceptance

- [x] 1.1 Extract canonical specs composed with only the `url-creation` deltas and implement every JavaScript UI/API setup, action, and assertion for all four authoritative scenarios. Verify every binding, including downstream steps, resolves unambiguously. Use live public interfaces; no mocks, storage writes, seed scripts, test-only endpoints, placeholders, empty assertions, or forced failures. Include Design boundary checks for invalid input, unknown codes, full destination preservation, readiness/connectivity and storage failures, and restart durability; resolve storage-specific controls from delivered instructions after the gate.
- [x] 1.2 Run `npm test -- --change url-creation` and retain genuine initial failing reports and command evidence in `verification.md`. Label connection failures as unavailable-application evidence, not exercised behavior; downstream skips are allowed only in this initial run with complete bindings. Investigate unexpected success without manufacturing failure.

## 2. Check component delivery

- [ ] 2.1 Fetch and record INT-58 and INT-59's current Linear status, timestamp, issue link, and usable immutable delivery revision/setup evidence in `verification.md`. Complete only when both are Done with usable evidence. Otherwise leave unchecked and EXIT IMMEDIATELY with blocker links; do not inspect/start deliveries or run dependent tasks. Refresh this gate on every resumption before dependent tasks and clear stale completion.

## 3. Prepare and start delivered components

- [ ] 3.1 Populate `verification/scripts/app.mjs` configuration from Design, the registry, and delivered instructions. Resolve install/start commands, storage provisioning and internal configuration while verifying accepted contracts. Allocate distinct ports before startup; pass each `PORT`, frontend `BACKEND_ORIGIN`, and backend `PUBLIC_LINK_ORIGIN` equal to frontend origin. Both listen on `127.0.0.1` with HTTP consumer origins and no additional prefix. Provision run-isolated storage retained across backend restart. Configure backend before frontend readiness; verify `/health` dependencies rather than adopting incompatible delivered defaults.
- [ ] 3.2 Run `npm run app:start` for fresh temporary checkouts at delivered revisions, installation, startup, and readiness. Record exact resolved commits, working directories, commands, origins/endpoints, isolated storage setup, and readiness results in `verification.md`; if using externally managed applications, record their exact revisions and endpoints instead.

## 4. Verify integrated acceptance

- [ ] 4.1 Run `npm test -- --change url-creation` against live frontend/proxy/backend components with browser execution. Require a nonempty suite and every scenario and step passing, with no pending, undefined, ambiguous, skipped, or filtered-out cases. Verify the additional Design boundary checks, including exact `Location`/browser destination with path/query/fragment, no false success during storage failure, and link survival after backend restart using the same run's storage and port. Record delivery evidence, revisions, commands, endpoints, outcomes, and report paths in `verification.md`.
- [ ] 4.2 Run `npm run app:stop` and verify harness-owned process cleanup, including after failures; leave externally managed applications running. Inspect parent comments and reconcile a deduplicated review request summarizing this change and verification. Retain In Progress, preserving canceled status; never move the parent to review or Done during Apply. Human acceptance and successful archive are required for Done.

Do not change specs, drop scenarios, or weaken assertions to pass. Component behavior failures require correction in the owning repository, a new delivery, and renewed delivery gating and integrated verification. Fix binding/harness defects only while preserving specified expectations. All execution tasks remain unchecked until evidence exists. On Apply start move the parent to In Progress unless canceled; preserve canceled parents throughout the workflow.
