# Repository Guidelines

## Project Structure & Module Organization

This is a production Next.js 14 App Router dashboard for Airvues operations. Route code lives in `app/`: authenticated product pages are under `app/(app)/`, login is under `app/(auth)/`, and API handlers are under `app/api/`. Reusable UI is grouped in `components/` by feature area, with shared primitives in `components/ui/`. Server data access, auth, permissions, cached reads, and domain logic live in `lib/`; client-safe types use `lib/*-types.ts`. Airtable mutations belong in `lib/mutations/`. Static assets are in `public/`, operational scripts in `scripts/`, and deeper architecture notes in `docs/`.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` starts the local Next.js server; requires `.env.local`.
- `npm run build:dev` runs `tsc --noEmit` for TypeScript verification.
- `npm run lint` runs Next.js ESLint.
- `npm run build` creates the production build and must pass before shipping.
- `npm run verify-schema` checks `lib/schema.ts` field IDs against Airtable Meta API.

## Coding Style & Naming Conventions

Use TypeScript strict mode, React Server Components by default, and client components only when interactivity requires `"use client"`. Prettier settings are `printWidth: 100`, semicolons, double quotes, and trailing commas. Follow the existing feature naming pattern: page-level components in `components/<feature>/`, data loaders in `lib/<feature>.ts`, and client types in `lib/<feature>-types.ts`.

## Testing Guidelines

There is no formal test suite yet. Treat verification as required manual quality control: run `npm run build:dev`, `npm run lint`, and `npm run build` before marking work complete. For Airtable schema or field changes, also run `npm run verify-schema`. When adding tests later, colocate them near the feature or use a clear `tests/` structure, and name files `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines

Recent git history uses short imperative or summary-style commit subjects, such as `Filtered retainers by approved/signed` or `Swapped role checks to auth`. Keep commits focused and describe the user-visible or operational change. Pull requests should include a short summary, verification commands run, linked issue or task context, screenshots for UI changes, and notes for any env var, Airtable schema, permission, or migration impact.

## Security & Configuration Tips

This app handles real operational and revenue data. Never commit `.env.local`, credentials, generated script outputs, or Airtable tokens. Do not import `lib/airtable.ts` into client components. All Airtable writes must go through `lib/mutations/*`, call `requireRole(...)`, use field IDs from `lib/schema.ts`, and revalidate the `"airtable"` cache tag after changes.
