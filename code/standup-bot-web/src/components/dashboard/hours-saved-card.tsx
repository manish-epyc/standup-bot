import { Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HoursSaved } from "@/lib/hours-saved";

type HoursSavedCardProps = {
  hoursSaved: HoursSaved;
  monthLabel: string;
};

function formatHours(hours: number): string {
  return `${hours.toFixed(1)} h`;
}

export function HoursSavedCard({ hoursSaved, monthLabel }: HoursSavedCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4" />
          Meeting time saved
        </CardTitle>
        <CardDescription>
          Estimate: 15 minutes per person per day, minus the time spent recording.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-8">
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold tabular-nums">{formatHours(hoursSaved.monthHours)}</span>
          <span className="text-sm text-muted-foreground">{monthLabel}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold tabular-nums">{formatHours(hoursSaved.todayHours)}</span>
          <span className="text-sm text-muted-foreground">Today</span>
        </div>
      </CardContent>
    </Card>
  );
}
