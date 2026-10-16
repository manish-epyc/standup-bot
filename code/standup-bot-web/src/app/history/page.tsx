import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { PageBody, SiteHeader } from "@/components/dashboard/site-header";
import { dayHref } from "@/components/dashboard/week-strip";
import { getStandupDays, type StandupDay } from "@/lib/dashboard";
import { formatLongDate, formatMonth, teamDate } from "@/lib/date";
import { cn } from "@/lib/utils";

export default async function HistoryPage() {
  await connection();
  const { env } = getCloudflareContext();
  const today = teamDate(new Date(), env.TEAM_TIMEZONE);
  const days = await getStandupDays(env);
  const months = Map.groupBy(days, (d) => formatMonth(d.date));

  return (
    <>
      <SiteHeader active="history" />
      <PageBody>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">History</h1>
          <p className="text-muted-foreground">Every standup, newest first.</p>
        </div>

        {days.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
            No standups yet. They appear here after the first update is posted in Slack.
          </p>
        )}

        {[...months].map(([month, monthDays]) => (
          <section key={month} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{month}</h2>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {monthDays.map((day) => (
                <li key={day.date}>
                  <DayRow day={day} href={dayHref(day.date, today)} isToday={day.date === today} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </PageBody>
    </>
  );
}

function DayRow({ day, href, isToday }: { day: StandupDay; href: string; isToday: boolean }) {
  const total = day.missing === null ? null : day.posted + day.missing;
  return (
    <Link href={href} className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/50">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-medium">
          {formatLongDate(day.date)}
          {isToday && <span className="ml-2 text-sm font-normal text-brand">Today</span>}
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            {total !== null && (
              <span className="flex h-1.5 w-20 gap-0.5" aria-hidden>
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={cn("flex-1 rounded-full", i < day.posted ? "bg-success" : "bg-muted")} />
                ))}
              </span>
            )}
            {total !== null ? `${day.posted} of ${total} posted` : `${day.posted} posted`}
          </span>
          {day.blockers > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="size-3.5" />
              {day.blockers} blocked
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
