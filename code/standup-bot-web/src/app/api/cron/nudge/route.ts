import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isWeekend, teamDate } from "@/lib/date";
import { claimNudge, getSummary, getUpdatesForDate, releaseNudgeClaim } from "@/lib/db";
import { postMessage } from "@/lib/slack/api";
import { getHumanChannelMembers } from "@/lib/users";

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  const date = teamDate(new Date(), env.TEAM_TIMEZONE);
  if (isWeekend(date)) return Response.json({ date, skipped: "weekend" });
  if (!env.STANDUP_CHANNEL_ID) return new Response("STANDUP_CHANNEL_ID is not set", { status: 500 });
  if (await getSummary(env.DB, date)) return Response.json({ date, skipped: "summary_posted" });

  const updates = await getUpdatesForDate(env.DB, date);
  const posted = new Set(updates.map((u) => u.user_id));
  const members = await getHumanChannelMembers(env.DB, env.SLACK_BOT_TOKEN, env.STANDUP_CHANNEL_ID);
  const missing = members.filter((id) => !posted.has(id));

  const text = [
    ":wave: Quick nudge: I haven't seen your standup update yet today.",
    `Post a short voice clip or a text update in <#${env.STANDUP_CHANNEL_ID}> before the summary goes out.`,
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

  return Response.json({ date, missing: missing.length, sent, failed });
}
