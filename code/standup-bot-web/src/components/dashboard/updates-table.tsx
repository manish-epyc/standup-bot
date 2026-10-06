import { Mic, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UpdateWithName } from "@/lib/db";
import { slackTsToDate } from "@/lib/slack/text";

type UpdatesTableProps = {
  updates: UpdateWithName[];
  timeZone: string;
};

export function UpdatesTable({ updates, timeZone }: UpdatesTableProps) {
  const formatTime = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Updates</CardTitle>
        <CardDescription>
          {updates.length === 0
            ? "Nobody has posted yet today."
            : `${updates.length} ${updates.length === 1 ? "person has" : "people have"} posted today.`}
        </CardDescription>
      </CardHeader>
      {updates.length > 0 && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Who</TableHead>
                <TableHead>Update</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {updates.map((update) => (
                <TableRow key={update.id}>
                  <TableCell className="align-top">
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-medium">{update.user_name}</span>
                      <Badge variant={update.source === "voice" ? "default" : "secondary"}>
                        {update.source === "voice" ? <Mic /> : <Type />}
                        {update.source}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-64 align-top whitespace-normal text-muted-foreground">
                    {update.transcript}
                  </TableCell>
                  <TableCell className="text-right align-top text-muted-foreground tabular-nums">
                    {formatTime.format(slackTsToDate(update.slack_ts))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
