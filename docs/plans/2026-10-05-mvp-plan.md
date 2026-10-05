# Skip the Standup – MVP Implementation Plan

**Document type:** Implementation Plan (MVP + expansion path)
**Based on:** `async_standup_bot_requirements.md` (Draft v1.0)
**Date:** 5 October 2026
**Status:** Draft v1.0

---

## 1. Goal of the MVP

Prove the core loop with the smallest possible build:

> **Voice (or text) update in Slack → transcript in thread → one team summary posted at a fixed time.**

Run it with the team for ~1 week, collect feedback, then expand (blockers, reminders, dashboard).

---

## 2. Tech Stack

| Component | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | API routes for Slack + cron; pages for the dashboard |
| Styling | **Tailwind CSS** | Dashboard UI |
| Hosting | **Cloudflare Workers** via `@opennextjs/cloudflare` (OpenNext adapter) | `wrangler` for dev/deploy |
| Database | **Cloudflare D1** (SQLite) | Local D1 (via wrangler/miniflare) for now; remote D1 at deploy |
| Scheduler | **Cloudflare Cron Triggers** | Replaces `node-cron` |
| Slack integration | **Slack Events API (HTTP)** + Slack Web API via `fetch` | Replaces Bolt Socket Mode (see §3) |
| Speech-to-text | **Groq Whisper** (`whisper-large-v3-turbo`), free tier | Default. Alternative to evaluate: Workers AI Whisper |
| AI summary | **Groq Llama** (e.g. `llama-3.3-70b-versatile`), free tier | Default. Alternatives: Workers AI, Gemini, Claude (paid, ~cents/month) |

AI providers sit behind two small functions — `transcribe(audio)` and `summarize(updates)` — so switching providers is a one-file change.

---

## 3. Deviations from the Requirements Doc

The requirements doc (§8, §11) assumed a long-running Node.js process. Cloudflare Workers is serverless, so:

| Requirements doc | This plan | Why |
|---|---|---|
| Slack Bolt, **Socket Mode** | **Events API over HTTP** (`POST /api/slack/events`) | Workers can't hold a persistent Socket Mode connection |
| Bolt framework | Raw `fetch` to Slack Web API + Web Crypto signature verification (or an edge-compatible library such as `slack-edge` — verify compatibility in the spike) | Bolt JS targets Node.js; keep dependencies minimal on Workers |
| `node-cron` | **Cron Triggers** (configured in `wrangler.jsonc`) | No always-on process |
| SQLite file | **D1** | Cloudflare's managed SQLite |
| No public server needed | **Public HTTPS URL needed** for Slack events | Locally solved with a `cloudflared` tunnel |

---

## 4. MVP Scope

### In scope
| # | Feature | Maps to |
|---|---|---|
| 1 | Daily reminder posted in the standup channel at a fixed time on weekdays | FR-1 |
| 2 | Detect voice/video clips in the standup channel, download, transcribe, reply in thread | FR-4, FR-5, FR-6 |
| 3 | Accept plain text updates too | FR-8 |
| 4 | Store updates in D1; latest update per user per day wins | FR-7, FR-9 |
| 5 | Daily AI summary: one line per person, separate **Blockers** section, list of who didn't post | FR-10 – FR-13 |
| 6 | If transcription fails, reply asking the user to retry or type their update | NFR Reliability |
| 7 | Minimal read-only page: today's summary + updates | (early FR-18) |

### Out of scope (later phases)
- Blocker group DMs + meeting link / "Huddle needed" (FR-14 – FR-17) → **v2**
- Missing-member reminder DM at 09:50 (FR-3) → **v2**
- Holidays, on-leave flag, settings stored in DB (FR-2, configurability NFR) → **v3**
- Full dashboard with history + hours saved (FR-18, FR-19) → **v4**

---

## 5. Architecture

```
┌──────────────┐  voice clip / text   ┌─────────────────────┐
│  Slack User  │ ───────────────────▶ │   Slack Workspace   │
└──────────────┘                      └──────────┬──────────┘
                                                 │ Events API (HTTPS POST)
                                                 ▼
┌──────────────────┐  scheduled()   ┌──────────────────────────────────────┐
│ Cron Triggers    │ ─────────────▶ │  Cloudflare Worker (Next.js/OpenNext)│
│ (UTC schedules)  │                │  /api/slack/events                   │
└──────────────────┘                │  /api/cron/reminder  /api/cron/summary│
                                    │  /  (today page)                     │
                                    └───┬──────────────┬───────────────┬───┘
                           audio bytes  │              │ updates        │ SQL
                                        ▼              ▼                ▼
                              ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                              │ Groq Whisper │ │ Groq Llama   │ │ Cloudflare D1│
                              └──────────────┘ └──────────────┘ └──────────────┘
```

### 5.1 Slack event handling contract (`POST /api/slack/events`)
1. **Verify the request**: check `X-Slack-Signature` (HMAC-SHA256 of `v0:{timestamp}:{rawBody}` with the signing secret, via Web Crypto) and reject if `X-Slack-Request-Timestamp` is older than 5 minutes.
2. **`url_verification`**: respond with the `challenge` value (needed once when setting the Request URL).
3. **Acknowledge fast**: Slack expects a 2xx within **3 seconds**, otherwise it retries. Return `200` immediately and do the heavy work (download → transcribe → reply → store) in `ctx.waitUntil(...)` (via `getCloudflareContext()`).
4. **Deduplicate retries**: store `event_id` in `processed_events`; skip if already seen.
5. **Filter** — ignore:
   - events from other channels (only `STANDUP_CHANNEL_ID`)
   - bot messages (`bot_id` present / `subtype: bot_message`) → otherwise the bot loops on its own replies
   - thread replies (`thread_ts` set and ≠ `ts`) — MVP only
   - edits/deletes (`message_changed`, `message_deleted`) — MVP only
6. **Route**:
   - `subtype: file_share` with an audio/video file → voice flow
   - plain message with text → text flow

### 5.2 Voice flow
1. Take the first file whose `mimetype` starts with `audio/` or `video/`.
2. Download `url_private_download` with header `Authorization: Bearer <SLACK_BOT_TOKEN>` (without it Slack returns an HTML login page).
3. Send bytes to `transcribe()`.
4. Upsert into `updates` (`source = 'voice'`).
5. Reply in thread (`chat.postMessage` with `thread_ts`) with the transcript.
6. On any failure: reply in thread *"Sorry, I couldn't transcribe that — please try again or type your update."*

### 5.3 Cron flow
- The Worker's `scheduled()` handler calls the app's own routes (`/api/cron/reminder`, `/api/cron/summary`) with an `Authorization: Bearer <CRON_SECRET>` header.
- Keeps cron logic in normal Next.js routes → **testable locally with `curl`**.
- Wiring `scheduled()` into the OpenNext-generated worker (custom worker entry that wraps `.open-next/worker.js`, or a separate tiny Worker sharing the D1 binding) — **verify against current OpenNext docs during the spike.**

### 5.4 Summary flow (`/api/cron/summary`)
1. Load today's updates from D1 (date in IST).
2. Get channel members (`conversations.members`, excluding bots) → compute who didn't post.
3. Call `summarize()` → request **JSON output**: `{ people: [{ user_id, line }], blockers: [{ user_id, text }] }`.
4. Render with Slack Block Kit: *Updates* / *Blockers* / *Not submitted*.
5. Post to channel; save to `summaries`. Skip if a summary already exists for today (idempotent on retries).
6. If zero updates: post "No updates today."

---

## 6. Time Handling

- Team timezone: **IST (UTC+05:30, no DST)**.
- **Cron Triggers run in UTC:**

| Job | IST | Cron (UTC) |
|---|---|---|
| Reminder | 09:30 Mon–Fri | `0 4 * * 1-5` |
| Summary | 10:00 Mon–Fri | `30 4 * * 1-5` |
| Missing-member DM (v2) | 09:50 Mon–Fri | `20 4 * * 1-5` |

- **The `date` key must be computed in IST**, not from the Worker's UTC clock (e.g. `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })` → `YYYY-MM-DD`). `UNIQUE(user_id, date)` depends on this.

---

## 7. Data Model (D1, MVP)

`migrations/0001_init.sql`

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,          -- Slack user ID
  name        TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE updates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  date        TEXT NOT NULL,             -- YYYY-MM-DD in IST
  source      TEXT NOT NULL CHECK (source IN ('voice','text')),
  transcript  TEXT NOT NULL,
  slack_ts    TEXT NOT NULL,             -- message ts (for thread replies / dedupe)
  file_id     TEXT,                      -- Slack file ID (voice only)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, date)                 -- latest update per day wins (upsert)
);

CREATE TABLE summaries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL UNIQUE,
  summary_json  TEXT NOT NULL,
  slack_ts      TEXT,
  posted_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE processed_events (
  event_id     TEXT PRIMARY KEY,
  received_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Upsert pattern:
```sql
INSERT INTO updates (user_id, date, source, transcript, slack_ts, file_id)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (user_id, date) DO UPDATE SET
  source = excluded.source, transcript = excluded.transcript,
  slack_ts = excluded.slack_ts, file_id = excluded.file_id,
  created_at = datetime('now');
```

`users` is a name cache filled from `users.info` on first sight of a user.
**v2 adds:** `blockers (id, update_id, description, helper_ids, status, opened_on, resolved_on)`.

---

## 8. Slack App Configuration

**Settings:**
- Socket Mode: **off**
- Event Subscriptions: **on** → Request URL `https://<host>/api/slack/events`

**Bot token scopes:**
| Scope | Why |
|---|---|
| `chat:write` | Post reminder, thread replies, summary |
| `channels:history` | Receive/read messages in the public channel |
| `channels:read` | `conversations.members` (who didn't post) |
| `files:read` | Download voice clips |
| `users:read` | Resolve names |
| `im:write`, `mpim:write` | **v2** — reminder DMs, blocker group DMs |

If the channel is **private**, add `groups:history` + `groups:read` and the `message.groups` event.

**Bot events:** `message.channels` (+ `message.groups` if private).

**After install:** invite the bot to the standup channel (`/invite @Skip the Standup`).

A `slack-manifest.yml` will be included in the repo so the app can be created by pasting the manifest.

---

## 9. Project Structure

```
standup-bot/
├─ app/
│  ├─ page.tsx                     # Today: summary + updates (read-only)
│  ├─ layout.tsx
│  ├─ globals.css                  # Tailwind
│  └─ api/
│     ├─ slack/events/route.ts     # Slack Events API endpoint
│     └─ cron/
│        ├─ reminder/route.ts      # protected by CRON_SECRET
│        └─ summary/route.ts       # protected by CRON_SECRET
├─ lib/
│  ├─ env.ts                       # typed access to bindings/vars (getCloudflareContext)
│  ├─ date.ts                      # IST "today" helpers
│  ├─ db.ts                        # D1 queries
│  ├─ slack/
│  │  ├─ verify.ts                 # signature verification (Web Crypto)
│  │  ├─ api.ts                    # chat.postMessage, users.info, conversations.members, file download
│  │  └─ blocks.ts                 # Block Kit rendering of the summary
│  └─ ai/
│     ├─ transcribe.ts             # Groq Whisper (swappable)
│     └─ summarize.ts              # Groq Llama, JSON output (swappable)
├─ migrations/
│  └─ 0001_init.sql
├─ worker.ts                       # custom entry: OpenNext fetch + scheduled() (verify in spike)
├─ wrangler.jsonc                  # D1 binding, cron triggers, vars
├─ open-next.config.ts
├─ slack-manifest.yml
├─ .dev.vars.example               # local secrets template
└─ README.md                       # setup steps
```

---

## 10. Configuration & Secrets

| Name | Type | Example | Where |
|---|---|---|---|
| `SLACK_BOT_TOKEN` | secret | `xoxb-...` | `.dev.vars` locally, `wrangler secret put` in prod |
| `SLACK_SIGNING_SECRET` | secret | | same |
| `GROQ_API_KEY` | secret | | same |
| `CRON_SECRET` | secret | random string | same |
| `STANDUP_CHANNEL_ID` | var | `C0123456789` | `wrangler.jsonc` `vars` |
| `TEAM_TIMEZONE` | var | `Asia/Kolkata` | `wrangler.jsonc` `vars` |
| `DB` | D1 binding | `standup-db` | `wrangler.jsonc` `d1_databases` |

Never commit `.dev.vars` (add to `.gitignore`).

---

## 11. Local Development Workflow

```bash
# 1. Create project
npm create cloudflare@latest standup-bot -- --framework=next   # or create-next-app + @opennextjs/cloudflare

# 2. Create D1 database and apply migrations locally
npx wrangler d1 create standup-db
npx wrangler d1 migrations apply standup-db --local

# 3. Run the app (bindings available in dev via OpenNext dev integration)
npm run dev                     # next dev on http://localhost:3000

# 4. Expose it to Slack
cloudflared tunnel --url http://localhost:3000
#  → copy the https://*.trycloudflare.com URL into Slack:
#    Event Subscriptions → Request URL → https://<tunnel>/api/slack/events

# 5. Trigger cron jobs manually
curl -X POST http://localhost:3000/api/cron/reminder -H "Authorization: Bearer $CRON_SECRET"
curl -X POST http://localhost:3000/api/cron/summary  -H "Authorization: Bearer $CRON_SECRET"

# 6. Test the full Worker build locally (closer to production)
npm run preview                 # opennextjs-cloudflare build + wrangler dev
```

> **Note:** a quick `cloudflared` tunnel gets a **new URL every run**, so the Slack Request URL must be updated each time. Use a named tunnel (free with a Cloudflare account) to keep a stable URL.

---

## 12. Day-1 Spike (validate risky assumptions first)

Do these before building features — each one can change the architecture.

| # | Check | If it fails |
|---|---|---|
| S1 | Deploy a hello-world Next.js app to Workers with OpenNext; check **bundle size** and **CPU time** against the Workers Free plan limits | Upgrade to Workers Paid (~$5/month) |
| S2 | Wire a `scheduled()` handler into the OpenNext worker and confirm it can call `/api/cron/*` | Use a separate tiny cron Worker that calls the app's routes |
| S3 | Confirm `ctx.waitUntil` keeps running long enough for download + transcribe + reply (~5–10 s) after Slack gets its 200 | Move processing to **Cloudflare Queues** |
| S4 | Record a real Slack clip, download it via the API, send it to Groq Whisper unmodified (webm/mp4) | Try Workers AI Whisper, or the other file variant Slack provides |
| S5 | (Optional) Compare Workers AI Whisper + Llama vs Groq on the same clip | Keep Groq as default |

---

## 13. Phased Roadmap

### Phase 0 – Setup (½ day)
- [ ] Slack test workspace + app created from manifest
- [ ] Groq API key
- [ ] Cloudflare account, `wrangler login`
- [ ] Day-1 spike (§12)

### Phase 1 – MVP (~2–3 days)
- [ ] Next.js + Tailwind + OpenNext scaffold, D1 binding, migration `0001`
- [ ] `/api/slack/events`: verification, challenge, dedupe, filtering
- [ ] Voice flow → transcript thread reply → upsert
- [ ] Text flow → upsert + ✅ reaction or short ack
- [ ] `/api/cron/reminder` + `/api/cron/summary` with Block Kit output
- [ ] Cron Triggers wired
- [ ] Today page (`/`) showing summary + updates
- [ ] README with setup steps

**Acceptance criteria:**
- Posting a voice clip in the channel → transcript appears in thread within ~30 s.
- Posting text → stored; a second post the same day replaces the first.
- Calling the summary route → one Slack message with updates, blockers, and non-submitters.
- Slack retries do not create duplicate replies.
- The bot never responds to its own messages.

### Phase 2 – Blockers & reminders (v2)
- [ ] Extract blockers + helper(s) per update at ingest time (pass the channel roster `name → user_id` to the model; only accept IDs from the roster)
- [ ] `blockers` table; group DM via `conversations.open` with blocked user + helpers
- [ ] "Huddle needed" button + per-user personal Meet/Zoom link
- [ ] 09:50 DM to members who haven't posted
- [ ] Correcting a transcript by replying in its thread

### Phase 3 – Configurability (v3)
- [ ] Holidays list, on-leave flag
- [ ] Settings (times, channel) in a D1 `config` table, editable from the dashboard
- [ ] Blocker age tracking (FR-17)

### Phase 4 – Dashboard & production (v4)
- [ ] History by date and by person (FR-18)
- [ ] "Hours saved" stat (FR-19): `members × 15 min − recording time`
- [ ] Remote D1 (`wrangler d1 migrations apply standup-db --remote`), production deploy
- [ ] **Protect the dashboard with Cloudflare Access** — transcripts are sensitive
- [ ] Production Slack app pointed at the Workers URL

---

## 14. Cost Estimate (~10 people)

| Item | Cost |
|---|---|
| Slack app | Free |
| Groq Whisper + Llama | Free tier (well within limits) |
| Cloudflare Workers + D1 + Cron | Free tier — **may need Workers Paid (~$5/month)** depending on spike S1 |
| Fallback: OpenAI Whisper + Claude Haiku | ~$2/month |

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Next.js bundle / CPU exceeds Workers Free limits | Spike S1; Workers Paid plan |
| Slack 3-second ack timeout | Ack immediately; process in `waitUntil` / Queues; dedupe by `event_id` |
| Free AI tier rate limits or outages | Fallback reply asking user to type; provider swappable |
| Company policy on sending audio externally | Raise with IT now; Workers AI (data stays in Cloudflare) or self-hosted Whisper as fallback |
| Dashboard exposes transcripts publicly | Cloudflare Access before any public deploy |
| Wrong date bucket around midnight UTC | All dates computed in IST (§6) |

---

## 16. Open Decisions (defaults used until decided)

| Decision | Default |
|---|---|
| Public or private standup channel? | **Public** |
| Reminder / missing-DM / summary times | **09:30 / 09:50 / 10:00 IST**, Mon–Fri |
| AI provider | **Groq** (Whisper + Llama) |
| Who sees summaries? | Standup channel only |
| IT approval for external AI | Pending — ask before team rollout |
