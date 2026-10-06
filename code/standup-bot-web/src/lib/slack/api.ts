const SLACK_API = "https://slack.com/api";

export class SlackApiError extends Error {
  constructor(
    readonly method: string,
    readonly code: string,
  ) {
    super(`Slack ${method} failed: ${code}`);
    this.name = "SlackApiError";
  }
}

type SlackResponse = { ok: boolean; error?: string };

async function call<T extends SlackResponse>(
  token: string,
  method: string,
  init: { json?: Record<string, unknown>; query?: Record<string, string> },
): Promise<T> {
  const url = new URL(`${SLACK_API}/${method}`);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method: init.json ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.json && { "Content-Type": "application/json; charset=utf-8" }),
    },
    body: init.json ? JSON.stringify(init.json) : undefined,
  });

  if (!response.ok) throw new SlackApiError(method, `http_${response.status}`);
  const data = (await response.json()) as T;
  if (!data.ok) throw new SlackApiError(method, data.error ?? "unknown_error");
  return data;
}

export type PostMessageInput = {
  channel: string;
  text: string;
  threadTs?: string;
  blocks?: unknown[];
};

export async function postMessage(token: string, input: PostMessageInput): Promise<{ ts: string }> {
  const data = await call<SlackResponse & { ts: string }>(token, "chat.postMessage", {
    json: {
      channel: input.channel,
      text: input.text,
      thread_ts: input.threadTs,
      blocks: input.blocks,
      unfurl_links: false,
    },
  });
  return { ts: data.ts };
}

export async function addReaction(
  token: string,
  channel: string,
  timestamp: string,
  name: string,
): Promise<void> {
  try {
    await call(token, "reactions.add", { json: { channel, timestamp, name } });
  } catch (error) {
    if (error instanceof SlackApiError && error.code === "already_reacted") return;
    throw error;
  }
}

export type SlackUser = { id: string; name: string; isBot: boolean };

type UsersInfoResponse = SlackResponse & {
  user: {
    id: string;
    name: string;
    is_bot: boolean;
    real_name?: string;
    profile?: { display_name?: string; real_name?: string };
  };
};

export async function getUserInfo(token: string, userId: string): Promise<SlackUser> {
  const { user } = await call<UsersInfoResponse>(token, "users.info", { query: { user: userId } });
  const name =
    user.profile?.display_name || user.profile?.real_name || user.real_name || user.name;
  // Slackbot has is_bot: false but must never count as a team member.
  return { id: user.id, name, isBot: user.is_bot || user.id === "USLACKBOT" };
}

type MembersResponse = SlackResponse & {
  members: string[];
  response_metadata?: { next_cursor?: string };
};

export async function getChannelMemberIds(token: string, channel: string): Promise<string[]> {
  const members: string[] = [];
  let cursor = "";
  do {
    const data = await call<MembersResponse>(token, "conversations.members", {
      query: { channel, limit: "200", ...(cursor && { cursor }) },
    });
    members.push(...data.members);
    cursor = data.response_metadata?.next_cursor ?? "";
  } while (cursor);
  return members;
}

type FileInfoResponse = SlackResponse & {
  file: { id: string; mimetype?: string; url_private_download?: string };
};

export async function getFileInfo(token: string, fileId: string): Promise<FileInfoResponse["file"]> {
  const { file } = await call<FileInfoResponse>(token, "files.info", { query: { file: fileId } });
  return file;
}

export async function downloadFile(
  token: string,
  url: string,
): Promise<{ data: ArrayBuffer; contentType: string }> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const contentType = response.headers.get("content-type") ?? "";
  // A missing/invalid token makes Slack answer 200 with its HTML login page instead of the file.
  if (!response.ok || contentType.startsWith("text/html")) {
    throw new SlackApiError("files.download", `http_${response.status}_${contentType || "unknown"}`);
  }
  return { data: await response.arrayBuffer(), contentType };
}
