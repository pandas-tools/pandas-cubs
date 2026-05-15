# docs

Project-scoped documentation for `dojo`. Read these in order:

1. [`spec.md`](spec.md) — canonical product spec (data model, auth, UX, MVP scope, analytics)
2. [`architecture.md`](architecture.md) — stack, repo layout, tenant scoping pattern
3. [`decisions.md`](decisions.md) — running ADR for project-specific decisions
4. [`deploy.md`](deploy.md) — Railway project, env vars, Mux webhook setup, DNS cutover plan

The implementation **plan** lives in the shared studio at `.claude/_studio/plans/2026-05-14-cubs-build.md` (and `.claude/_studio/decisions/2026-05-14-cubs-stack-pivot.md` for context on why the stack changed mid-spec). Don't duplicate the plan here.

## Conventions

- `decisions.md` is a single file (running ADR), not one file per decision. New decisions go at the top, with a date and a "Status" line.
- `spec.md` is the source of truth for *what* the product does. If implementation deviates from the spec, update the spec in the same PR.
- `architecture.md` is for *how* the code is laid out — the things you'd want to know before opening any file.
- `deploy.md` is operational — env vars, DNS, webhook URLs, rollback procedure.
