import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { UpdatesTable } from "@/components/dashboard/updates-table";
import { buttonVariants } from "@/components/ui/button";
import { getDayView } from "@/lib/dashboard";
import { formatTeamDate } from "@/lib/date";
import { cn } from "@/lib/utils";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function HistoryDatePage({ params }: { params: Promise<{ date: string }> }) {
  await connection();
  const { date } = await params;
  // The pattern also keeps the "Invalid Date" a made-up URL would produce out of the page.
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) notFound();

  const { env } = getCloudflareContext();
  const { summary, updates, namesById } = await getDayView(env, date);
  const label = formatTeamDate(date);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{label}</h1>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
        <Link href="/history" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          All history
        </Link>
      </div>
      <SummaryCard summary={summary} namesById={namesById} title="Summary" />
      <UpdatesTable updates={updates} timeZone={env.TEAM_TIMEZONE} dayLabel={`on ${label}`} />
    </main>
  );
}
