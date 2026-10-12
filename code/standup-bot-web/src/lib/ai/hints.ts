import { getChannelInfo, getChannelMemberIds, listWorkspaceUsers } from "@/lib/slack/api";
import { truncate } from "@/lib/slack/text";

// Whisper reads at most 224 prompt tokens and silently drops the rest; ~500 characters of hints plus
// the Hinglish style sample added in transcribe.ts stays under it.
const MAX_HINT_CHARS = 500;

/**
 * Spelling hints for Whisper, read live from Slack so they follow team changes without a deploy:
 * the channel topic (which the team edits to list project and client names), then channel
 * members, then the rest of the workspace (people mentioned in updates but not in the channel).
 */
export async function buildTranscriptionHints(token: string, channel: string): Promise<string> {
  try {
    const [info, memberIds, users] = await Promise.all([
      getChannelInfo(token, channel),
      getChannelMemberIds(token, channel),
      listWorkspaceUsers(token),
    ]);
    const members = new Set(memberIds);
    const names = [
      ...users.filter((u) => members.has(u.id)),
      ...users.filter((u) => !members.has(u.id)),
    ].map((u) => u.name);

    // The topic goes first so a long workspace list can't push project names past the limit.
    const topic = truncate(info.topic.trim(), MAX_HINT_CHARS / 2);
    let hints = topic ? `${topic}. Daily standup. Names:` : "Daily standup. Names:";
    for (const name of new Set(names)) {
      const next = `${hints} ${name},`;
      if (next.length > MAX_HINT_CHARS) break;
      hints = next;
    }
    return hints.replace(/[,:]$/, ".");
  } catch (error) {
    console.error("transcription hints unavailable", { error: String(error) });
    return "";
  }
}
