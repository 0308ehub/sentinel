import { UserButton } from "@clerk/nextjs";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-background">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <span className="font-semibold">Sentinel</span>
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
