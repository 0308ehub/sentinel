"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const WORDMARK = { src: "/kismet-wordmark.png", width: 936, height: 280 };
const APP = { src: "/kismet-app.png", width: 1024, height: 268 };
const APP_DARK = { src: "/kismet-app-on-dark.png", width: 1024, height: 268 };
// {K} cut from the app wordmark's own glyphs so the collapsed sidebar matches the expanded one.
const APP_MARK = { src: "/kismet-app-mark.png", width: 379, height: 256 };
const APP_MARK_DARK = { src: "/kismet-app-mark-on-dark.png", width: 379, height: 256 };

export function BrandLogo({
  className,
  priority = false,
  mark = false,
  tone = "light",
  surface = "company",
}: {
  className?: string;
  priority?: boolean;
  /** Compact mark: braced {K} inside the app, the square {k} tile elsewhere. */
  mark?: boolean;
  /** Light pages always use black ink. Auto follows the app theme. */
  tone?: "light" | "auto";
  /** Company wordmark on the public site. Braced wordmark inside the signed-in app. */
  surface?: "company" | "app";
}) {
  if (mark && surface !== "app") {
    return (
      <Image
        src="/kismet-mark.png"
        alt="Kismet"
        width={880}
        height={880}
        priority={priority}
        className={cn("w-auto rounded-[7px] object-contain", className)}
      />
    );
  }

  const light = mark ? APP_MARK : surface === "app" ? APP : WORDMARK;
  const dark = mark ? APP_MARK_DARK : APP_DARK;

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={light.src}
        alt="Kismet"
        width={light.width}
        height={light.height}
        priority={priority}
        className={cn("h-full w-auto object-contain", tone === "auto" && "brand-logo-light")}
      />
      {tone === "auto" && (
        <Image
          src={dark.src}
          alt=""
          width={dark.width}
          height={dark.height}
          className="brand-logo-dark h-full w-auto object-contain"
          aria-hidden
        />
      )}
    </span>
  );
}
