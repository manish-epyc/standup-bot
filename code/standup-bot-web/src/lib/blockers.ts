import { extractBlocker } from "@/lib/ai/blockers";
import { getBlockersForDate, getUsers, parseHelperIds, replaceBlocker } from "@/lib/db";
import { getHumanChannelMembers } from "@/lib/users";

export type StoredUpdate = {
  updateId: number;
  slackTs: string;
  userId: string;
  date: string;
  transcript: string;
};

export type SummaryBlocker = { user_id: string; text: string; helper_ids: string[] };

export async function getSummaryBlockers(db: D1Database, date: string): Promise<SummaryBlocker[]> {
  const rows = await getBlockersForDate(db, date);
  return rows.map((b) => ({ user_id: b.user_id, text: b.text, helper_ids: parseHelperIds(b.helper_ids) }));
}

/**
 * Extracts the update's blocker and helpers and stores it as the user's blocker for the day.
 * Never throws: a failed extraction must not turn an already-stored update into an error.
 */
export async function recordBlocker(env: CloudflareEnv, channel: string, update: StoredUpdate): Promise<void> {
  try {
    const memberIds = new Set(await getHumanChannelMembers(env.DB, env.SLACK_BOT_TOKEN, channel));
    const users = await getUsers(env.DB);
    const roster = users
      .filter((u) => memberIds.has(u.id) && u.id !== update.userId)
      .map((u) => ({ userId: u.id, name: u.name }));

    const blocker = await extractBlocker(env.GROQ_API_KEY, update.transcript, roster);
    await replaceBlocker(env.DB, update, blocker);
  } catch (error) {
    console.error("blocker extraction failed", { updateId: update.updateId, error: String(error) });
  }
}
