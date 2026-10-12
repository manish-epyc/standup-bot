-- One blocker per user per day: the latest update of the day replaces it
CREATE TABLE blockers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id    INTEGER NOT NULL REFERENCES updates(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  date         TEXT NOT NULL,
  text         TEXT NOT NULL,
  helper_ids   TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  opened_on    TEXT NOT NULL,
  resolved_on  TEXT,
  UNIQUE (user_id, date)
);

CREATE INDEX blockers_date ON blockers (date);
