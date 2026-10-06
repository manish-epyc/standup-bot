import { getCloudflareContext } from "@opennextjs/cloudflare";
import { connection } from "next/server";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { UpdatesTable } from "@/components/dashboard/updates-table";
import { Badge } from "@/components/ui/badge";
import { getTodayDashboard } from "@/lib/dashboard";
import { formatTeamDate } from "@/lib/date";

export default async function Home() {
  await connection();
  const { env } = getCloudflareContext();
  const { date, summary, updates, namesById } = await getTodayDashboard(env);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Skip the Standup</h1>
          <p className="text-sm text-muted-foreground">{formatTeamDate(date)}</p>
        </div>
        <Badge variant="secondary">MVP</Badge>
      </div>
      <SummaryCard summary={summary} namesById={namesById} />
      <UpdatesTable updates={updates} timeZone={env.TEAM_TIMEZONE} />
    </main>
  );
}
