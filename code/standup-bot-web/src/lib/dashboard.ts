import { getSummaryBlockers } from "@/lib/blockers";
import { formatTeamDate, isWeekend, teamDate } from "@/lib/date";
import {
  getBlockersForUser,
  getOpenBlockerCountsSince,
  getPostedSummariesSince,
  getStandupDates,
  getSummary,
  getUpdateAuthorsSince,
  getUpdatesForDate,
  getUpdatesForUser,
  getUser,
  getUsers,
  type Summary,
  type UpdateSource,
  type User,
} from "@/lib/db";
import { slackTsToDate } from "@/lib/slack/text";

export type StoredSummary = {
  people: { user_id: string; line: string }[];
  // Summaries stored before helpers were tracked have no helper_ids.
  blockers: { user_id: string; text: string; helper_ids?: string[] }[];
  missing: string[];
  fallback: boolean;
  postedAt: string;
};

export type Member = { id: string; name: string };

export type PersonDay = Member & {
  posted: boolean;
  source: UpdateSource | null;
  time: string | null;
  line: string | null;
  transcript: string | null;
  blocker: { text: string; helpers: Member[] } | null;
};

export type DayView = {
  date: string;
  label: string;
  summarySentAt: string | null;
  aiFallback: boolean;
  people: PersonDay[];
  postedCount: number;
  blockedCount: number;
  missingCount: number;
};

export type StandupDay = {
  date: string;
  posted: number;
  missing: number | null;
  blockers: number;
};

const HISTORY_DAYS = 120;
const PARTICIPATION_DAYS = 20;

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

function postedSummary(row: Summary | null): StoredSummary | null {
  return row?.slack_ts ? parseStoredSummary(row.summary_json, row.posted_at) : null;
}

/** D1's datetime('now') is UTC without a zone marker. */
function sqliteUtc(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

function timeFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getDayView(env: CloudflareEnv, date: string): Promise<DayView> {
  const [summaryRow, updates, users, tableBlockers] = await Promise.all([
    getSummary(env.DB, date),
    getUpdatesForDate(env.DB, date),
    getUsers(env.DB),
    getSummaryBlockers(env.DB, date),
  ]);
  const summary = postedSummary(summaryRow);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const member = (id: string): Member => ({ id, name: names.get(id) ?? "Unknown" });
  const formatTime = timeFormatter(env.TEAM_TIMEZONE);

  // Update rows can be missing for a day whose summary survived, so the summary fills the gaps.
  const lines = new Map((summary?.people ?? []).map((p) => [p.user_id, p.line]));
  const updatesByUser = new Map(updates.map((u) => [u.user_id, u]));
  const blockers = tableBlockers.length ? tableBlockers : (summary?.blockers ?? []);
  const blockerByUser = new Map(blockers.map((b) => [b.user_id, b]));

  const posted = new Set([...updatesByUser.keys(), ...lines.keys()]);
  // With no summary the day is still open (or never happened), so "not posted" is everyone else, if anyone posted at all.
  const expected = summary
    ? [...posted, ...summary.missing]
    : posted.size === 0
      ? []
      : [...posted, ...users.filter((u) => u.is_active && !posted.has(u.id)).map((u) => u.id)];

  const people = [...new Set(expected)].map((id): PersonDay => {
    const update = updatesByUser.get(id);
    const blocker = blockerByUser.get(id);
    return {
      ...member(id),
      posted: posted.has(id),
      source: update?.source ?? null,
      time: update ? formatTime.format(slackTsToDate(update.slack_ts)) : null,
      line: lines.get(id) ?? update?.transcript ?? null,
      transcript: update?.transcript ?? null,
      blocker: blocker ? { text: blocker.text, helpers: (blocker.helper_ids ?? []).map(member) } : null,
    };
  });
  // Blocked first, then everyone who posted, then who didn't.
  const rank = (p: PersonDay) => (p.blocker ? 0 : p.posted ? 1 : 2);
  people.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  return {
    date,
    label: formatTeamDate(date),
    summarySentAt: summary ? formatTime.format(sqliteUtc(summary.postedAt)) : null,
    aiFallback: summary?.fallback ?? false,
    people,
    postedCount: posted.size,
    blockedCount: people.filter((p) => p.blocker).length,
    missingCount: people.filter((p) => !p.posted).length,
  };
}

/** Every standup day (updates or a posted summary), newest first, with its counts. */
export async function getStandupDays(env: CloudflareEnv): Promise<StandupDay[]> {
  const dates = await getStandupDates(env.DB, HISTORY_DAYS);
  if (dates.length === 0) return [];
  const since = dates.at(-1)!.date;
  const [summaries, authors, blockerCounts] = await Promise.all([
    getPostedSummariesSince(env.DB, since),
    getUpdateAuthorsSince(env.DB, since),
    getOpenBlockerCountsSince(env.DB, since),
  ]);
  const summaryByDate = new Map(summaries.map((s) => [s.date, postedSummary(s)]));
  const blockersByDate = new Map(blockerCounts.map((b) => [b.date, b.count]));
  const authorsByDate = Map.groupBy(authors, (a) => a.date);

  return dates.map(({ date }) => {
    const summary = summaryByDate.get(date) ?? null;
    const ids = new Set([
      ...(authorsByDate.get(date) ?? []).map((a) => a.user_id),
      ...(summary?.people ?? []).map((p) => p.user_id),
    ]);
    return {
      date,
      posted: ids.size,
      missing: summary ? summary.missing.length : null,
      blockers: blockersByDate.get(date) ?? summary?.blockers.length ?? 0,
    };
  });
}

export type TodayView = {
  today: string;
  day: DayView;
  /** Set when today has nothing yet and `day` is the last standup instead. */
  showingLastFrom: string | null;
  standupDates: string[];
};

export async function getTodayView(env: CloudflareEnv): Promise<TodayView> {
  const today = teamDate(new Date(), env.TEAM_TIMEZONE);
  const dates = (await getStandupDates(env.DB, HISTORY_DAYS)).map((d) => d.date);
  const lastBefore = dates.find((d) => d < today);
  const showLast = !dates.includes(today) && lastBefore !== undefined;
  return {
    today,
    day: await getDayView(env, showLast ? lastBefore : today),
    showingLastFrom: showLast ? today : null,
    standupDates: dates,
  };
}

export function noStandupReason(date: string): string {
  return isWeekend(date) ? "It's the weekend — no standup." : "Nobody has posted yet. Standup opens at 9:30.";
}

export async function getStandupDateList(env: CloudflareEnv): Promise<string[]> {
  return (await getStandupDates(env.DB, HISTORY_DAYS)).map((d) => d.date);
}

export type PersonSummary = Member & { postedDays: number; recentDays: number; lastPosted: string | null };

export async function getPeople(env: CloudflareEnv): Promise<PersonSummary[]> {
  const [users, days] = await Promise.all([getUsers(env.DB), getStandupDays(env)]);
  const recent = days.slice(0, PARTICIPATION_DAYS);
  const since = recent.at(-1)?.date ?? teamDate(new Date(), env.TEAM_TIMEZONE);
  const [summaries, authors] = await Promise.all([
    getPostedSummariesSince(env.DB, since),
    getUpdateAuthorsSince(env.DB, since),
  ]);
  const postedBy = new Map<string, Set<string>>();
  const add = (userId: string, date: string) => postedBy.set(userId, (postedBy.get(userId) ?? new Set()).add(date));
  authors.forEach((a) => add(a.user_id, a.date));
  summaries.forEach((s) => postedSummary(s)?.people.forEach((p) => add(p.user_id, s.date)));

  return users
    .filter((u) => u.is_active)
    .map((u) => {
      const dates = [...(postedBy.get(u.id) ?? [])].sort();
      return { id: u.id, name: u.name, postedDays: dates.length, recentDays: recent.length, lastPosted: dates.at(-1) ?? null };
    });
}

export type TimelineEntry = {
  date: string;
  source: UpdateSource | null;
  time: string | null;
  text: string;
  blocker: string | null;
};

export type PersonView = {
  user: User;
  entries: TimelineEntry[];
  postedDays: number;
  recentDays: number;
};

export async function getPersonView(env: CloudflareEnv, userId: string): Promise<PersonView | null> {
  const user = await getUser(env.DB, userId);
  if (!user) return null;
  const days = await getStandupDays(env);
  const since = days.at(-1)?.date ?? shiftDate(teamDate(new Date(), env.TEAM_TIMEZONE), -HISTORY_DAYS);
  const [updates, summaries, blockers] = await Promise.all([
    getUpdatesForUser(env.DB, userId, HISTORY_DAYS),
    getPostedSummariesSince(env.DB, since),
    getBlockersForUser(env.DB, userId, HISTORY_DAYS),
  ]);
  const formatTime = timeFormatter(env.TEAM_TIMEZONE);
  const blockerByDate = new Map(blockers.map((b) => [b.date, b.text]));

  const entries = new Map<string, TimelineEntry>();
  for (const s of summaries) {
    const summary = postedSummary(s);
    const line = summary?.people.find((p) => p.user_id === userId)?.line;
    if (!line) continue;
    const blocker = summary?.blockers.find((b) => b.user_id === userId)?.text ?? null;
    entries.set(s.date, { date: s.date, source: null, time: null, text: line, blocker });
  }
  for (const u of updates) {
    entries.set(u.date, {
      date: u.date,
      source: u.source,
      time: formatTime.format(slackTsToDate(u.slack_ts)),
      text: u.transcript,
      blocker: blockerByDate.get(u.date) ?? entries.get(u.date)?.blocker ?? null,
    });
  }

  const recent = new Set(days.slice(0, PARTICIPATION_DAYS).map((d) => d.date));
  const sorted = [...entries.values()].sort((a, b) => b.date.localeCompare(a.date));
  return {
    user,
    entries: sorted,
    postedDays: sorted.filter((e) => recent.has(e.date)).length,
    recentDays: recent.size,
  };
}
