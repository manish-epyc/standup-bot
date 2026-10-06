import { getCloudflareContext } from "@opennextjs/cloudflare";
import { summarize } from "@/lib/ai/summarize";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isWeekend, teamDate } from "@/lib/date";
import {
  claimSummary,
  getSummary,
  getUpdatesForDate,
  releaseSummaryClaim,
  setSummarySlackTs,
} from "@/lib/db";
import { postMessage } from "@/lib/slack/api";
import { buildSummaryMessage } from "@/lib/slack/blocks";
import { getHumanChannelMembers } from "@/lib/users";

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  const date = teamDate(new Date(), env.TEAM_TIMEZONE);
  if (isWeekend(date)) return Response.json({ date, skipped: "weekend" });
  if (!env.STANDUP_CHANNEL_ID) return new Response("STANDUP_CHANNEL_ID is not set", { status: 500 });
  if (await getSummary(env.DB, date)) return Response.json({ date, skipped: "already_posted" });

  const updates = await getUpdatesForDate(env.DB, date);
  const posted = new Set(updates.map((u) => u.user_id));
  let missingIds: string[] = [];
  try {
    const members = await getHumanChannelMembers(env.DB, env.SLACK_BOT_TOKEN, env.STANDUP_CHANNEL_ID);
    missingIds = members.filter((id) => !posted.has(id));
  } catch (error) {
    // The summary is still useful without the "Not submitted" list.
    console.error("channel member lookup failed", { error: String(error) });
  }

  const summary = await summarize(
    env.GROQ_API_KEY,
    updates.map((u) => ({ userId: u.user_id, name: u.user_name, transcript: u.transcript })),
  );

  if (!(await claimSummary(env.DB, date, JSON.stringify({ ...summary, missing: missingIds })))) {
    return Response.json({ date, skipped: "already_posted" });
  }

  const namesById = new Map(updates.map((u) => [u.user_id, u.user_name]));
  const message = buildSummaryMessage(date, summary, namesById, missingIds);
  try {
    const { ts } = await postMessage(env.SLACK_BOT_TOKEN, { channel: env.STANDUP_CHANNEL_ID, ...message });
    await setSummarySlackTs(env.DB, date, ts);
    return Response.json({ date, posted: true, ts, updates: updates.length, missing: missingIds.length });
  } catch (error) {
    await releaseSummaryClaim(env.DB, date);
    throw error;
  }
}
