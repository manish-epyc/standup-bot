import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { PersonAvatar } from "@/components/dashboard/person-avatar";
import { PageBody, SiteHeader } from "@/components/dashboard/site-header";
import { getPeople } from "@/lib/dashboard";
import { formatTeamDate } from "@/lib/date";

export default async function PeoplePage() {
  await connection();
  const { env } = getCloudflareContext();
  const people = await getPeople(env);

  return (
    <>
      <SiteHeader active="people" />
      <PageBody>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">People</h1>
          <p className="text-muted-foreground">Everyone in the standup channel.</p>
        </div>

        {people.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
            Nobody yet. People appear here once they post in the standup channel.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  href={`/people/${person.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-border px-4 py-4 transition-colors hover:bg-muted/50"
                >
                  <PersonAvatar id={person.id} name={person.name} size="lg" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium">{person.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {person.recentDays > 0
                        ? `Posted ${person.postedDays} of the last ${person.recentDays} standups`
                        : "No standups yet"}
                    </span>
                    {person.lastPosted && (
                      <span className="text-xs text-muted-foreground">Last update {formatTeamDate(person.lastPosted)}</span>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
