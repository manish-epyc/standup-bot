export type SlackFile = {
  id: string;
  mimetype?: string;
  url_private_download?: string;
  name?: string;
};

export type SlackMessageEvent = {
  type: "message";
  subtype?: string;
  channel: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  files?: SlackFile[];
};

export type SlackEnvelope =
  | { type: "url_verification"; challenge: string }
  | { type: "event_callback"; event_id: string; event: Record<string, unknown> };

export type MessageRoute =
  | { kind: "voice"; event: SlackMessageEvent; userId: string; file: SlackFile }
  | { kind: "text"; event: SlackMessageEvent; userId: string; text: string }
  | { kind: "ignore"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseEnvelope(rawBody: string): SlackEnvelope | null {
  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  if (data.type === "url_verification" && typeof data.challenge === "string") {
    return { type: "url_verification", challenge: data.challenge };
  }
  if (data.type === "event_callback" && typeof data.event_id === "string" && isRecord(data.event)) {
    return { type: "event_callback", event_id: data.event_id, event: data.event };
  }
  return null;
}

function isMessageEvent(event: Record<string, unknown>): event is SlackMessageEvent {
  return event.type === "message" && typeof event.channel === "string" && typeof event.ts === "string";
}

function isMediaFile(file: SlackFile): boolean {
  return Boolean(file.mimetype?.startsWith("audio/") || file.mimetype?.startsWith("video/"));
}

const HANDLED_SUBTYPES = new Set([undefined, "file_share"]);

export function routeMessage(event: Record<string, unknown>, standupChannelId: string): MessageRoute {
  if (!isMessageEvent(event)) return { kind: "ignore", reason: "not_a_message" };
  if (!standupChannelId || event.channel !== standupChannelId) {
    return { kind: "ignore", reason: "other_channel" };
  }
  if (event.bot_id || event.subtype === "bot_message") return { kind: "ignore", reason: "bot" };
  if (!HANDLED_SUBTYPES.has(event.subtype)) return { kind: "ignore", reason: `subtype_${event.subtype}` };
  if (event.thread_ts && event.thread_ts !== event.ts) return { kind: "ignore", reason: "thread_reply" };
  if (!event.user) return { kind: "ignore", reason: "no_user" };

  const media = Array.isArray(event.files) ? event.files.find(isMediaFile) : undefined;
  if (media) return { kind: "voice", event, userId: event.user, file: media };

  const text = event.text?.trim();
  if (text) return { kind: "text", event, userId: event.user, text };

  return { kind: "ignore", reason: "empty" };
}
