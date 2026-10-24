"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  priority = false,
  mark = false,
  tone = "light",
}: {
  className?: string;
  priority?: boolean;
  /** Square mark, for a collapsed sidebar or a favicon-sized spot. */
  mark?: boolean;
  /** Light pages always use the black wordmark. Auto follows the app theme. */
  tone?: "light" | "auto";
}) {
  if (mark) {
    return (
      <Image
        src="/kismetmark.png"
        alt="Kismet"
        width={651}
        height={627}
        priority={priority}
        className={cn("w-auto object-contain", className)}
      />
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/kismetlogo.png"
        alt="Kismet"
        width={1881}
        height={627}
        priority={priority}
        className={cn("h-full w-auto object-contain", tone === "auto" && "brand-logo-light")}
      />
      {tone === "auto" && (
        <Image
          src="/kismetlogo-on-dark.png"
          alt=""
          width={1881}
          height={627}
          className="brand-logo-dark h-full w-auto object-contain"
          aria-hidden
        />
      )}
    </span>
  );
}
