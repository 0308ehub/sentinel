import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/nav/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-56 min-h-screen">{children}</main>
      </div>
    </Providers>
  );
}
