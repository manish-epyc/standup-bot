import { summarize } from "@/lib/ai/summarize";
import { getSummaryBlockers } from "@/lib/blockers";
import { isWeekend, teamDate } from "@/lib/date";
import {
  claimNudge,
  claimSummary,
  getSummary,
  getUpdatesForDate,
  releaseNudgeClaim,
  releaseSummaryClaim,
  setSummarySlackTs,
} from "@/lib/db";
import { postMessage } from "@/lib/slack/api";
import { buildSummaryMessage } from "@/lib/slack/blocks";
import { getHumanChannelMembers } from "@/lib/users";

export type JobName = "reminder" | "nudge" | "summary";

export type JobResult = { date: string } & Record<string, unknown>;

export class JobConfigError extends Error {}

const REMINDER = [
  ":wave: *Standup time!* Post a short voice clip (or type) here before the summary:",
  "• What did you do yesterday?",
  "• What will you do today?",
  "• Any blockers? Mention who could help.",
].join("\n");

function requireChannel(env: CloudflareEnv): string {
  if (!env.STANDUP_CHANNEL_ID) throw new JobConfigError("STANDUP_CHANNEL_ID is not set");
  return env.STANDUP_CHANNEL_ID;
}

export async function runReminder(env: CloudflareEnv): Promise<JobResult> {
  const date = teamDate(new Date(), env.TEAM_TIMEZONE);
  if (isWeekend(date)) return { date, skipped: "weekend" };
  const channel = requireChannel(env);

  const { ts } = await postMessage(env.SLACK_BOT_TOKEN, { channel, text: REMINDER });
  return { date, posted: true, ts };
}

export async function runNudge(env: CloudflareEnv): Promise<JobResult> {
  const date = teamDate(new Date(), env.TEAM_TIMEZONE);
  if (isWeekend(date)) return { date, skipped: "weekend" };
  const channel = requireChannel(env);
  if (await getSummary(env.DB, date)) return { date, skipped: "summary_posted" };

  const updates = await getUpdatesForDate(env.DB, date);
  const posted = new Set(updates.map((u) => u.user_id));
  const members = await getHumanChannelMembers(env.DB, env.SLACK_BOT_TOKEN, channel);
  const missing = members.filter((id) => !posted.has(id));

  const text = [
    ":wave: Quick nudge: I haven't seen your standup update yet today.",
    `Post a short voice clip or a text update in <#${channel}> before the summary goes out.`,
  ].join("\n");

  let sent = 0;
  let failed = 0;
  for (const userId of missing) {
    if (!(await claimNudge(env.DB, date, userId))) continue;
    try {
      // A user ID as the channel delivers to the user's DM with the app; chat:write is enough.
      await postMessage(env.SLACK_BOT_TOKEN, { channel: userId, text });
      sent++;
    } catch (error) {
      await releaseNudgeClaim(env.DB, date, userId);
      console.error("nudge failed", { userId, error: String(error) });
      failed++;
    }
  }

  return { date, missing: missing.length, sent, failed };
}

export async function runSummary(env: CloudflareEnv): Promise<JobResult> {
  const date = teamDate(new Date(), env.TEAM_TIMEZONE);
  if (isWeekend(date)) return { date, skipped: "weekend" };
  const channel = requireChannel(env);
  if (await getSummary(env.DB, date)) return { date, skipped: "already_posted" };

  const updates = await getUpdatesForDate(env.DB, date);
  const posted = new Set(updates.map((u) => u.user_id));
  let missingIds: string[] = [];
  try {
    const members = await getHumanChannelMembers(env.DB, env.SLACK_BOT_TOKEN, channel);
    missingIds = members.filter((id) => !posted.has(id));
  } catch (error) {
    // The summary is still useful without the "Not submitted" list.
    console.error("channel member lookup failed", { error: String(error) });
  }

  const summary = await summarize(
    env.GROQ_API_KEY,
    updates.map((u) => ({ userId: u.user_id, name: u.user_name, transcript: u.transcript })),
  );

  const blockers = await getSummaryBlockers(env.DB, date);

  if (!(await claimSummary(env.DB, date, JSON.stringify({ ...summary, blockers, missing: missingIds })))) {
    return { date, skipped: "already_posted" };
  }

  const namesById = new Map(updates.map((u) => [u.user_id, u.user_name]));
  const message = buildSummaryMessage(date, summary, blockers, namesById, missingIds);
  try {
    const { ts } = await postMessage(env.SLACK_BOT_TOKEN, { channel, ...message });
    await setSummarySlackTs(env.DB, date, ts);
    return { date, posted: true, ts, updates: updates.length, missing: missingIds.length };
  } catch (error) {
    await releaseSummaryClaim(env.DB, date);
    throw error;
  }
}

export const JOBS: Record<JobName, (env: CloudflareEnv) => Promise<JobResult>> = {
  reminder: runReminder,
  nudge: runNudge,
  summary: runSummary,
};

/** Shared body of the cron routes: the scheduled worker calls them with CRON_SECRET. */
export async function jobResponse(env: CloudflareEnv, job: JobName): Promise<Response> {
  try {
    return Response.json(await JOBS[job](env));
  } catch (error) {
    if (error instanceof JobConfigError) return new Response(error.message, { status: 500 });
    throw error;
  }
}
