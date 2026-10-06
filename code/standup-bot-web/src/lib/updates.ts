import type { SlackFile, SlackMessageEvent } from "@/lib/slack/events";

export async function handleTextUpdate(
  _env: CloudflareEnv,
  event: SlackMessageEvent,
  userId: string,
): Promise<void> {
  console.log("text update received (handler pending #5)", { userId, ts: event.ts });
}

export async function handleVoiceUpdate(
  _env: CloudflareEnv,
  event: SlackMessageEvent,
  userId: string,
  file: SlackFile,
): Promise<void> {
  console.log("voice update received (handler pending #6)", {
    userId,
    ts: event.ts,
    fileId: file.id,
    mimetype: file.mimetype,
  });
}
