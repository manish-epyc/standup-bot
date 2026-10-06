export function decodeSlackText(text: string): string {
  // Slack escapes only these three; &amp; must be decoded last so "&amp;lt;" stays "&lt;".
  return text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

/** Escape user/LLM text before posting, so it can't form <!channel> pings or fake <@mentions>. */
export function escapeSlackText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function slackTsToDate(ts: string): Date {
  return new Date(Number(ts) * 1000);
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
