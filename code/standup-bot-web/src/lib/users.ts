import { getUser, upsertUser } from "@/lib/db";
import { getChannelMemberIds, getUserInfo } from "@/lib/slack/api";

export async function ensureUserName(db: D1Database, token: string, userId: string): Promise<string> {
  const cached = await getUser(db, userId);
  if (cached) return cached.name;

  const user = await getUserInfo(token, userId);
  if (!user.isBot) await upsertUser(db, user.id, user.name);
  return user.name;
}

export async function getHumanChannelMembers(
  db: D1Database,
  token: string,
  channel: string,
): Promise<string[]> {
  const memberIds = await getChannelMemberIds(token, channel);
  const humans: string[] = [];
  for (const id of memberIds) {
    // Only humans are cached in `users`, so a cache hit means "not a bot".
    if (await getUser(db, id)) {
      humans.push(id);
      continue;
    }
    const user = await getUserInfo(token, id);
    if (user.isBot) continue;
    await upsertUser(db, user.id, user.name);
    humans.push(id);
  }
  return humans;
}
