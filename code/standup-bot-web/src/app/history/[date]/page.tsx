import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { DayView } from "@/components/dashboard/day-view";
import { PageBody, SiteHeader } from "@/components/dashboard/site-header";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getDayView, getStandupDateList } from "@/lib/dashboard";
import { formatTeamDate, isWeekend, teamDate } from "@/lib/date";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function HistoryDatePage({ params }: PageProps<"/history/[date]">) {
  await connection();
  const { date } = await params;
  // The pattern also keeps the "Invalid Date" a made-up URL would produce out of the page.
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) notFound();

  const { env } = getCloudflareContext();
  const today = teamDate(new Date(), env.TEAM_TIMEZONE);
  if (date === today) redirect("/");
  if (date > today) notFound();

  const [day, standupDates] = await Promise.all([getDayView(env, date), getStandupDateList(env)]);

  return (
    <>
      <SiteHeader active="history" />
      <PageBody>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/history" />}>History</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{formatTeamDate(date)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <DayView
          day={day}
          today={today}
          standupDates={standupDates}
          emptyReason={isWeekend(date) ? "Weekend — no standup." : "No standup was recorded this day."}
        />
      </PageBody>
    </>
  );
}
