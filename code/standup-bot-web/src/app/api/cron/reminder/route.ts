import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isWeekend, teamDate } from "@/lib/date";
import { postMessage } from "@/lib/slack/api";

const REMINDER = [
  ":wave: *Standup time!* Post a short voice clip (or type) here before the summary:",
  "• What did you do yesterday?",
  "• What will you do today?",
  "• Any blockers? Mention who could help.",
].join("\n");

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  const date = teamDate(new Date(), env.TEAM_TIMEZONE);
  if (isWeekend(date)) return Response.json({ date, skipped: "weekend" });
  if (!env.STANDUP_CHANNEL_ID) return new Response("STANDUP_CHANNEL_ID is not set", { status: 500 });

  const { ts } = await postMessage(env.SLACK_BOT_TOKEN, { channel: env.STANDUP_CHANNEL_ID, text: REMINDER });
  return Response.json({ date, posted: true, ts });
}
