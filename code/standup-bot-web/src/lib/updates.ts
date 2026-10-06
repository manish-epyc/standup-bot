import { transcribe } from "@/lib/ai/transcribe";
import { teamDate } from "@/lib/date";
import { upsertUpdate } from "@/lib/db";
import { addReaction, downloadFile, getFileInfo, postMessage } from "@/lib/slack/api";
import type { SlackFile, SlackMessageEvent } from "@/lib/slack/events";
import { decodeSlackText, escapeSlackText, slackTsToDate } from "@/lib/slack/text";
import { ensureUserName } from "@/lib/users";

export async function handleTextUpdate(
  env: CloudflareEnv,
  event: SlackMessageEvent,
  userId: string,
  text: string,
): Promise<void> {
  // updates.user_id references users.id, so the user row must exist first.
  await ensureUserName(env.DB, env.SLACK_BOT_TOKEN, userId);
  await upsertUpdate(env.DB, {
    userId,
    // Date from the message itself, not processing time, so a post at 23:59 IST stays on its day.
    date: teamDate(slackTsToDate(event.ts), env.TEAM_TIMEZONE),
    source: "text",
    transcript: decodeSlackText(text),
    slackTs: event.ts,
  });
  await addReaction(env.SLACK_BOT_TOKEN, event.channel, event.ts, "white_check_mark");
}

const VOICE_FALLBACK =
  "Sorry, I couldn't transcribe that clip. Please try recording again, or type your update here in the channel.";

export async function handleVoiceUpdate(
  env: CloudflareEnv,
  event: SlackMessageEvent,
  userId: string,
  file: SlackFile,
): Promise<void> {
  const token = env.SLACK_BOT_TOKEN;
  let transcript: string;
  try {
    await ensureUserName(env.DB, token, userId);

    let url = file.url_private_download;
    let mimetype = file.mimetype;
    if (!url) {
      const info = await getFileInfo(token, file.id);
      url = info.url_private_download;
      mimetype ??= info.mimetype;
    }
    if (!url) throw new Error("file has no download URL");

    const audio = await downloadFile(token, url);
    transcript = await transcribe(env.GROQ_API_KEY, audio.data, mimetype ?? audio.contentType);

    await upsertUpdate(env.DB, {
      userId,
      date: teamDate(slackTsToDate(event.ts), env.TEAM_TIMEZONE),
      source: "voice",
      transcript,
      slackTs: event.ts,
      fileId: file.id,
    });
  } catch (error) {
    console.error("voice update failed", { ts: event.ts, fileId: file.id, error: String(error) });
    await replyInThread(token, event, VOICE_FALLBACK);
    return;
  }

  await replyInThread(token, event, `:memo: *Transcript*\n${escapeSlackText(transcript)}`);
}

async function replyInThread(token: string, event: SlackMessageEvent, text: string): Promise<void> {
  try {
    await postMessage(token, { channel: event.channel, threadTs: event.ts, text });
  } catch (error) {
    console.error("thread reply failed", { ts: event.ts, error: String(error) });
  }
}
