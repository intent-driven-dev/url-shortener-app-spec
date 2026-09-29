---
name: acceptance-testing
description: Prepare and run specification-derived integrated acceptance during Tasks and Apply, enforcing complete bindings, initial failure evidence and component delivery gating.
---

# Acceptance testing

Use the [verification harness documentation](../../../verification/README.md) for
composition, generation, commands, configuration and reports. The harness owns
those mechanics; generated features are disposable. Node/Cucumber is verification
tooling and imposes no component implementation language. For spec authoring use
[gherkin](../gherkin/SKILL.md).

Preserve the schema's four ordered Tasks/Apply groups and Linear lifecycle rules:

1. Implement all bindings with real UI/public API setup, actions and assertions.
   No mocks, database writes, seed scripts, fixture injection, test-only endpoints,
   pending placeholders, empty assertions or forced failures. Verify every binding,
   including downstream steps, before execution. Retain a genuine initial failing
   run; connection failures show unavailable applications, not exercised behavior.
   Downstream skips are allowed only for this initial run with complete bindings.
   Investigate unexpected success; never manufacture failure.
2. Fetch every required child's CURRENT Linear status and usable delivery revision
   evidence. Record timestamp, status, link and revision. Only complete the gate
   when every child is Done with usable evidence. Otherwise leave it unchecked,
   EXIT IMMEDIATELY and link blockers; do not inspect/start deliveries or run
   dependent tasks. Refresh on every resumption and clear stale gates.
3. After the gate, inspect deliveries to resolve deferred install/start commands
   and internal configuration. Configure startup from accepted Design, the registry
   and delivered instructions. Verify accepted contracts and environment agreements;
   never adopt incompatible delivered defaults. Keep startup unconfigured until
   these records exist. Record exact revisions and endpoints, including when testing
   an already-running application.
4. Run integrated acceptance against live components, including browser execution
   for browser connectivity requirements. Require nonempty, complete passing results
   with no undefined, ambiguous, pending, skipped or filtered scenarios/steps.
   Record commands with working directories, delivery evidence, revisions, endpoints,
   outcomes and report paths in the change's verification.md. Always stop harness-owned
   processes, including on failure; never stop externally managed applications.

Do not modify specs, drop scenarios or weaken assertions to make acceptance pass.
Component behavior failures require correction in the responsible component repository,
then a new delivery and renewed delivery-gate and integrated verification. Binding or
harness defects may be fixed while preserving specified expectations.

Only mark tasks complete with evidence. Infrastructure tests do not establish product
acceptance. Preserve the deduplicated parent review request and In Progress status;
human acceptance and successful archive are required for Done. Preserve canceled parents.
