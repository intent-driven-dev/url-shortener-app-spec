# Optional frontend/backend questionnaire

Use this example only when frontend (FE) and backend (BE) components fit the
accepted architecture. It does not prescribe separate services or repositories.
Start from the accepted Design, ADRs, architecture records and prior user answers.
Fill in known answers, skip inapplicable topics and ask only about missing or
conflicting details. Use user-provided Git repositories for every component; do not
infer repositories or ownership from nearby directories.

## Ownership and boundaries

- Which accepted component IDs and user-provided repositories own the UI, API,
  business rules and persistence? Reuse an accepted shared repository where
  applicable.
- Which component owns each user-visible outcome, validation rule and error?
  For example, the FE might display a record while the BE supplies its data;
  confirm responsibilities from the actual requirements rather than adopting this
  example as a decision.
- What is explicitly outside each component's scope, and who owns shared contracts
  and changes that affect both sides?

## Addresses and browser connectivity

- What are the accepted browser-facing UI address (`<ui-origin>`), API address
  (`<api-base-url>`) and any internal service address for each relevant environment?
  Record agreed schemes, hosts, ports and path prefixes without choosing fixed
  ports by default. Separate consumer-facing addresses from listening addresses.
  What is the public-link origin? Agree acceptance-environment values or an explicit
  allocation/discovery mechanism before Design completion and handoff.
- Does the browser call the API directly, through a same-origin proxy, or through
  server-side code? Identify the caller and provider for each hop. Distinguish
  addresses reachable from the browser from those reachable only inside a
  container or service network.
- How is the API address configured? If applicable, what origins, CORS behavior,
  credentials, cookies, authentication and HTTPS constraints are required for the
  accepted browser flow?

## API contracts

- Which operations are required by the accepted behavior? Record methods, paths,
  request and response shapes, status codes, validation and error representations.
  A neutral illustration is `GET /records/<record-id>` returning the agreed record
  representation or a documented missing-record response; it is not a new feature.
- What authentication, versioning and compatibility constraints apply? Who
  maintains the contract, and how will consumers discover accepted changes?

## Dependencies and runtime setup

- Which live components and external dependencies are required, and in what order
  must they become ready? Capture readiness checks that demonstrate usability for
  the dependent flow.
- What externally required configuration inputs and test data are needed? Agree
  these before handoff. Defer install/start commands and internal configuration until
  delivered repositories can be inspected after the delivery gate; do not invent
  languages, commands or additional services.

## Integrated verification

- Which specification-derived scenarios exercise the browser through the FE to
  the live BE and its required dependencies? Identify API-level checks where
  appropriate, observable results and test-data setup and cleanup.
- Run integrated acceptance against the live components after the existing
  delivery gate. Mocks, isolated component tests and readiness checks do not
  replace evidence that the integrated behavior works. Include browser execution
  for browser connectivity requirements; API-only checks cannot establish them.
- Record the component revisions, addresses, configuration and execution evidence
  needed to reproduce verification. Treat an unavailable component as failed
  execution, not proof that its behavior was exercised.

Record accepted answers in `architecture/boundary.md` and
`architecture/components.md`, linking governing ADRs and affected component IDs
from Design. Preserve unchanged decisions and mark unresolved details explicitly.
