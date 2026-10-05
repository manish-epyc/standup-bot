export type UpdateSource = "voice" | "text";

export type User = {
  id: string;
  name: string;
  is_active: number;
  updated_at: string;
};

export type Update = {
  id: number;
  user_id: string;
  date: string;
  source: UpdateSource;
  transcript: string;
  slack_ts: string;
  file_id: string | null;
  created_at: string;
};

export type UpdateWithName = Update & { user_name: string };

export type Summary = {
  id: number;
  date: string;
  summary_json: string;
  slack_ts: string | null;
  posted_at: string;
};

export type NewUpdate = {
  userId: string;
  date: string;
  source: UpdateSource;
  transcript: string;
  slackTs: string;
  fileId?: string | null;
};

export async function getUser(db: D1Database, id: string): Promise<User | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<User>();
}

export async function upsertUser(db: D1Database, id: string, name: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, name) VALUES (?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = datetime('now')`,
    )
    .bind(id, name)
    .run();
}

export async function upsertUpdate(db: D1Database, update: NewUpdate): Promise<void> {
  await db
    .prepare(
      `INSERT INTO updates (user_id, date, source, transcript, slack_ts, file_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, date) DO UPDATE SET
         source = excluded.source,
         transcript = excluded.transcript,
         slack_ts = excluded.slack_ts,
         file_id = excluded.file_id,
         created_at = datetime('now')`,
    )
    .bind(
      update.userId,
      update.date,
      update.source,
      update.transcript,
      update.slackTs,
      update.fileId ?? null,
    )
    .run();
}

export async function getUpdatesForDate(db: D1Database, date: string): Promise<UpdateWithName[]> {
  const { results } = await db
    .prepare(
      `SELECT updates.*, users.name AS user_name
       FROM updates JOIN users ON users.id = updates.user_id
       WHERE updates.date = ?
       ORDER BY updates.created_at`,
    )
    .bind(date)
    .all<UpdateWithName>();
  return results;
}

/** Returns false when the event was already processed (Slack retry). */
export async function markEventProcessed(db: D1Database, eventId: string): Promise<boolean> {
  const result = await db
    .prepare("INSERT INTO processed_events (event_id) VALUES (?) ON CONFLICT (event_id) DO NOTHING")
    .bind(eventId)
    .run();
  return result.meta.changes > 0;
}

export async function getSummary(db: D1Database, date: string): Promise<Summary | null> {
  return db.prepare("SELECT * FROM summaries WHERE date = ?").bind(date).first<Summary>();
}

/** Returns false when a summary for the date already exists. */
export async function saveSummary(
  db: D1Database,
  date: string,
  summaryJson: string,
  slackTs: string | null,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO summaries (date, summary_json, slack_ts) VALUES (?, ?, ?)
       ON CONFLICT (date) DO NOTHING`,
    )
    .bind(date, summaryJson, slackTs)
    .run();
  return result.meta.changes > 0;
}
