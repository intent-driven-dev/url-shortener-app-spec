## Why

Visitors need a simpler link to share instead of a long destination URL. This change establishes the application behavior for entering a destination, generating a short URL, viewing it, and following it.

## What Changes

- Provide a URL creation form with a destination URL field and a **Shorten URL** button.
- Generate a short URL when a visitor submits a valid destination URL.
- Display the generated short URL in a result area when creation completes.
- Make the displayed short URL selectable so the visitor can follow it to the destination.

Scope follows INT-54's visitor journey. Expiry selection and expiry behavior belong to the separate INT-55 issue and are outside this change. Accounts, link management, analytics, and custom aliases are also outside this change. No existing canonical application requirements or architecture decisions are present; this proposal introduces behavior without changing an established contract.

## Capabilities

### New Capabilities

- `url-creation` (delta: `specs/url-creation/spec.md`; canonical: `openspec/specs/url-creation/spec.md`): visitors can submit a valid destination URL, see the generated short URL, and follow it to that destination.

### Modified Capabilities

None. There are no existing canonical capabilities in this repository.

## Impact

This repository will define application requirements and integrated acceptance for the creation form, short URL generation, result display, and link navigation. Design will resolve the component boundaries, user-provided component repositories, creation and resolution interfaces, and acceptance-environment agreements before delivery handoffs are created. Component repositories will own implementation and their own SDD cycles.

The visitor-facing form depends on URL creation and short-link resolution behavior. Interface methods, paths, payloads, errors, addressing, and readiness contracts remain to be agreed during specification and design; this proposal does not select component technology or topology.

## Linear Parent

[INT-54 — URL Creation](https://linear.app/intent-driven-dev/issue/INT-54/url-creation), in the **URL Shortener** project under **Intent-driven-dev**. The existing parent is recorded in `linear.yaml`; the repository team/project mapping is recorded in `openspec/linear.yaml`.
