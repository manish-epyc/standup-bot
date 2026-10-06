import { getCloudflareContext } from "@opennextjs/cloudflare";
import { markEventProcessed } from "@/lib/db";
import { parseEnvelope, routeMessage } from "@/lib/slack/events";
import { verifySlackSignature } from "@/lib/slack/verify";
import { handleTextUpdate, handleVoiceUpdate } from "@/lib/updates";

export async function POST(request: Request) {
  const { env, ctx } = getCloudflareContext();
  const rawBody = await request.text();

  const verified = await verifySlackSignature({
    signingSecret: env.SLACK_SIGNING_SECRET,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    rawBody,
  });
  if (!verified) return new Response("invalid signature", { status: 401 });

  const envelope = parseEnvelope(rawBody);
  if (!envelope) return new Response("unsupported payload", { status: 400 });

  if (envelope.type === "url_verification") {
    return Response.json({ challenge: envelope.challenge });
  }

  // Slack retries unless it gets a 2xx within 3 seconds, so all work happens after responding.
  ctx.waitUntil(handleEvent(env, envelope.event_id, envelope.event));
  return new Response(null, { status: 200 });
}

async function handleEvent(env: CloudflareEnv, eventId: string, event: Record<string, unknown>) {
  try {
    if (!(await markEventProcessed(env.DB, eventId))) {
      console.log("duplicate slack event skipped", { eventId });
      return;
    }

    const route = routeMessage(event, env.STANDUP_CHANNEL_ID);
    switch (route.kind) {
      case "text":
        await handleTextUpdate(env, route.event, route.userId);
        break;
      case "voice":
        await handleVoiceUpdate(env, route.event, route.userId, route.file);
        break;
      case "ignore":
        console.log("slack event ignored", { eventId, reason: route.reason });
        break;
    }
  } catch (error) {
    console.error("slack event failed", { eventId, error: String(error) });
  }
}
