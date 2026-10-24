import { getPerson } from "@/lib/data/seed";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function PersonAvatar({
  personId,
  size = "sm",
  showName = false,
  className,
}: {
  personId: string;
  size?: "sm" | "md";
  showName?: boolean;
  className?: string;
}) {
  const person = getPerson(personId);
  if (!person) return null;

  const initials = person.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className={size === "sm" ? "h-6 w-6" : "h-7 w-7"}>
        <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
      </Avatar>
      {showName && <span className="text-xs text-muted-foreground">{person.name}</span>}
    </div>
  );
}
