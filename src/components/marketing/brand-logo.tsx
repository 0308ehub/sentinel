"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const WORDMARK = { src: "/kismet-wordmark.png", width: 936, height: 280 };
const APP = { src: "/kismet-app.png", width: 1024, height: 268 };
const APP_DARK = { src: "/kismet-app-on-dark.png", width: 1024, height: 268 };

export function BrandLogo({
  className,
  priority = false,
  mark = false,
  tone = "light",
  surface = "company",
}: {
  className?: string;
  priority?: boolean;
  /** Square {k} tile, for a collapsed sidebar or a favicon-sized spot. */
  mark?: boolean;
  /** Light pages always use black ink. Auto follows the app theme. */
  tone?: "light" | "auto";
  /** Company wordmark on the public site. Braced wordmark inside the signed-in app. */
  surface?: "company" | "app";
}) {
  if (mark) {
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

  const light = surface === "app" ? APP : WORDMARK;

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
          src={APP_DARK.src}
          alt=""
          width={APP_DARK.width}
          height={APP_DARK.height}
          className="brand-logo-dark h-full w-auto object-contain"
          aria-hidden
        />
      )}
    </span>
  );
}
