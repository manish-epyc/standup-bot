import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Mic, Type } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPersonHistory } from "@/lib/dashboard";
import { formatTeamDate } from "@/lib/date";
import { cn } from "@/lib/utils";

export default async function PersonPage({ params }: { params: Promise<{ userId: string }> }) {
  await connection();
  const { userId } = await params;
  const { env } = getCloudflareContext();
  const history = await getPersonHistory(env, userId);
  if (!history) notFound();
  const { user, updates } = history;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{user.name}</h1>
        <Link href="/history" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          All history
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Updates</CardTitle>
          <CardDescription>
            {updates.length === 0
              ? "No updates yet."
              : `${updates.length} ${updates.length === 1 ? "update" : "updates"}, newest first.`}
          </CardDescription>
        </CardHeader>
        {updates.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updates.map((update) => (
                  <TableRow key={update.id}>
                    <TableCell className="align-top">
                      <div className="flex flex-col items-start gap-1">
                        <Link href={`/history/${update.date}`} className="font-medium hover:underline">
                          {formatTeamDate(update.date)}
                        </Link>
                        <Badge variant={update.source === "voice" ? "default" : "secondary"}>
                          {update.source === "voice" ? <Mic /> : <Type />}
                          {update.source}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-64 align-top whitespace-normal text-muted-foreground">
                      {update.transcript}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
