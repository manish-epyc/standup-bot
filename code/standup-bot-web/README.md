# Skip the Standup

Async voice standup bot for Slack — Next.js + Tailwind on Cloudflare Workers (OpenNext) with D1.
See `../../docs/plans/2026-10-05-mvp-plan.md` for the plan and `../../docs/01-requirements.md` for requirements.

## Local setup

```bash
pnpm install
cp .dev.vars.example .dev.vars        # fill in secrets
pnpm run db:migrate:local             # create local D1 tables
pnpm dev                              # http://localhost:3000
```

Check: `GET /api/health` should list the D1 tables.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Next.js dev server with Cloudflare bindings (local D1, `.dev.vars`) |
| `pnpm run preview` | Build the Worker and run it locally in wrangler |
| `pnpm run deploy` | Build and deploy to Cloudflare |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run lint` | ESLint |
| `pnpm run cf-typegen` | Regenerate `cloudflare-env.d.ts` after changing `wrangler.jsonc` or `.dev.vars` |
| `pnpm run db:migrate:local` | Apply `migrations/` to the local D1 database |
| `pnpm run db:migrate:remote` | Apply `migrations/` to the remote D1 database |

## Before first deploy

1. `pnpm exec wrangler login`
2. `pnpm exec wrangler d1 create standup-db` → put the returned `database_id` in `wrangler.jsonc`
3. `pnpm run db:migrate:remote`
4. `pnpm exec wrangler secret put SLACK_BOT_TOKEN` (repeat for `SLACK_SIGNING_SECRET`, `GROQ_API_KEY`, `CRON_SECRET`)
