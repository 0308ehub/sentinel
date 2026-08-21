import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-background">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2">
            <Image src="/sentinel-logo.png" alt="" width={24} height={24} className="dark:invert" />
            <span className="font-semibold">Sentinel</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton />
          </div>
        </header>
        <main>{children}</main>
      </div>
    </Providers>
  );
}
