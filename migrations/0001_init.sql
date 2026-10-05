-- Slack users seen by the bot (name cache)
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One standup update per user per day (latest wins)
CREATE TABLE updates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  date        TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('voice', 'text')),
  transcript  TEXT NOT NULL,
  slack_ts    TEXT NOT NULL,
  file_id     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, date)
);

CREATE TABLE summaries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL UNIQUE,
  summary_json  TEXT NOT NULL,
  slack_ts      TEXT,
  posted_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Slack retries the same event if not acked in 3s; dedupe by event_id
CREATE TABLE processed_events (
  event_id     TEXT PRIMARY KEY,
  received_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
