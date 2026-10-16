import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Info, Mic, Type } from "lucide-react";
import Link from "next/link";
import { PersonAvatar } from "@/components/dashboard/person-avatar";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { DayView as DayData, PersonDay } from "@/lib/dashboard";
import { formatLongDate } from "@/lib/date";
import { cn } from "@/lib/utils";

type DayViewProps = {
  day: DayData;
  today: string;
  standupDates: string[];
  notice?: string | null;
  emptyReason: string;
};

export function DayView({ day, today, standupDates, notice, emptyReason }: DayViewProps) {
  const blocked = day.people.filter((p) => p.blocker);

  return (
    <div className="flex flex-col gap-8">
      <WeekStrip selected={day.date} today={today} standupDates={standupDates} />

      {notice && (
        <p className="flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          {notice}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{formatLongDate(day.date)}</h1>
          {(day.people.length > 0 || day.date === today) && (
            <SummaryStatus sentAt={day.summarySentAt} isToday={day.date === today} />
          )}
        </div>
        {day.people.length > 0 ? <StatusBar day={day} /> : null}
      </section>

      {day.people.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
          {emptyReason}
        </p>
      ) : (
        <>
          {blocked.length > 0 && <BlockedSection people={blocked} />}
          <TeamSection people={day.people} />
          {day.aiFallback && (
            <p className="text-sm text-muted-foreground">
              The AI summary was unavailable this day, so lines show the original updates.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SummaryStatus({ sentAt, isToday }: { sentAt: string | null; isToday: boolean }) {
  if (sentAt) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-success" /> Summary sent to Slack at {sentAt}
      </span>
    );
  }
  if (!isToday) return <span className="text-sm text-muted-foreground">No summary was sent</span>;
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock className="size-4" /> Summary goes out at 10:00
    </span>
  );
}

function StatusBar({ day }: { day: DayData }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 gap-1" aria-hidden>
        {day.people.map((p) => (
          <span
            key={p.id}
            className={cn(
              "flex-1 rounded-full",
              p.blocker ? "bg-warning" : p.posted ? "bg-success" : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Legend className="bg-success" label={`${day.postedCount} of ${day.people.length} posted`} />
        {day.blockedCount > 0 && <Legend className="bg-warning" label={`${day.blockedCount} blocked`} />}
        {day.missingCount > 0 && <Legend className="bg-muted" label={`${day.missingCount} not posted`} />}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}

function BlockedSection({ people }: { people: PersonDay[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border-l-4 border-warning bg-warning/10 px-4 py-4">
      <h2 className="flex items-center gap-2 font-heading font-semibold">
        <AlertTriangle className="size-4 text-warning" /> Needs attention
      </h2>
      <ul className="flex flex-col gap-3">
        {people.map((person) => (
          <li key={person.id} className="flex items-start gap-3">
            <PersonAvatar id={person.id} name={person.name} size="sm" />
            <div className="flex flex-col gap-1 text-sm">
              <span>
                <span className="font-medium">{person.name}</span> — {person.blocker?.text}
              </span>
              {person.blocker && person.blocker.helpers.length > 0 && (
                <span className="text-muted-foreground">
                  Can help:{" "}
                  {person.blocker.helpers.map((helper, i) => (
                    <span key={helper.id}>
                      {i > 0 && ", "}
                      <Link href={`/people/${helper.id}`} className="font-medium text-foreground hover:underline">
                        {helper.name}
                      </Link>
                    </span>
                  ))}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeamSection({ people }: { people: PersonDay[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">Team</h2>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {people.map((person) => (
          <li key={person.id}>{person.posted ? <PostedRow person={person} /> : <MissingRow person={person} />}</li>
        ))}
      </ul>
    </section>
  );
}

function PostedRow({ person }: { person: PersonDay }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50">
        <PersonAvatar id={person.id} name={person.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{person.name}</span>
            {person.source && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {person.source === "voice" ? <Mic className="size-3" /> : <Type className="size-3" />}
                {person.time}
              </span>
            )}
            {person.blocker && (
              <Badge variant="outline" className="border-warning text-warning">
                Blocked
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{person.line}</p>
        </div>
        <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 px-4 pb-4 pl-15 text-sm">
          {person.transcript ? (
            <p className="whitespace-pre-line">{person.transcript}</p>
          ) : (
            <p className="text-muted-foreground">Only the summary line was kept for this day.</p>
          )}
          <Link href={`/people/${person.id}`} className="w-fit font-medium text-brand hover:underline">
            See all of {person.name}&apos;s updates
          </Link>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MissingRow({ person }: { person: PersonDay }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <PersonAvatar id={person.id} name={person.name} muted />
      <span className="text-muted-foreground">{person.name}</span>
      <span className="ml-auto text-xs text-muted-foreground">Not posted</span>
    </div>
  );
}
