import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl text-center">
        <CardHeader>
          <CardTitle className="text-3xl">Sentinel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            An AI mentor that learns how your child thinks and grows with them.
          </p>
          <Link className={buttonVariants()} href="/sign-up">
            Get started
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
