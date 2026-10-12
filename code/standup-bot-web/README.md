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

## Slack app setup (test workspace)

1. **Workspace** — create a free test workspace at https://slack.com/get-started#/createnew (or use an existing one where you can install apps).
2. **Channel** — create a public channel, e.g. `#standup-test`.
3. **Create the app** — https://api.slack.com/apps → **Create New App** → **From a manifest** → pick the workspace → paste [`slack-manifest.yml`](slack-manifest.yml) (YAML tab) → **Create**.
4. **Install** — **Install App** → **Install to Workspace** → **Allow**.
5. **Copy secrets into `.dev.vars`**
   - **OAuth & Permissions → Bot User OAuth Token** (`xoxb-…`) → `SLACK_BOT_TOKEN`
   - **Basic Information → App Credentials → Signing Secret** → `SLACK_SIGNING_SECRET`
6. **Channel ID** — in Slack, open the channel → click its name → bottom of the **About** tab (`C…`) → `STANDUP_CHANNEL_ID` in `.dev.vars`.
7. **Invite the bot** — in the channel: `/invite @Skip the Standup`.
8. **Groq key** — https://console.groq.com/keys → **Create API Key** → `GROQ_API_KEY` in `.dev.vars`.
9. Restart `pnpm dev` so it picks up `.dev.vars`.

### Enable events (after the events endpoint exists)

Slack verifies the Request URL as soon as it is saved, so this step needs the app running and reachable:

1. `pnpm dev`, then in another terminal `cloudflared tunnel --url http://localhost:3000`
2. App settings → **Event Subscriptions** → **On** → Request URL: `https://<tunnel>/api/slack/events` → wait for **Verified**
3. **Subscribe to bot events** → add `message.channels` → **Save Changes** → reinstall the app if Slack asks.

A quick tunnel gets a new URL every run; update the Request URL each time (or use a named tunnel).

If the standup channel is **private**, add the `groups:history` and `groups:read` scopes and the `message.groups` event.

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
