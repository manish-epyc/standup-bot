<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Skip the Standup — Agent Guide

Async voice standup bot for Slack. Slack voice clips are transcribed, stored, and summarised daily; a small dashboard shows the results.

- Plan & scope: `MVP_PLAN.md` (follow its phases; don't build later-phase features unasked)
- Requirements: `async_standup_bot_requirements.md`

## Stack

- **Next.js 16 (App Router, TypeScript)** — see the Next.js note above; check `node_modules/next/dist/docs/` before using an API you're unsure of.
- **Tailwind CSS v4** (CSS-first config in `app/globals.css`, no `tailwind.config.*`)
- **shadcn/ui** (`base-nova` style on Base UI, neutral base color, `lucide-react` icons)
- **Cloudflare Workers** via `@opennextjs/cloudflare`, **D1** database, Cron Triggers
- **Groq** for speech-to-text (Whisper) and summaries (Llama), behind `lib/ai/*`

## Commands

| Command | Use |
|---|---|
| `npm run dev` | Dev server with Cloudflare bindings (local D1, `.dev.vars`) |
| `npm run preview` | Build the Worker and run it in wrangler (closest to production) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` after changing `wrangler.jsonc` or `.dev.vars` |
| `npm run db:migrate:local` | Apply `migrations/` to local D1 |
| `npx shadcn@latest add <component>` | Add a shadcn component |

Never run `npm run deploy` or any `--remote` D1 command unless the user asks.

## UI rules (strict)

1. **Tailwind utility classes only.** No inline `style={{...}}`, no CSS modules, no new CSS files, no styled-components. `app/globals.css` holds only Tailwind imports and theme tokens.
2. **No arbitrary values.** Don't write `w-[123px]`, `text-[13px]`, `bg-[#1a1a1a]`, `mt-[7px]`, `grid-cols-[...]`, etc. Use Tailwind's built-in scale (`w-32`, `text-sm`, `mt-2`, `max-w-3xl`) instead.
   - If the scale truly lacks a value, add a **theme token** in the `@theme` block of `app/globals.css` and use its generated utility. Ask before adding tokens.
3. **Colors come from theme tokens only:** `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`, etc. No raw palette colors (`bg-gray-100`, `text-blue-600`) and no hex values. Dark mode works through the tokens (`.dark` class); avoid `dark:` overrides unless a token can't cover it.
4. **shadcn components first.** Before building any UI element (button, card, table, badge, dialog, input, select, tabs, tooltip, skeleton, etc.), use the shadcn component. If it isn't installed, add it with `npx shadcn@latest add <name>`. Don't hand-write a component shadcn already provides.
5. **Don't edit `components/ui/*` by hand.** These are generated shadcn files (they contain arbitrary values internally; that's expected and exempt). Customise through `variant`/`size` props and `className`; if a new variant is truly needed, ask first.
6. **Compose app components in `components/`** (outside `ui/`), built from shadcn primitives.
7. **Merge classes with `cn()`** from `@/lib/utils`; never concatenate class strings with template literals.
8. **Icons:** `lucide-react` only, sized with Tailwind (`size-4`).
9. Layouts must work at phone width: mobile-first classes, `px-4` page gutter, no horizontal scroll.

## Cloudflare / runtime rules

- Code runs on **Cloudflare Workers**, not Node.js. Use Web APIs (`fetch`, `crypto.subtle`, `Request`/`Response`). Avoid Node-only packages (`fs`, `child_process`, native modules); `nodejs_compat` is on but don't rely on it without checking.
- Access bindings with `getCloudflareContext()` from `@opennextjs/cloudflare` (`env.DB`, `env.SLACK_BOT_TOKEN`, …). Don't read `process.env` for bindings.
- Background work after responding (e.g. transcription after acking Slack) goes in `getCloudflareContext().ctx.waitUntil(...)`.
- Keep the Worker bundle small; ask before adding large dependencies.

## Database (D1)

- Schema changes **only** through new numbered files in `migrations/` (`0002_*.sql`, …). Never edit an applied migration.
- Always use prepared statements with `.bind(...)`; never interpolate values into SQL.
- All D1 access goes through `lib/db.ts`.

## Dates & time

- Team timezone is **IST (`Asia/Kolkata`)**. The `date` column (`YYYY-MM-DD`) is always computed in IST via `lib/date.ts`, never from the Worker's UTC clock.
- Cron Triggers run in **UTC** (09:30 IST = `0 4 * * 1-5`).

## Slack

- Events arrive over HTTP at `/api/slack/events`. Always verify the Slack signature + timestamp before doing anything.
- Ack within 3 seconds; do heavy work in `waitUntil`. Dedupe by `event_id` (`processed_events` table).
- Ignore bot messages (including our own), other channels, and (in MVP) thread replies.

## Security

- Secrets live in `.dev.vars` locally and `wrangler secret put` in production. Never hard-code or log tokens, and never commit `.dev.vars`.
- Cron routes (`/api/cron/*`) require `Authorization: Bearer <CRON_SECRET>`.

## Before finishing a task

- Run `npx tsc --noEmit` and `npm run lint`; fix what you introduced.
- Check new/changed UI files for arbitrary values: `grep -rnE '[a-z:-]+-\[[^]]+\]' app components --include=*.tsx --exclude-dir=ui` should print nothing.
- If you changed `wrangler.jsonc` or `.dev.vars`, run `npm run cf-typegen`.
