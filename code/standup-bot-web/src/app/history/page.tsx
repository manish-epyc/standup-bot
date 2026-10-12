import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { connection } from "next/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getHistoryIndex } from "@/lib/dashboard";
import { formatTeamDate } from "@/lib/date";
import { cn } from "@/lib/utils";

export default async function HistoryPage() {
  await connection();
  const { env } = getCloudflareContext();
  const { dates, users } = await getHistoryIndex(env);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">History</h1>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Today
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By date</CardTitle>
          <CardDescription>The most recent days with updates.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {dates.length === 0 && <p className="text-sm text-muted-foreground">No updates yet.</p>}
          {dates.map(({ date, count }) => (
            <Link
              key={date}
              href={`/history/${date}`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              {formatTeamDate(date)} · {count}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By person</CardTitle>
          <CardDescription>Everything one person has posted.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {users.length === 0 && <p className="text-sm text-muted-foreground">Nobody yet.</p>}
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/people/${user.id}`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              {user.name}
            </Link>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
