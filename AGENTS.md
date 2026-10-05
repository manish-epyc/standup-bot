# AGENTS.md

Instructions for AI agents working in this repository. Applies to Claude Code, Cursor, Codex, and any other AI tool.

---

## The project

**Skip the Standup** — a Slack bot that replaces the daily standup call with short voice notes. Team members post a ~1 minute voice (or text) update in the standup channel; the bot transcribes it, stores it, and posts one AI-generated team summary each morning. A small dashboard shows the results.

### Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript |
| Runtime | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (SQLite) — binding `DB` |
| Scheduler | Cloudflare Cron Triggers (UTC) |
| Slack | Events API over HTTP + Web API via `fetch` (no Bolt, no Socket Mode) |
| AI | Groq — Whisper (speech-to-text) and Llama (summaries), behind `src/lib/ai/*` |
| Styling | Tailwind v4, `@theme` tokens in `src/app/globals.css`. No JS tailwind config. |
| Components | shadcn/ui (`base-nova` style, Base UI, neutral, `lucide-react` icons) |
| Package manager | pnpm |

### Layout

```
code/standup-bot-web/       the app (all code lives here)
  src/app/                  pages + route handlers
  src/app/api/slack/        Slack Events API endpoint
  src/app/api/cron/         reminder + summary jobs (CRON_SECRET protected)
  src/components/ui/        generated shadcn components — do not hand-edit
  src/components/<feature>/ app components composed from shadcn
  src/lib/                  db, date, slack, ai helpers
  migrations/               D1 migrations (numbered)
docs/01-requirements.md     original requirements
docs/plans/                 dated implementation plans
```

Import alias: `@/*` → `./src/*`.

### Task tracking

- **GitHub Issues are the task list** (repo `manish-epyc/standup-bot`, milestone `MVP`). Don't keep a parallel task list in files.
- A task is done when its commit/PR lands with `Closes #N`.

---

## Rules

### React & Next.js

**Use `useEffect` only when absolutely necessary.** An effect is correct only for _synchronising with something outside React_: a DOM subscription, an observer, a timer, a browser API. Before writing one:

- **Deriving state from props or other state?** Compute it during render.
- **Transforming data for display?** Do it inline during render.
- **Responding to a user action?** Put the logic in the event handler.
- **Fetching data?** Fetch in a Server Component.
- **Calling `setState` inside the effect?** Almost always a cascading-render bug. Restructure rather than suppress the lint rule.

When an effect is required, always clean up.

**Server Components are the default.** Add `'use client'` only when a component needs state, effects, event handlers, or browser APIs — and push it as far down the tree as possible.

**Read the docs before writing Next.js code.** The installed version has breaking changes that predate most training data. Consult `code/standup-bot-web/node_modules/next/dist/docs/` — it is the source of truth, not memory.

### Styling (strict)

1. **Tailwind utility classes only.** No inline `style={{...}}`, no CSS Modules, no `<style>` blocks, no new `.css` files, no styled-components. `src/app/globals.css` is the only stylesheet and holds only Tailwind imports and theme tokens.
2. **No arbitrary values — ever.** No `w-[123px]`, `text-[13px]`, `bg-[#1a1a1a]`, `mt-[7px]`, `grid-cols-[...]`. When you need a value, stop at the first hit:
   1. Tailwind's default scale (`w-32`, `text-sm`, `gap-5`, `max-w-3xl`)
   2. An existing `@theme` token in `globals.css`
   3. Otherwise it's a design question — **ask**. Adding a token requires approval.
3. **Colors from theme tokens only:** `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`, … No raw palette colors (`bg-gray-100`) and no hex. Dark mode works through the tokens.
4. **shadcn components first.** Before building any UI element (button, card, table, badge, dialog, input, select, tabs, tooltip, skeleton, …), use the shadcn component. If it isn't installed: `pnpm dlx shadcn@latest add <name>`. Don't hand-write what shadcn provides.
5. **Don't edit `src/components/ui/*` by hand.** They're generated (and contain arbitrary values internally — that's expected and exempt). Customise via `variant`/`size` props and `className`; ask before adding a variant.
6. **Merge classes with `cn()`** from `@/lib/utils`; never concatenate class strings with template literals.
7. **Icons:** `lucide-react` only, sized with Tailwind (`size-4`).
8. Mobile-first; `px-4` page gutter; no horizontal scroll.

### Cloudflare / runtime

- Code runs on **Cloudflare Workers**, not Node.js. Use Web APIs (`fetch`, `crypto.subtle`, `Request`/`Response`). Avoid Node-only packages (`fs`, `child_process`, native modules).
- Access bindings with `getCloudflareContext()` from `@opennextjs/cloudflare` (`env.DB`, `env.SLACK_BOT_TOKEN`, …). Don't read `process.env` for bindings.
- Background work after responding (e.g. transcription after acking Slack) goes in `getCloudflareContext().ctx.waitUntil(...)`.
- Keep the Worker bundle small.

### Database (D1)

- Schema changes **only** through new numbered files in `migrations/` (`0002_*.sql`, …). Never edit an applied migration.
- Prepared statements with `.bind(...)` only; never interpolate values into SQL.
- All D1 access goes through `src/lib/db.ts`.

### Dates & time

- Team timezone is **IST (`Asia/Kolkata`)**. The `date` column (`YYYY-MM-DD`) is always computed in IST via `src/lib/date.ts`, never from the Worker's UTC clock.
- Cron Triggers run in **UTC** (09:30 IST = `0 4 * * 1-5`).

### Slack

- Events arrive at `/api/slack/events`. Verify the Slack signature + timestamp before anything else.
- Ack within 3 seconds; heavy work in `waitUntil`. Dedupe by `event_id` (`processed_events`).
- Ignore bot messages (including our own), other channels, and (in MVP) thread replies.

### Code

- **No new dependencies without asking.** Propose and get approval first.
- **No secrets in source.** `.dev.vars` locally, `wrangler secret put` in production. Never log tokens.
- **Validate all external input** — Slack payloads, AI responses (especially JSON from the LLM), request bodies — before use.
- Cron routes require `Authorization: Bearer <CRON_SECRET>`.
- **Edit files with file tools**, not `sed`/`awk`/`echo >`.

### Comments

**Don't comment by default.** Well-named functions and variables carry the _what_. Write a comment only when a reader would otherwise change the code and break something:

- A non-obvious decision, and **why** it was made over the obvious alternative.
- A constraint not visible from the code: a Slack/Cloudflare quirk, an ordering dependency, an upstream workaround.
- Something that looks wrong or redundant but isn't.

Never restate the line below, narrate steps, label sections, or announce changes.

### Verifying

Run in `code/standup-bot-web` before calling work done:

```
pnpm run typecheck
pnpm run lint
grep -rnE '[a-z:-]+-\[[^]]+\]' src --include=*.tsx --exclude-dir=ui   # must print nothing
```

If you changed `wrangler.jsonc` or `.dev.vars`, run `pnpm run cf-typegen`. Report failures honestly, with output. If a check was already failing before you started, say so.

Never run `pnpm run deploy` or any `--remote` D1 command unless the user asks.

### Git

- **Never commit without confirmation.** Before every commit, show the user the files and a summary of the changes, and wait for an explicit "yes". Finishing a task, passing checks, or an earlier approval is not confirmation — ask each time.
- **Never push to `main`.** All work goes on a topic branch; changes reach `main` only by merging a PR. Don't merge PRs yourself unless the user explicitly asks.
- Never commit secrets (`.dev.vars`, keys, tokens) — warn and exclude.
- Stage only the files belonging to the change. No blanket `git add .` / `git add -A`.
- Never change git config, skip hooks, or force-push `main`.
- Before renaming or changing a signature, find every call site first.

### Raising a PR

Committing still needs confirmation (see Git above). Once the user confirms, you may branch, commit, push the topic branch, and run `gh pr create`. The PR is merged into `main` by the user.

**1. Inspect** — `git status`, `git diff` (staged and unstaged), `git branch -vv`, `git log -8 --oneline`, and remote sync state. If there is nothing to commit and nothing unpushed, stop.

**2. Branch** — work lands on a topic branch cut from latest `main`: `feat/…` / `fix/…` / `chore/…` / `docs/…`. If the current branch isn't right: stash, `git checkout main`, `git pull --ff-only`, branch, `git stash pop`. Never commit or push on `main`.

**2a. Confirm** — show the user the files to be committed, a short summary, and the proposed commit message. Wait for an explicit "yes" before committing.

**3. Commit** — Conventional Commits, one primary type:

| Prefix | When |
|---|---|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `refactor` | Internal restructure, no behavior change |
| `perf` | Performance |
| `chore` | Maintenance, tooling, deps |
| `docs` | Documentation only |
| `test` | Tests only |
| `ci` | CI config / pipelines |
| `build` | Build system or bundler |
| `style` | Formatting / lint churn, no logic change |
| `revert` | Revert a previous commit |

Format: `type(optional-scope): imperative summary`, optional body covering _why_. Reference the issue: `Closes #N`. Use a HEREDOC. If a hook fails, fix it and make a **new** commit — don't amend.

**4. Push** — `git push -u origin HEAD`.

**5. Open the PR** — consider every commit merging into base. Body sections: **Summary** (2–5 bullets), **Why**, **What changed** (grouped by concern; call out migrations explicitly), **Architecture / flow** (at least one diagram matching the actual diff), **Risk / rollback**, **Test plan** with runnable steps. `gh pr create` with a HEREDOC body.

**6. Report** — branch, commit summary, PR title, PR URL, and anything intentionally left uncommitted.

### Working with the user

Surface blockers immediately rather than working around them silently. If a request looks wrong, say so once, then proceed as asked. Don't expand scope beyond what was requested — if you spot an unrelated problem, mention it instead of fixing it.
