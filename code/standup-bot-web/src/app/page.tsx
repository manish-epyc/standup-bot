import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Skip the Standup
        </h1>
        <Badge variant="secondary">MVP</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s summary</CardTitle>
          <CardDescription>
            The team summary appears here after it is posted in Slack.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No summary yet.
        </CardContent>
      </Card>
    </main>
  );
}
