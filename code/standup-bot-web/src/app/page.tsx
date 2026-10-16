import { getCloudflareContext } from "@opennextjs/cloudflare";
import { connection } from "next/server";
import { DayView } from "@/components/dashboard/day-view";
import { JobPanel } from "@/components/dashboard/job-panel";
import { PageBody, SiteHeader } from "@/components/dashboard/site-header";
import { getTodayView, noStandupReason } from "@/lib/dashboard";
import { formatTeamDate, isWeekend } from "@/lib/date";

export default async function Home() {
  await connection();
  const { env } = getCloudflareContext();
  const { today, day, showingLastFrom, standupDates, todaySummarySent } = await getTodayView(env);

  const notice = showingLastFrom
    ? `${isWeekend(today) ? "It's the weekend." : "Nobody has posted today yet — standup opens at 9:30."} Showing the last standup, ${formatTeamDate(day.date)}.`
    : null;

  return (
    <>
      <SiteHeader active="today" />
      <PageBody>
        <DayView
          day={day}
          today={today}
          standupDates={standupDates}
          notice={notice}
          emptyReason={noStandupReason(today)}
        />
        {process.env.NODE_ENV !== "production" && (
          <JobPanel summarySent={todaySummarySent} weekend={isWeekend(today)} />
        )}
      </PageBody>
    </>
  );
}
