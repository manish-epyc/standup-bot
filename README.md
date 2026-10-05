# Skip the Standup

Async voice standup bot for Slack — Next.js + Tailwind on Cloudflare Workers (OpenNext) with D1.
See `MVP_PLAN.md` for the plan and `async_standup_bot_requirements.md` for requirements.

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars        # fill in secrets
npm run db:migrate:local              # create local D1 tables
npm run dev                           # http://localhost:3000
```

Check: `GET /api/health` should list the D1 tables.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server with Cloudflare bindings (local D1, `.dev.vars`) |
| `npm run preview` | Build the Worker and run it locally in wrangler |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` after changing `wrangler.jsonc` or `.dev.vars` |
| `npm run db:migrate:local` | Apply `migrations/` to the local D1 database |
| `npm run db:migrate:remote` | Apply `migrations/` to the remote D1 database |

## Before first deploy

1. `npx wrangler login`
2. `npx wrangler d1 create standup-db` → put the returned `database_id` in `wrangler.jsonc`
3. `npm run db:migrate:remote`
4. `npx wrangler secret put SLACK_BOT_TOKEN` (repeat for `SLACK_SIGNING_SECRET`, `GROQ_API_KEY`, `CRON_SECRET`)
