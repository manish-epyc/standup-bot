import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function dayHref(date: string, today: string): string {
  return date === today ? "/" : `/history/${date}`;
}

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shift(date, -((weekday + 6) % 7));
}

const weekdayName = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const dayOfMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" });

type WeekStripProps = {
  selected: string;
  today: string;
  standupDates: string[];
};

export function WeekStrip({ selected, today, standupDates }: WeekStripProps) {
  const monday = mondayOf(selected);
  const days = Array.from({ length: 5 }, (_, i) => shift(monday, i));
  const previousWeek = shift(monday, -7);
  const nextWeek = shift(monday, 7);
  const hasStandup = new Set(standupDates);
  const arrow = cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "shrink-0");

  return (
    <nav aria-label="Week" className="flex items-center gap-1 sm:gap-2">
      <Link href={dayHref(previousWeek, today)} className={arrow} aria-label="Previous week">
        <ChevronLeft />
      </Link>
      <div className="grid flex-1 grid-cols-5 gap-1 sm:gap-2">
        {days.map((date) => {
          const isSelected = date === selected;
          const isFuture = date > today;
          const label = date === today ? "Today" : weekdayName.format(new Date(`${date}T00:00:00Z`));
          return (
            <Link
              key={date}
              href={dayHref(date, today)}
              aria-current={isSelected ? "date" : undefined}
              aria-disabled={isFuture}
              tabIndex={isFuture ? -1 : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl py-2 transition-colors hover:bg-muted",
                isSelected && "bg-brand text-brand-foreground hover:bg-brand",
                isFuture && "pointer-events-none opacity-40",
              )}
            >
              <span className={cn("text-xs", isSelected ? "text-brand-foreground" : "text-muted-foreground")}>
                {label}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {dayOfMonth.format(new Date(`${date}T00:00:00Z`))}
              </span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  !hasStandup.has(date) && "bg-transparent",
                  hasStandup.has(date) && (isSelected ? "bg-brand-foreground" : "bg-brand"),
                )}
              />
            </Link>
          );
        })}
      </div>
      <Link
        href={dayHref(nextWeek > today ? today : nextWeek, today)}
        aria-disabled={monday === mondayOf(today)}
        className={cn(arrow, monday === mondayOf(today) && "pointer-events-none opacity-40")}
        aria-label="Next week"
      >
        <ChevronRight />
      </Link>
    </nav>
  );
}
