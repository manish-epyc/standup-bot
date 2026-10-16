import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AlertTriangle, Mic, Type } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PersonAvatar } from "@/components/dashboard/person-avatar";
import { PageBody, SiteHeader } from "@/components/dashboard/site-header";
import { dayHref } from "@/components/dashboard/week-strip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getPersonView } from "@/lib/dashboard";
import { formatLongDate, formatMonth, teamDate } from "@/lib/date";

export default async function PersonPage({ params }: PageProps<"/people/[userId]">) {
  await connection();
  const { userId } = await params;
  const { env } = getCloudflareContext();
  const person = await getPersonView(env, userId);
  if (!person) notFound();
  const { user, entries, postedDays, recentDays } = person;
  const today = teamDate(new Date(), env.TEAM_TIMEZONE);
  const months = Map.groupBy(entries, (e) => formatMonth(e.date));

  return (
    <>
      <SiteHeader active="people" />
      <PageBody>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/people" />}>People</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{user.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-4">
          <PersonAvatar id={user.id} name={user.name} size="lg" />
          <div className="flex flex-col gap-0.5">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{user.name}</h1>
            <p className="text-muted-foreground">
              {recentDays > 0 ? `Posted ${postedDays} of the last ${recentDays} standups` : "No standups yet"}
            </p>
          </div>
        </div>

        {entries.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
            No updates from {user.name} yet.
          </p>
        )}

        {[...months].map(([month, monthEntries]) => (
          <section key={month} className="flex flex-col gap-4">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{month}</h2>
            <ol className="flex flex-col gap-6 border-l-2 border-border pl-6">
              {monthEntries.map((entry) => (
                <li key={entry.date} className="relative flex flex-col gap-2">
                  <span className="absolute top-1.5 -left-7.5 size-2.5 rounded-full bg-brand ring-4 ring-background" />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={dayHref(entry.date, today)} className="font-medium hover:underline">
                      {formatLongDate(entry.date)}
                    </Link>
                    {entry.source && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {entry.source === "voice" ? <Mic className="size-3" /> : <Type className="size-3" />}
                        {entry.time}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-line text-muted-foreground">{entry.text}</p>
                  {entry.blocker && (
                    <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                      {entry.blocker}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </PageBody>
    </>
  );
}
