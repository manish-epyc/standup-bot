const MEETING_MINUTES_PER_MEMBER = 15;
// Slack doesn't always report a clip's length; the team is asked for about a minute.
const ASSUMED_CLIP_MS = 60_000;

export type DurationRow = { date: string; source: "voice" | "text"; duration_ms: number | null };

export type HoursSaved = { todayHours: number; monthHours: number };

function savedMinutes(members: number, rows: DurationRow[]): number {
  const recordingMs = rows.reduce(
    (total, row) => total + (row.source === "voice" ? (row.duration_ms ?? ASSUMED_CLIP_MS) : 0),
    0,
  );
  return Math.max(0, members * MEETING_MINUTES_PER_MEMBER - recordingMs / 60_000);
}

/** Per day with updates: `members × 15 min − time spent recording`, summed; `rows` span the month so far. */
export function calculateHoursSaved(rows: DurationRow[], members: number, today: string): HoursSaved {
  const byDate = Map.groupBy(rows, (row) => row.date);
  let monthMinutes = 0;
  for (const dayRows of byDate.values()) monthMinutes += savedMinutes(members, dayRows);
  const todayRows = byDate.get(today);
  return {
    todayHours: todayRows ? savedMinutes(members, todayRows) / 60 : 0,
    monthHours: monthMinutes / 60,
  };
}
