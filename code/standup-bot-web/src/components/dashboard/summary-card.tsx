import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { StoredSummary } from "@/lib/dashboard";

type SummaryCardProps = {
  summary: StoredSummary | null;
  namesById: Map<string, string>;
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function SummaryCard({ summary, namesById }: SummaryCardProps) {
  const nameOf = (id: string) => namesById.get(id) ?? id;

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s summary</CardTitle>
          <CardDescription>The summary is posted to Slack at 10:00 IST on weekdays.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">No summary yet.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s summary</CardTitle>
        <CardDescription>
          {plural(summary.people.length, "update")} · {plural(summary.blockers.length, "blocker")} ·{" "}
          {summary.missing.length} not submitted
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {summary.fallback && (
          <Badge variant="outline">AI summary unavailable — showing original updates</Badge>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Updates</h2>
          {summary.people.length === 0 ? (
            <p className="text-muted-foreground">No updates.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.people.map((person) => (
                <li key={person.user_id}>
                  <span className="font-medium">{nameOf(person.user_id)}</span>
                  <span className="text-muted-foreground"> — {person.line}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator />

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Blockers</h2>
          {summary.blockers.length === 0 ? (
            <p className="text-muted-foreground">No blockers reported.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.blockers.map((blocker, index) => (
                <li key={`${blocker.user_id}-${index}`} className="flex flex-wrap items-start gap-2">
                  <Badge variant="destructive">{nameOf(blocker.user_id)}</Badge>
                  <span>{blocker.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator />

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Not submitted</h2>
          {summary.missing.length === 0 ? (
            <p className="text-muted-foreground">Everyone posted.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {summary.missing.map((id) => (
                <Badge key={id} variant="secondary">
                  {nameOf(id)}
                </Badge>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
