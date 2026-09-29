## Component Handoffs

<!-- Exactly one reconciled child per affected component. Include stable component
ID, user-provided repository, child identifier/ID/URL, parent link and dependencies.
Each child contains full relevant behavior/Gherkin, accepted integration contracts, acceptance-environment agreements and completion criteria. -->

Use `.agents/skills/acceptance-testing/SKILL.md`. Run all npm commands from
`verification/` (`cd verification` first); bindings live in `verification/acceptance/steps/`
and generated reports in `verification/.acceptance/`.

## 1. Prepare executable acceptance

- [ ] 1.1 Extract composed specs and implement all JavaScript UI/API steps and assertions; verify every binding, including downstream steps, resolves unambiguously.
- [ ] 1.2 Run acceptance and retain genuine failing-run evidence; label unavailable-application failures, allow downstream skips only with complete bindings, investigate unexpected success.

## 2. Check component delivery

- [ ] 2.1 Fetch and record every required child's current Linear status and usable delivery revision evidence; complete only when all are Done. Otherwise leave unchecked and EXIT IMMEDIATELY with blocker links. Refresh on every resumption before dependent tasks.

## 3. Prepare and start delivered components

- [ ] 3.1 Populate verification/scripts/app.mjs configuration from Design, registry and delivered instructions; resolve deferred commands/internal configuration and verify accepted integration agreements rather than adopting incompatible defaults.
- [ ] 3.2 Run npm run app:start to retrieve fresh temporary checkouts, install, start and await readiness; record commands, resolved commits and readiness results.

## 4. Verify integrated acceptance

- [ ] 4.1 Run the composed acceptance suite against live components; require nonempty, complete passing results and record delivery evidence, revisions, commands, endpoints and report paths in verification.md.
- [ ] 4.2 Stop harness-owned processes and verify cleanup; reconcile a deduplicated parent review-request comment while retaining In Progress (preserve canceled status).

Do not change specs, drop scenarios or weaken assertions to pass. Component behavior
failures need correction in the owning repository, a new delivery and renewed gate
and integrated verification. Fix binding/harness defects only while preserving expectations.
