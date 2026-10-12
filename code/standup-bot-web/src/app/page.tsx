import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { connection } from "next/server";
import { HoursSavedCard } from "@/components/dashboard/hours-saved-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { UpdatesTable } from "@/components/dashboard/updates-table";
import { buttonVariants } from "@/components/ui/button";
import { getTodayDashboard } from "@/lib/dashboard";
import { formatMonth, formatTeamDate } from "@/lib/date";
import { cn } from "@/lib/utils";

export default async function Home() {
  await connection();
  const { env } = getCloudflareContext();
  const { date, summary, updates, namesById, hoursSaved } = await getTodayDashboard(env);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Skip the Standup</h1>
          <p className="text-sm text-muted-foreground">{formatTeamDate(date)}</p>
        </div>
        <Link href="/history" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          History
        </Link>
      </div>
      <SummaryCard summary={summary} namesById={namesById} />
      <HoursSavedCard hoursSaved={hoursSaved} monthLabel={formatMonth(date)} />
      <UpdatesTable updates={updates} timeZone={env.TEAM_TIMEZONE} />
    </main>
  );
}
