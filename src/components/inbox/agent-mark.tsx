import { markLetter } from "@/lib/inbox/roster";
import { cn } from "@/lib/utils";

export function AgentMark({
  name,
  icon = "",
  color,
  size,
  className,
}: {
  name: string;
  icon?: string;
  color: string;
  size: number;
  className?: string;
}) {
  const letter = markLetter(icon, name);
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full leading-none text-white", className)}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.max(11, Math.round(size * 0.42)),
        fontWeight: 600,
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}
