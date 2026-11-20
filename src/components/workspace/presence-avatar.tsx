"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsFor } from "@/lib/onboarding";
import type { PresenceEntry } from "@/lib/workspace/live-sync-core";
import { cn } from "@/lib/utils";

export function PresenceAvatar({ person, className }: { person: PresenceEntry; className?: string }) {
  return (
    <Avatar className={cn("h-4 w-4 ring-1 ring-white", className)} title={`${person.name} is viewing`}>
      {person.imageUrl && <AvatarPrimitive.Image src={person.imageUrl} alt="" className="h-full w-full object-cover" />}
      <AvatarFallback className="bg-accent text-[7px] text-accent-foreground">
        {initialsFor(person.name)}
      </AvatarFallback>
    </Avatar>
  );
}
