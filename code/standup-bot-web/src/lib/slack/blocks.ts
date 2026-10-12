import type { DailySummary } from "@/lib/ai/summarize";
import type { SummaryBlocker } from "@/lib/blockers";
import { formatTeamDate } from "@/lib/date";
import { escapeSlackText } from "@/lib/slack/text";

type Block = Record<string, unknown>;

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// Slack rejects section text over 3000 characters.
const MAX_SECTION = 2900;

function sections(title: string, lines: string[]): Block[] {
  const chunks: string[] = [];
  let current = `*${title}*`;
  for (const line of lines) {
    if (current.length + line.length + 1 > MAX_SECTION) {
      chunks.push(current);
      current = "";
    }
    current += `${current ? "\n" : ""}${line}`;
  }
  chunks.push(current);
  return chunks.map((text) => ({ type: "section", text: { type: "mrkdwn", text } }));
}

export function buildSummaryMessage(
  date: string,
  summary: DailySummary,
  blockers: SummaryBlocker[],
  namesById: Map<string, string>,
  missingIds: string[],
): { text: string; blocks: Block[] } {
  const title = `Standup summary · ${formatTeamDate(date)}`;
  // Names, not mentions, so the whole team isn't pinged every morning.
  const updateLines = summary.people.map(
    (p) => `• *${escapeSlackText(namesById.get(p.user_id) ?? "Someone")}* — ${escapeSlackText(p.line)}`,
  );
  const blockerLines = blockers.map((b) => {
    const helpers = b.helper_ids.length ? ` _(can help: ${b.helper_ids.map((id) => `<@${id}>`).join(", ")})_` : "";
    return `• <@${b.user_id}> — ${escapeSlackText(b.text)}${helpers}`;
  });

  const blocks: Block[] = [
    { type: "header", text: { type: "plain_text", text: title } },
    ...sections("Updates", updateLines.length ? updateLines : ["No updates today."]),
    { type: "divider" },
    ...sections("Blockers", blockerLines.length ? blockerLines : ["No blockers reported."]),
    { type: "divider" },
    ...sections("Not submitted", [
      missingIds.length ? missingIds.map((id) => `<@${id}>`).join(", ") : "Everyone posted :tada:",
    ]),
  ];
  if (summary.fallback) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "AI summary unavailable — showing the original updates." }],
    });
  }

  const text = `${title}: ${plural(summary.people.length, "update")}, ${plural(blockers.length, "blocker")}, ${missingIds.length} not submitted`;
  return { text, blocks };
}
