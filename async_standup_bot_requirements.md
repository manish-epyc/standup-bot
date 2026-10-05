# Skip the Standup – Async Voice Standup Bot for Slack

**Document type:** Requirements & Project Plan
**Author:** _[Your Name]_
**Date:** 2 October 2026
**Status:** Draft v1.0

---

## 1. Overview

**Skip the Standup** is a Slack bot that replaces the daily standup call with short voice notes. Each team member records a ~1 minute voice update in Slack at their own convenience. The bot converts the voice notes to text, posts a single team summary, and brings together only the people who need to talk when someone is blocked.

**One-line pitch:** _"1 minute of recording per person instead of 15 minutes of everyone's time in a call."_

---

## 2. Problem Statement

The team currently holds a daily standup on Zoom / Google Meet / Slack huddle. Common issues:

- Everyone must be online at the same time, even if only a few updates are relevant to them.
- Standups often run over time due to side discussions.
- People who miss the call have no written record of what was discussed.
- Blockers are mentioned verbally and often not followed up.

**Time cost example:** 10 people × 15 minutes × 22 working days = **55 person-hours per month**.

---

## 3. Goals & Non-Goals

### Goals
- Allow team members to give their standup update asynchronously via voice.
- Automatically produce a written, searchable daily summary.
- Detect blockers and connect only the relevant people.
- Keep the setup simple enough to build incrementally in weekly showcases.

### Non-Goals (for now)
- Replacing sprint planning, retrospectives, or other meetings.
- Video updates.
- Integrations with Jira, GitHub, or other project tools (possible future scope).
- Attending calls on behalf of a user.

---

## 4. Users

| User | Description | Needs |
|---|---|---|
| Team member | Developer, QA, designer, etc. | Quick way to give an update; read others' updates |
| Team lead / Manager | Runs the standup today | Clear daily overview; visibility into blockers |
| Absent member | On leave or joined late | Catch up on the team's status in under a minute |

---

## 5. How It Works (User Flow)

1. **09:30** – Bot posts a reminder in the standup channel: _"Time for standup! Send your voice update."_
2. **09:30 – 10:00** – Each member records a voice clip in Slack covering:
   - What I did yesterday
   - What I'll do today
   - Any blockers
3. **On receiving a voice note** – Bot transcribes it and replies in a thread with the text version.
4. **10:00** – Bot posts one combined team summary in the channel.
5. **If a blocker is detected** – Bot messages the blocked person and the person who can help, with a meeting link or a "Huddle needed" prompt.
6. **Members who haven't posted** – Bot sends a gentle reminder at 09:50.

---

## 6. Functional Requirements

### 6.1 Reminders
| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Bot posts a standup reminder at a configurable time on weekdays. | Must |
| FR-2 | Bot skips reminders on weekends and configured holidays. | Should |
| FR-3 | Bot sends a reminder DM to members who haven't posted by a configurable cutoff. | Should |

### 6.2 Voice Note Processing
| ID | Requirement | Priority |
|---|---|---|
| FR-4 | Bot detects audio/video clips posted in the standup channel. | Must |
| FR-5 | Bot downloads the clip and converts it to text using a speech-to-text service. | Must |
| FR-6 | Bot replies in a thread with the transcribed text. | Must |
| FR-7 | Bot stores the update (user, date, transcript) in the database. | Must |
| FR-8 | Bot also accepts plain text updates for people who prefer typing. | Should |
| FR-9 | If a user posts more than once, the latest update replaces the earlier one for that day. | Could |

### 6.3 Daily Summary
| ID | Requirement | Priority |
|---|---|---|
| FR-10 | At the configured time, bot generates a combined summary using an AI model. | Must |
| FR-11 | Summary lists each person with a one-line update. | Must |
| FR-12 | Summary highlights blockers in a separate section. | Must |
| FR-13 | Summary lists members who did not submit an update. | Should |

### 6.4 Blocker Handling
| ID | Requirement | Priority |
|---|---|---|
| FR-14 | AI extracts blockers and the person(s) mentioned as able to help. | Must |
| FR-15 | Bot sends a group message to the blocked person and helper(s). | Must |
| FR-16 | Bot includes a Google Meet / Zoom link, or a "Huddle needed" prompt. | Should |
| FR-17 | Bot tracks how many days a blocker remains open. | Could |

### 6.5 Dashboard (Later Phase)
| ID | Requirement | Priority |
|---|---|---|
| FR-18 | Web page showing standup history by date and by person. | Could |
| FR-19 | Shows estimated meeting hours saved. | Could |

---

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | A voice note should be transcribed and replied to within ~30 seconds. |
| Reliability | If transcription fails, the bot replies asking the user to retry or type their update. |
| Privacy | Team members must be informed that voice notes are sent to an external AI service. |
| Security | All tokens and API keys stored in environment variables, never in code. |
| Configurability | Reminder time, summary time, channel, and holidays configurable without code changes. |
| Cost | Should run within a small monthly budget for a team of ~10 people. |

---

## 8. Tech Stack

| Component | Choice | Purpose |
|---|---|---|
| Runtime | Node.js | Bot logic |
| Slack integration | Slack Bolt for JavaScript (Socket Mode) | Receive events and post messages without a public server |
| Scheduler | `node-cron` | Morning reminder and summary times |
| Speech-to-text | OpenAI Whisper API, or local Whisper | Convert voice to text |
| AI summary | Claude API (or similar LLM) | Summarise updates and detect blockers |
| Database | SQLite | Store users, updates, and blockers |
| Meeting links (optional) | Google Calendar API / Zoom API | Generate links for blocker calls |
| Dashboard (later) | React or plain HTML + Express | Show history and stats |

---

## 9. Architecture

```
┌──────────────┐     voice clip      ┌─────────────────────┐
│  Slack User  │ ──────────────────▶ │   Slack Workspace   │
└──────────────┘                     └──────────┬──────────┘
                                                │ events (Socket Mode)
                                                ▼
                                     ┌─────────────────────┐
                                     │   Standup Bot       │
                                     │   (Node.js + Bolt)  │
                                     └───┬───────┬──────┬──┘
                         audio file      │       │      │  updates
                    ┌────────────────────┘       │      └──────────────┐
                    ▼                            ▼                     ▼
          ┌──────────────────┐       ┌──────────────────┐    ┌────────────────┐
          │ Speech-to-Text   │       │  AI Summary      │    │  SQLite DB     │
          │ (Whisper)        │       │  (Claude API)    │    │                │
          └──────────────────┘       └──────────────────┘    └────────────────┘
```

---

## 10. Data Model

```
users
  id            TEXT  (Slack user ID)
  name          TEXT
  is_active     BOOLEAN

updates
  id            INTEGER PRIMARY KEY
  user_id       TEXT  → users.id
  date          DATE
  source        TEXT  ('voice' | 'text')
  transcript    TEXT
  created_at    DATETIME

blockers
  id            INTEGER PRIMARY KEY
  update_id     INTEGER → updates.id
  description   TEXT
  helper_ids    TEXT  (comma-separated Slack user IDs)
  status        TEXT  ('open' | 'resolved')
  opened_on     DATE
  resolved_on   DATE

summaries
  id            INTEGER PRIMARY KEY
  date          DATE
  summary_text  TEXT
  posted_at     DATETIME
```

---

## 11. Slack App Setup

**Settings to enable:**
- Socket Mode (requires an app-level token)
- Event Subscriptions

**Bot token scopes (initial):**
- `chat:write` – post messages
- `channels:history` – read messages in public channels
- `files:read` – download voice clips
- `users:read` – get member names
- `im:write` / `mpim:write` – send direct and group messages for blockers

**Events to subscribe to:**
- `message.channels` – detect messages and clips in the standup channel

> Scopes may need adjusting during development depending on whether the channel is public or private.

---

## 12. Milestones (Weekly Showcase Plan)

| Week | Deliverable | Demo |
|---|---|---|
| **1** | Slack app setup, morning reminder, voice note → text reply | Record a voice note live; bot replies with the text |
| **2** | Store updates in DB; post daily AI summary | Show the combined team summary |
| **3** | Blocker detection and group message with meeting link | Mention a blocker; bot connects the right people |
| **4** | Missing-update reminders, text updates, holiday skipping | Show reminder flow end-to-end |
| **5** | Web dashboard with history and hours saved | Show "X hours saved this month" |

Each week is scoped for roughly **4–6 hours** of work.

---

## 13. Showcase Demo Script (Week 1 Example)

1. **Problem (30 sec):** "Our team spends about 55 hours a month in standups. What if we didn't have to?"
2. **Live demo (2 min):** Record a voice note in Slack, then show the bot's text reply in the thread.
3. **How it works (1.5 min):** Show the architecture diagram and the key piece of code that handles the voice clip.
4. **What I learned (30 sec):** One interesting thing, e.g. how Slack Socket Mode works without a server.
5. **Next week (30 sec):** "Next week, the bot will summarise the whole team's updates automatically."

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Company policy may not allow sending audio to external AI services | Check with IT early; use local Whisper as a fallback |
| Slack app installation needs admin approval | Build and demo in a personal test workspace first |
| Poor transcription with background noise or accents | Show the transcript to the user so they can correct it via text |
| Team prefers face-to-face standups | Position it as optional at first, e.g. async on 2–3 days a week |
| Slack doesn't allow bots to start huddles automatically | Use a Meet/Zoom link or a "Huddle needed" prompt instead |

---

## 15. Success Metrics

- % of team members submitting updates on time
- Average time from 09:30 to summary posted
- Number of standup calls avoided per month
- Estimated person-hours saved per month
- Team feedback after 2 weeks of use

---

## 16. Open Questions

- [ ] Is it allowed to send voice recordings to an external AI service under company policy?
- [ ] Who can approve installing a custom Slack app in the company workspace?
- [ ] Should the bot fully replace the call, or run alongside it on some days?
- [ ] What should the reminder and summary times be?
- [ ] Should updates be visible only to the team channel or also to managers in other teams?

---

## 17. Future Enhancements

- Pull yesterday's work from Jira / GitHub to pre-fill updates
- Support for multiple teams and channels
- Weekly and monthly "Standup Wrapped" stats
- Language support for Hindi and mixed Hindi-English updates
- Slack slash commands such as `/standup skip` or `/standup status`
