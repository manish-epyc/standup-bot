# Skip the Standup – Remaining Features Plan

**Date:** 12 October 2026
**Builds on:** `2026-10-05-mvp-plan.md`, `../01-requirements.md`
**Tracking:** one GitHub issue per feature below (milestone per phase). This doc holds design and order, not status.

---

## 1. Where we are

Built and tested live (real Slack workspace, real Groq, local D1) on 12 Oct 2026:

| Area | Requirements |
|---|---|
| Reminder 09:30 IST, weekdays | FR-1, FR-2 (weekends only) |
| "You haven't posted" DM 09:50 IST, once per user per day | FR-3 |
| Voice clip → `whisper-large-v3` → thread reply → stored | FR-4 – FR-7 |
| Text updates with ✅ ack; latest post of the day wins | FR-8, FR-9 |
| AI summary 10:00 IST (`qwen/qwen3.8-27b`): per-person lines, blockers, not-submitted | FR-10 – FR-13 |
| Transcription failure → "retry or type" reply | NFR Reliability |
| Today page | FR-18 (today only) |

Not yet proven: production deploy, cron wiring on Cloudflare, `waitUntil` lifetime (spikes S1–S3).

---

## 2. Order and dependencies

```
Phase A  Ship what exists ──► Phase B  Quick wins ──► Phase C  Blockers ──► Phase D  Availability & config
   (deploy, spikes)            (small, independent)     FR-14 → FR-15 → FR-16      FR-2 holidays/leave
                                                            └──► FR-17 aging        config table + tick cron
                                                                                        │
                                                         Phase E  Dashboard ◄───────────┘ (editing needs Access)
                                                         FR-18 history, FR-19 hours saved

Phase F  Transcript correction (thread replies) — independent, any time after A
Phase G  Pilot — after A + IT approval
```

Phase A goes first because spike S3 can change the ingest architecture (Queues instead of `waitUntil`), which Phase C's ingest-time blocker extraction builds on.

---

## 3. Phases

### Phase A – Ship what exists
- PR the current branch into `main` (it also carries the standup-flows commit that never reached `main`).
- Fix the Windows build: OpenNext needs symlinks → enable **Windows Developer Mode**, or build in **WSL**, or deploy from **GitHub Actions**.
- `wrangler d1 create`, remote migrations, `wrangler secret put` ×4, deploy (#11).
- Spikes: S1 bundle/CPU vs Workers Free, S2 cron wiring fires, S3 `waitUntil` survives download + transcribe + reply.
- **Cloudflare Access** on the dashboard before the URL is shared.
- Point the Slack Request URL at the Workers URL; close #2, #5–#10.

**Decisions needed:** Developer Mode vs WSL vs CI.

### Phase B – Quick wins (one PR)
| Item | Change |
|---|---|
| Privacy notice (NFR Privacy) | One line in the reminder: voice notes are transcribed by an external AI service. |
| Whisper glossary | `prompt` parameter from a `TRANSCRIBE_HINTS` var in `wrangler.jsonc` (names, projects, terms). Fixes "Pavebank" → "pavement". |
| Hindi / Hinglish | Verify with real clips; decide whether Devanagari transcripts are fine or should be translated to English. |
| Summary copy | "1 updates" → "1 update". |
| Blocker prompt | Optionally treat "waiting on someone to assign/unblock me" as a blocker. |

**Decisions needed:** glossary word list; Hindi output preference; blocker definition.

### Phase C – Blocker handling (FR-14, FR-15, FR-16) — *Must*
1. **FR-14 Extract blocker + helper at ingest time.** After each update is stored, ask the LLM for `{blocked: bool, text, helper_ids[]}`, passing the channel roster (`name → user_id`). Accept only IDs from the roster; drop anything else.
2. **`blockers` table** (migration `0003`): `id, update_id, user_id, date, text, helper_ids, status ('open'|'resolved'), opened_on, resolved_on`.
3. **FR-15 Group DM.** `conversations.open` with blocked user + helpers → post the blocker. Needs scopes `im:write`, `mpim:write` → update manifest, **reinstall the app**, re-check the token. One group DM per blocker (dedupe on blocker id).
4. **FR-16 Meeting prompt.** Start with a text "Huddle needed — start a huddle in this DM" (no new endpoint). Optional later: a button, which needs Slack **Interactivity** + a new signed route `/api/slack/interactions` (form-encoded `payload`).

**Decisions needed:** send the group DM immediately on ingest or at summary time; plain prompt vs button; Meet/Zoom link source (static per-team link vs none).

### Phase C2 – Blocker aging (FR-17) — *Could*
- Summary shows "open for N days" for blockers carried over.
- **Decision needed:** how a blocker gets resolved — "Resolved" button in the group DM (needs Interactivity), or auto-resolved when the person's next update doesn't repeat it (LLM compares), or both.

### Phase D – Availability and configurability (FR-2, NFR Configurability)
- **Holidays + on-leave** (migration): `holidays(date)`, `leave(user_id, from, to)`. One shared check `isExpected(user, date)` used by reminder, nudge and the summary's "Not submitted" list.
- **How people set leave:** slash command `/standup leave <dates>` (needs `commands` scope + a new signed endpoint) or dashboard (needs Access).
- **Configurable times/channel:** cron strings are fixed at deploy, so switch to a **tick cron** (e.g. every 5 min, 03:00–06:00 UTC weekdays) that reads a D1 `config` table and runs whichever job is due, with a per-day "already ran" record (same claim pattern as summaries/nudges).

**Decisions needed:** slash command vs dashboard for leave; whether configurable times are worth the tick-cron change now.

### Phase E – Dashboard (FR-18, FR-19) — *Could*
- History by date and by person; past summaries.
- Hours saved: `members × 15 min − recording time` per day (store clip duration from Slack's `duration_ms`).
- Settings page for Phase D config (only behind Cloudflare Access).

### Phase F – Transcript correction
- Let a user fix their transcript by replying in the bot's transcript thread (requirements §14 mitigation).
- Conflicts with the current "ignore thread replies" rule in `routeMessage` **and** `AGENTS.md` → both change together. Only the update's author can correct it.

### Phase G – Pilot (#12)
- IT approval for sending audio to Groq (requirements §16).
- Company workspace: who approves the custom app; production Slack app pointed at the Workers URL.
- Two-week pilot, then review success metrics (requirements §15).

---

## 4. Open decisions (summary)

| # | Decision | Blocks |
|---|---|---|
| 1 | Developer Mode / WSL / GitHub Actions for builds | A |
| 2 | Glossary words; Hindi output in Devanagari or English | B |
| 3 | Group DM on ingest or at summary time; button or text prompt; meeting link source | C |
| 4 | How blockers get resolved | C2 |
| 5 | Leave via slash command or dashboard; configurable times now or later | D |
| 6 | IT approval; company app approver | G |
