"use client";

import { BellRing, CheckCircle2, Loader2, Megaphone, ScrollText, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { type JobOutcome, runJobNow } from "@/app/actions/jobs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { JobName } from "@/lib/jobs";
import { cn } from "@/lib/utils";

type Step = {
  job: JobName;
  time: string;
  label: string;
  explains: string;
  icon: typeof Megaphone;
};

const STEPS: Step[] = [
  {
    job: "reminder",
    time: "9:30",
    label: "Ask the team to post",
    explains: "Posts \"Standup time!\" in the standup channel so everyone records their update.",
    icon: Megaphone,
  },
  {
    job: "nudge",
    time: "9:50",
    label: "Remind people who haven't posted",
    explains: "Sends a private Slack message to each person who hasn't posted today. Once per person per day.",
    icon: BellRing,
  },
  {
    job: "summary",
    time: "10:00",
    label: "Post today's summary",
    explains: "Writes the AI summary of today's updates and posts it in the channel. Once per day.",
    icon: ScrollText,
  },
];

type JobPanelProps = { summarySent: boolean; weekend: boolean };

function blockedReason(job: JobName, { summarySent, weekend }: JobPanelProps): string | null {
  if (weekend) return "Doesn't run on weekends.";
  if (job === "nudge" && summarySent) return "Today's summary is already out, so it's too late to remind people.";
  if (job === "summary" && summarySent) return "Already posted today.";
  return null;
}

export function JobPanel(props: JobPanelProps) {
  const [confirming, setConfirming] = useState<Step | null>(null);
  const [running, setRunning] = useState<JobName | null>(null);
  const [outcomes, setOutcomes] = useState<Partial<Record<JobName, JobOutcome>>>({});
  const [isPending, startTransition] = useTransition();

  function run(step: Step) {
    setConfirming(null);
    setRunning(step.job);
    startTransition(async () => {
      const outcome = await runJobNow(step.job);
      setOutcomes((current) => ({ ...current, [step.job]: outcome }));
      setRunning(null);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-dashed border-border px-4 py-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading font-semibold">Run the morning steps by hand</h2>
        <p className="text-sm text-muted-foreground">
          Only while testing locally. Once the app is on Cloudflare these run by themselves at the times shown. Each
          one posts to the real Slack channel, so run them in order.
        </p>
      </div>

      <ol className="flex flex-col divide-y divide-border">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const outcome = outcomes[step.job];
          const reason = blockedReason(step.job, props);
          return (
            <li key={step.job} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {step.label} <span className="font-normal text-muted-foreground">· normally {step.time}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{step.explains}</span>
                  {reason && !outcome && <span className="text-sm text-muted-foreground italic">{reason}</span>}
                  {outcome && (
                    <span
                      className={cn(
                        "flex items-start gap-1.5 text-sm",
                        outcome.ok ? "text-foreground" : "text-destructive",
                      )}
                    >
                      {outcome.ok ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0" />
                      )}
                      {outcome.message}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                className="shrink-0 sm:ml-4"
                disabled={isPending || reason !== null}
                onClick={() => setConfirming(step)}
              >
                {running === step.job ? <Loader2 className="animate-spin" /> : <Icon />}
                Run now
              </Button>
            </li>
          );
        })}
      </ol>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming?.label}?</AlertDialogTitle>
            <AlertDialogDescription>{confirming?.explains}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirming && run(confirming)}>Yes, run it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
