# CLAUDE.md

Read `docs/SPEC.md` before starting any task. It is the source of truth for the data model, pipeline, and roadmap. If something in the spec seems wrong or underspecified, stop and ask rather than improvising.

## Project
trailmix is a mobile-first PWA for planning hikes with a crew: shared trips, checklists, and date-aware discovery of nearby places, events, and weather.

## Stack
- Next.js App Router, TypeScript (strict), Tailwind
- Supabase: Postgres + RLS, email OTP auth, Edge Functions (Deno), pg_cron + pg_net
- Leaflet + OSM tiles
- Vitest, Deno test, Playwright

## How to work
- Work one roadmap phase at a time, on a branch named `phase-N-short-name`.
- Make small commits using conventional commit messages (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- Before writing code for a task, give a short plan and wait for my OK.
- When a phase is done, summarize what changed, what's untested, and anything that deviated from the spec, then open a PR. Don't merge.
- Update the checkboxes in `docs/SPEC.md` as items are completed.

## Conventions
- All schema changes go through `supabase migration new <name>`. Never edit applied migrations.
- Every new table gets RLS enabled in the same migration, plus policies. Use the `is_crew_member()` helper.
- The service role key is only used in Edge Functions. Never import it into client code or `NEXT_PUBLIC_*` vars.
- Pure discovery logic lives in `supabase/functions/_shared/discovery/`, with no I/O, explicit `.ts` import extensions, and `deno test` coverage. Next.js never imports it; the app only calls the `discover` Edge Function.
- External API calls go through one small client per source, with timeouts, one retry with backoff, and a User-Agent that includes `OSM_CONTACT_EMAIL`.
- Recommendations must be deterministic and explainable. No LLM calls in ranking.
- Mobile first: design for about 380px wide, with tap targets of at least 44px.

## Commands
- `npm run dev`: Next.js dev server
- `npx supabase start`: local Supabase stack
- `npx supabase db reset`: reapply migrations and seed
- `npx supabase functions serve discover`: run the edge function locally
- `deno test supabase/functions`: edge function tests
