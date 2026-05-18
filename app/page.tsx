import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Layers, Lightbulb, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-violet-600" />
          <span className="font-semibold text-lg">Sentinel</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">Get started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
          <Zap className="h-3.5 w-3.5" />
          Cursor for product managers
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
          Start with customer evidence.<br />
          End with a product roadmap.
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Sentinel helps product teams figure out what to build next by turning customer feedback,
          interviews, support tickets, and product data into clear product recommendations, PRDs,
          and engineering tickets.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/sign-up">
            <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              Start for free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline">Sign in</Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">How it works</h2>
        <p className="text-gray-500 text-center mb-16 max-w-lg mx-auto">
          Move from messy customer evidence to implementation-ready specs in minutes.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            {
              icon: Upload,
              step: "1",
              title: "Upload evidence",
              desc: "Bring in interviews, support tickets, feedback, analytics exports, and internal notes.",
            },
            {
              icon: Lightbulb,
              step: "2",
              title: "Find the signal",
              desc: "Sentinel identifies recurring pain points, user segments, feature requests, and workflow issues.",
            },
            {
              icon: BarChart3,
              step: "3",
              title: "Decide what to build",
              desc: "Get ranked opportunities with evidence, impact, confidence, urgency, effort, and risk.",
            },
            {
              icon: FileText,
              step: "4",
              title: "Move to implementation",
              desc: "Generate PRDs, user stories, acceptance criteria, and engineering tickets.",
            },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="flex flex-col items-start gap-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 text-sm font-bold flex items-center justify-center">
                  {step}
                </div>
                <Icon className="h-5 w-5 text-violet-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Outputs */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Core outputs</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              "Pain point clusters",
              "Evidence-backed recommendations",
              "Product requirement documents",
              "UI and workflow suggestions",
              "Engineering tickets",
              "Exportable specs for coding agents",
            ].map((output) => (
              <div
                key={output}
                className="flex items-center gap-2 bg-white border rounded-lg px-4 py-3 text-sm font-medium text-gray-700 shadow-sm"
              >
                <Layers className="h-4 w-4 text-violet-500 flex-shrink-0" />
                {output}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Ready to build the right things?
        </h2>
        <p className="text-gray-500 mb-8">
          Upload your first piece of customer evidence and get your first product recommendation in under a minute.
        </p>
        <Link href="/sign-up">
          <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            Get started free <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      <footer className="border-t py-8 text-center text-sm text-gray-400">
        © 2026 Sentinel. Built for product teams.
      </footer>
    </div>
  );
}
