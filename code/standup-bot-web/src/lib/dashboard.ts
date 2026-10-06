import { teamDate } from "@/lib/date";
import { getSummary, getUpdatesForDate, getUsers, type UpdateWithName } from "@/lib/db";

export type StoredSummary = {
  people: { user_id: string; line: string }[];
  blockers: { user_id: string; text: string }[];
  missing: string[];
  fallback: boolean;
  postedAt: string;
};

export type TodayDashboard = {
  date: string;
  summary: StoredSummary | null;
  updates: UpdateWithName[];
  namesById: Map<string, string>;
};

function parseStoredSummary(json: string, postedAt: string): StoredSummary | null {
  try {
    const data = JSON.parse(json) as Partial<StoredSummary>;
    return {
      people: Array.isArray(data.people) ? data.people : [],
      blockers: Array.isArray(data.blockers) ? data.blockers : [],
      missing: Array.isArray(data.missing) ? data.missing : [],
      fallback: Boolean(data.fallback),
      postedAt,
    };
  } catch {
    return null;
  }
}

export async function getTodayDashboard(env: CloudflareEnv): Promise<TodayDashboard> {
  const date = teamDate(new Date(), env.TEAM_TIMEZONE);
  const [summaryRow, updates, users] = await Promise.all([
    getSummary(env.DB, date),
    getUpdatesForDate(env.DB, date),
    getUsers(env.DB),
  ]);
  const summary =
    summaryRow?.slack_ts ? parseStoredSummary(summaryRow.summary_json, summaryRow.posted_at) : null;
  const namesById = new Map(users.map((u) => [u.id, u.name]));
  return { date, summary, updates, namesById };
}
