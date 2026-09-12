# Contributing

This document defines how we collaborate on ABC Fashion AI Assistant. Keep the
process lightweight, communicate early, and prefer small changes that are easy
to review.

## Getting started

1. Pull the latest `main`.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add your own local credentials.
4. Start the app with `npm run dev`.

Never commit `.env.local`, database passwords, service-role keys, or other
secrets.

## Branches

`main` must remain deployable. Do not push directly to it; all changes should
arrive through a pull request.

Create short-lived branches from the latest `main` using:

```text
feat/product-search
fix/catalog-filter
refactor/supabase-client
docs/local-setup
test/catalog-query
chore/update-dependencies
```

Use lowercase kebab-case after the prefix. Keep branches focused on one task
and delete them after merging.

Before opening a pull request, update your branch with the latest `main` and
resolve conflicts locally.

## Commits

Use Conventional Commit messages:

```text
feat: add product recommendation query
fix: hide inactive products
refactor: extract catalog filters
docs: explain local Supabase setup
test: cover cross-sell rules
chore: update dependencies
```

Write messages in the imperative mood, keep the subject concise, and avoid
mixing unrelated changes in one commit.

Common commit types:

- `feat`: a new user-facing capability
- `fix`: a bug fix
- `refactor`: code restructuring without changed behavior
- `docs`: documentation only
- `test`: test additions or corrections
- `chore`: maintenance, tooling, or dependency work

## Pull requests

Open a draft pull request early when feedback or coordination would help. Mark
it ready only after completing your own review.

Each pull request should:

- Address one concern and remain reasonably small.
- Explain what changed and why.
- Link the relevant issue or task, when one exists.
- State how the change was tested.
- Include screenshots or recordings for visible UI changes.
- Call out migrations, environment changes, known limitations, and follow-up
  work.
- Pass all required checks.
- Receive at least one approval from another contributor.

The author resolves review comments and confirms requested changes. Use squash
merge unless the team agrees that preserving individual commits is useful.
Delete the branch after merging.

## Required checks

Run these commands before requesting review:

```bash
npm run lint
npm run build
```

Also manually test the behavior affected by the change. Do not merge with
failing checks.

## Supabase and database changes

Treat the migration files as the source of truth for the database schema.

- Put every schema change in a new file under `supabase/migrations/`.
- Create migrations with `npx supabase migration new <descriptive_name>`.
- Never edit a migration after it has been applied to a shared environment.
  Add a new migration instead.
- Coordinate before making concurrent schema changes.
- Enable Row Level Security on every table exposed through the Data API.
- Add policies that grant only the access the application needs.
- Keep public catalog access read-only unless the team explicitly approves a
  different access model.
- Never expose or commit a Supabase service-role or secret key.
- Regenerate `lib/database.types.ts` after changing the schema.
- Keep seed or demo data separate from production data.
- Mention migration order and deployment considerations in the pull request.

Test migrations locally when possible, then review Supabase security and
performance advisors before applying them to a shared environment.

## Definition of done

A change is complete when:

- The requested behavior works.
- Relevant edge cases and error states are handled.
- Lint and build checks pass.
- Documentation and generated database types are updated when necessary.
- Database access remains protected by appropriate grants and RLS policies.
- Another contributor has approved the pull request.

## Communication

- Share ownership of a task before starting substantial work.
- Raise blockers and breaking changes early.
- Avoid rewriting or force-pushing another contributor's branch without their
  agreement.
- For urgent production fixes, open a focused `fix/` branch and still use a
  pull request. Document any checks skipped because of the urgency and follow
  up afterward.

