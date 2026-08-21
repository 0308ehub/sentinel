import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/helpers";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user.name ?? user.email}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Your dashboard is ready for what comes next.</p>
        </CardContent>
      </Card>
    </div>
  );
}
