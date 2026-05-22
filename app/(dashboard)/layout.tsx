import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/nav/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">{children}</main>
      </div>
    </Providers>
  );
}
