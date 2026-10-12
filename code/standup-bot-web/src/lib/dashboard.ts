import { teamDate } from "@/lib/date";
import {
  getSummary,
  getUpdateDates,
  getUpdateDurationsSince,
  getUpdatesForDate,
  getUpdatesForUser,
  getUser,
  getUsers,
  type UpdateWithName,
} from "@/lib/db";
import { calculateHoursSaved, type HoursSaved } from "@/lib/hours-saved";

export type StoredSummary = {
  people: { user_id: string; line: string }[];
  // Summaries stored before helpers were tracked have no helper_ids.
  blockers: { user_id: string; text: string; helper_ids?: string[] }[];
  missing: string[];
  fallback: boolean;
  postedAt: string;
};

export type DayView = {
  date: string;
  summary: StoredSummary | null;
  updates: UpdateWithName[];
  namesById: Map<string, string>;
};

export type TodayDashboard = DayView & { hoursSaved: HoursSaved };

const HISTORY_LIMIT = 90;

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

export async function getDayView(env: CloudflareEnv, date: string): Promise<DayView> {
  const [summaryRow, updates, users] = await Promise.all([
    getSummary(env.DB, date),
    getUpdatesForDate(env.DB, date),
    getUsers(env.DB),
  ]);
  const summary =
    summaryRow?.slack_ts ? parseStoredSummary(summaryRow.summary_json, summaryRow.posted_at) : null;
  return { date, summary, updates, namesById: new Map(users.map((u) => [u.id, u.name])) };
}

export async function getTodayDashboard(env: CloudflareEnv): Promise<TodayDashboard> {
  const date = teamDate(new Date(), env.TEAM_TIMEZONE);
  const [day, users, monthRows] = await Promise.all([
    getDayView(env, date),
    getUsers(env.DB),
    getUpdateDurationsSince(env.DB, `${date.slice(0, 7)}-01`),
  ]);
  // `users` holds every human the bot has seen in the channel, which is the team that would have met.
  const members = users.filter((u) => u.is_active).length;
  return { ...day, hoursSaved: calculateHoursSaved(monthRows, members, date) };
}

export async function getHistoryIndex(env: CloudflareEnv) {
  const [dates, users] = await Promise.all([getUpdateDates(env.DB, HISTORY_LIMIT), getUsers(env.DB)]);
  return { dates, users };
}

export async function getPersonHistory(env: CloudflareEnv, userId: string) {
  const user = await getUser(env.DB, userId);
  if (!user) return null;
  return { user, updates: await getUpdatesForUser(env.DB, userId, HISTORY_LIMIT) };
}
