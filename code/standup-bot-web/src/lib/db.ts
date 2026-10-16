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
  duration_ms: number | null;
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
  durationMs?: number | null;
};

export async function getUser(db: D1Database, id: string): Promise<User | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<User>();
}

export async function getUsers(db: D1Database): Promise<User[]> {
  const { results } = await db.prepare("SELECT * FROM users ORDER BY name").all<User>();
  return results;
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

/** Stores the update and returns its row id, which stays the same when a later post replaces it. */
export async function upsertUpdate(db: D1Database, update: NewUpdate): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO updates (user_id, date, source, transcript, slack_ts, file_id, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, date) DO UPDATE SET
         source = excluded.source,
         transcript = excluded.transcript,
         slack_ts = excluded.slack_ts,
         file_id = excluded.file_id,
         duration_ms = excluded.duration_ms,
         created_at = datetime('now')
       RETURNING id`,
    )
    .bind(
      update.userId,
      update.date,
      update.source,
      update.transcript,
      update.slackTs,
      update.fileId ?? null,
      update.durationMs ?? null,
    )
    .first<{ id: number }>();
  if (!row) throw new Error("update upsert returned no row");
  return row.id;
}

export async function getUpdateBySlackTs(db: D1Database, slackTs: string): Promise<Update | null> {
  return db.prepare("SELECT * FROM updates WHERE slack_ts = ?").bind(slackTs).first<Update>();
}

/** Applies only while the update still belongs to `slackTs`, so a correction can't overwrite a newer post. */
export async function setUpdateTranscript(
  db: D1Database,
  updateId: number,
  slackTs: string,
  transcript: string,
): Promise<boolean> {
  const result = await db
    .prepare("UPDATE updates SET transcript = ? WHERE id = ? AND slack_ts = ?")
    .bind(transcript, updateId, slackTs)
    .run();
  return result.meta.changes > 0;
}

export type Blocker = {
  id: number;
  update_id: number;
  user_id: string;
  date: string;
  text: string;
  helper_ids: string;
  status: "open" | "resolved";
  opened_on: string;
  resolved_on: string | null;
};

/**
 * Replaces the user's blocker for the day with the one extracted from `updateId`, or removes it
 * when `blocker` is null. Both only apply while the update still has `slackTs`: extraction runs
 * after the post is acked, so a slower run for an earlier post must not overwrite a newer one.
 */
export async function replaceBlocker(
  db: D1Database,
  target: { updateId: number; slackTs: string; userId: string; date: string },
  blocker: { text: string; helperIds: string[] } | null,
): Promise<void> {
  if (!blocker) {
    await db
      .prepare(
        `DELETE FROM blockers WHERE user_id = ? AND date = ?
         AND EXISTS (SELECT 1 FROM updates WHERE id = ? AND slack_ts = ?)`,
      )
      .bind(target.userId, target.date, target.updateId, target.slackTs)
      .run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO blockers (update_id, user_id, date, text, helper_ids, opened_on)
       SELECT id, user_id, date, ?, ?, date FROM updates WHERE id = ? AND slack_ts = ?
       ON CONFLICT (user_id, date) DO UPDATE SET
         update_id = excluded.update_id,
         text = excluded.text,
         helper_ids = excluded.helper_ids,
         status = 'open',
         resolved_on = NULL`,
    )
    .bind(blocker.text, JSON.stringify(blocker.helperIds), target.updateId, target.slackTs)
    .run();
}

export async function getBlockersForDate(db: D1Database, date: string): Promise<Blocker[]> {
  const { results } = await db
    .prepare("SELECT * FROM blockers WHERE date = ? AND status = 'open' ORDER BY id")
    .bind(date)
    .all<Blocker>();
  return results;
}

export function parseHelperIds(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
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

// A day counts as a standup day when it has updates or a posted summary; a summary's own copy of
// the day survives even when that day's update rows are gone.
const STANDUP_DATES = `SELECT date FROM updates UNION SELECT date FROM summaries WHERE slack_ts IS NOT NULL`;

export async function getStandupDates(
  db: D1Database,
  limit: number,
): Promise<{ date: string; count: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT days.date, (SELECT COUNT(*) FROM updates WHERE updates.date = days.date) AS count
       FROM (${STANDUP_DATES}) AS days
       ORDER BY days.date DESC LIMIT ?`,
    )
    .bind(limit)
    .all<{ date: string; count: number }>();
  return results;
}

export async function getLatestStandupDateBefore(db: D1Database, date: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT date FROM (${STANDUP_DATES}) WHERE date < ? ORDER BY date DESC LIMIT 1`)
    .bind(date)
    .first<{ date: string }>();
  return row?.date ?? null;
}

export async function getUpdatesForUser(db: D1Database, userId: string, limit: number): Promise<Update[]> {
  const { results } = await db
    .prepare("SELECT * FROM updates WHERE user_id = ? ORDER BY date DESC LIMIT ?")
    .bind(userId, limit)
    .all<Update>();
  return results;
}

export async function getUpdateDurationsSince(
  db: D1Database,
  fromDate: string,
): Promise<{ date: string; source: UpdateSource; duration_ms: number | null }[]> {
  const { results } = await db
    .prepare("SELECT date, source, duration_ms FROM updates WHERE date >= ?")
    .bind(fromDate)
    .all<{ date: string; source: UpdateSource; duration_ms: number | null }>();
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

/**
 * Claims the day's summary before posting, so overlapping runs (cron + manual) post once.
 * Returns false when another run already claimed it.
 */
export async function claimSummary(db: D1Database, date: string, summaryJson: string): Promise<boolean> {
  const result = await db
    .prepare("INSERT INTO summaries (date, summary_json) VALUES (?, ?) ON CONFLICT (date) DO NOTHING")
    .bind(date, summaryJson)
    .run();
  return result.meta.changes > 0;
}

export async function setSummarySlackTs(db: D1Database, date: string, slackTs: string): Promise<void> {
  await db.prepare("UPDATE summaries SET slack_ts = ? WHERE date = ?").bind(slackTs, date).run();
}

export async function releaseSummaryClaim(db: D1Database, date: string): Promise<void> {
  await db.prepare("DELETE FROM summaries WHERE date = ? AND slack_ts IS NULL").bind(date).run();
}

/** Claims a user's nudge for the day before sending; false when it was already sent. */
export async function claimNudge(db: D1Database, date: string, userId: string): Promise<boolean> {
  const result = await db
    .prepare("INSERT INTO nudges (date, user_id) VALUES (?, ?) ON CONFLICT (date, user_id) DO NOTHING")
    .bind(date, userId)
    .run();
  return result.meta.changes > 0;
}

export async function releaseNudgeClaim(db: D1Database, date: string, userId: string): Promise<void> {
  await db.prepare("DELETE FROM nudges WHERE date = ? AND user_id = ?").bind(date, userId).run();
}
