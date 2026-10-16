"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { refresh } from "next/cache";
import { JOBS, type JobName, type JobResult } from "@/lib/jobs";

export type JobOutcome = { ok: boolean; message: string };

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function describe(job: JobName, result: JobResult): string {
  if (result.skipped === "weekend") return "Skipped: it's the weekend.";
  if (result.skipped === "already_posted") return "Today's summary was already posted.";
  if (result.skipped === "summary_posted") return "Today's summary is already out, so no nudges were sent.";
  switch (job) {
    case "reminder":
      return "Reminder posted in the standup channel.";
    case "nudge": {
      const { missing, sent, failed } = result as JobResult & { missing: number; sent: number; failed: number };
      if (missing === 0) return "Everyone has posted, so no nudges were needed.";
      const already = missing - sent - failed;
      return [
        `Sent ${plural(sent, "nudge")}`,
        already > 0 && `${already} already nudged today`,
        failed > 0 && `${failed} failed`,
      ]
        .filter(Boolean)
        .join(", ")
        .concat(".");
    }
    case "summary": {
      const { updates, missing } = result as JobResult & { updates: number; missing: number };
      return `Summary posted: ${plural(updates, "update")}, ${missing} not posted.`;
    }
  }
}

/** Local-only stand-in for the cron triggers until the app is deployed. */
export async function runJobNow(job: JobName): Promise<JobOutcome> {
  // The dashboard has no login yet, so in production this would let anyone post to Slack.
  if (process.env.NODE_ENV === "production") return { ok: false, message: "Only available when running locally." };
  if (!Object.hasOwn(JOBS, job)) return { ok: false, message: "Unknown job." };

  const { env } = getCloudflareContext();
  try {
    const result = await JOBS[job](env);
    refresh();
    return { ok: true, message: describe(job, result) };
  } catch (error) {
    console.error("manual job failed", { job, error: String(error) });
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
