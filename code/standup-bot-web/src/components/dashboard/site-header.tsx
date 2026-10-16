import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "today", label: "Today", href: "/" },
  { key: "history", label: "History", href: "/history" },
  { key: "people", label: "People", href: "/people" },
] as const;

export type Section = (typeof SECTIONS)[number]["key"];

export function SiteHeader({ active }: { active: Section }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-heading font-semibold">
          <span className="size-2.5 rounded-full bg-brand" />
          <span className="hidden sm:inline">Skip the Standup</span>
        </Link>
        <nav className="flex gap-1">
          {SECTIONS.map((section) => (
            <Link
              key={section.key}
              href={section.href}
              aria-current={section.key === active ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                section.key === active && "bg-brand/10 text-brand hover:bg-brand/15 hover:text-brand",
              )}
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8">{children}</main>;
}
