import { AppShell } from "@/components/layout/app-shell";

/** One shell for the signed-in app, so the sidebar stays mounted while pages change. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
