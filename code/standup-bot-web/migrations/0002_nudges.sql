-- One "you haven't posted" DM per user per day, so re-runs never DM twice
CREATE TABLE nudges (
  date     TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  sent_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (date, user_id)
);
