import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const COLORS = ["bg-avatar-1", "bg-avatar-2", "bg-avatar-3", "bg-avatar-4", "bg-avatar-5"];

function colorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

type PersonAvatarProps = {
  id: string;
  name: string;
  size?: "sm" | "default" | "lg";
  muted?: boolean;
};

export function PersonAvatar({ id, name, size = "default", muted = false }: PersonAvatarProps) {
  return (
    <Avatar size={size}>
      <AvatarFallback
        className={cn("font-medium text-foreground", muted ? "bg-muted text-muted-foreground" : colorFor(id))}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
