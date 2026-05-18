import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_INTERVIEWS = [
  {
    title: "Customer Interview — Acme Corp — Enterprise Ops Lead",
    sourceType: "INTERVIEW" as const,
    text: `Interview with Sarah Chen, Head of Operations at Acme Corp
Date: May 2026
Plan: Enterprise

Interviewer: Walk me through how your team currently uses the analytics dashboard.

Sarah: We use it daily, but honestly the biggest pain point is exporting reports. Every time I need to share data with the exec team, I have to ask IT or someone on the data team to run a custom export. It takes hours, sometimes days. We're an enterprise customer paying $50k/year and I can't just download a CSV. This is blocking a lot of our workflows.

Interviewer: How often does this happen?

Sarah: Multiple times a week. My team of 8 people all run into this. And it's not just me — I know at least 3 other customers have complained about the same thing. We've actually started using a competitor's tool just for exports because we can't wait.

Interviewer: What about permissions?

Sarah: That's another massive issue. Our dashboards are accessible to everyone on our 200-person team, which is terrible for compliance. We need role-based access control. Our legal team flagged this as a potential compliance risk last quarter. Without it, we can't expand the contract.

Interviewer: And the performance?

Sarah: The dashboards are so slow. Sometimes it takes 30-40 seconds to load a report. Our team has started making jokes about going for coffee while it loads. It's genuinely embarrassing when I'm demoing to my executives. I've heard this is because we have so much historical data, but there's been no improvement in months.

Interviewer: Anything else?

Sarah: Scheduled reports would be huge. Right now I manually export and email reports every Monday. If I could set up automated weekly report emails, that would save me hours every week. And some of our new team members struggle to understand where to start — the setup and onboarding documentation is really sparse.`,
  },
  {
    title: "Customer Interview — Bright Analytics — SMB Marketing Manager",
    sourceType: "INTERVIEW" as const,
    text: `Interview with Marcus Johnson, Marketing Manager at Bright Analytics
Date: May 2026
Plan: Growth

Marcus: The tool is great overall, but I have three main frustrations.

First, I can't figure out how to share a specific dashboard with a client. I always end up screenshotting and emailing PDFs, which is ridiculous. There's no way to create a read-only shareable link. My clients want to check their metrics themselves.

Second, the mobile experience is terrible. When I'm traveling, I want to check key metrics on my phone. Right now the dashboard doesn't even render properly on mobile. The charts are unreadable.

Third — and this might be a feature request — I'd love to set up alerts when a key metric crosses a threshold. Like if conversion rate drops below 2%, I want an email or Slack notification. Right now I have to manually check every day, which I always forget to do.

Interviewer: How critical are these for you?

Marcus: The sharing thing is the most critical. I'm about to have a renewal conversation and honestly if this doesn't get addressed I might move to a tool that supports client portals. It's that important to my workflow. The alerts would be super valuable too.`,
  },
  {
    title: "Support Tickets — May 2026 — Export and Permissions Issues",
    sourceType: "SUPPORT_TICKET" as const,
    text: `Ticket #4821
Customer: TechFlow Corp (Enterprise)
Date: May 3, 2026
Issue: Cannot export reports to CSV or Excel. Only PDF is available and the formatting is broken. We need raw data exports for our BI tools. This is critical.
Status: Open

Ticket #4892
Customer: DataDriven Co (Growth)
Date: May 5, 2026
Issue: Dashboard loading times are 30-60 seconds for any report with more than 90 days of data. Completely unusable for our weekly reviews. Please fix.
Status: Open

Ticket #5021
Customer: Nexus Global (Enterprise)
Date: May 8, 2026
Issue: We need to restrict which users can see which dashboards. Right now everyone in our 500-person company can see everything. This is a security and compliance issue. We've been asking for RBAC for 6 months.
Status: Escalated

Ticket #5088
Customer: Startup Hub (Starter)
Date: May 10, 2026
Issue: New team member can't figure out how to set up their first dashboard. The getting started documentation is very sparse. Can you add a better onboarding guide or tutorial?
Status: Resolved

Ticket #5102
Customer: FinTech Partners (Enterprise)
Date: May 12, 2026
Issue: We need audit logs showing who viewed or exported which reports, and when. This is required for our SOC 2 compliance. Currently there's no audit trail at all. This is blocking our contract renewal.
Status: Escalated

Ticket #5134
Customer: GrowthCo (Growth)
Date: May 14, 2026
Issue: Is there a way to schedule automatic report emails? We want to send a weekly summary to our executive team automatically every Monday at 9am. Currently we have to do this manually.
Status: Open

Ticket #5201
Customer: Retail Analytics Inc (Enterprise)
Date: May 15, 2026
Issue: Export to CSV isn't available in our plan. We need to connect this data to Tableau. Please add CSV export as a feature. Willing to pay more for it.
Status: Open

Ticket #5244
Customer: MediaCorp (Enterprise)
Date: May 16, 2026
Issue: We cannot give different permission levels to different team members. Our finance team should be read-only, operations team should have edit access. There's no way to set this up.
Status: Open`,
  },
  {
    title: "Sales Call Notes — Lost Deals — Q2 2026",
    sourceType: "SALES_CALL" as const,
    text: `Lost deal summary — Q2 2026

Deal: Apex Retail (Enterprise, $80k ACV)
Lost to: Competitor X
Primary reason: "Your product doesn't have CSV export or API access to raw data. Our data team needs to pull data into our own BI tools. Competitor X has a full API."
Secondary: "Dashboard load times are too slow for daily use."

Deal: GlobalTech (Enterprise, $120k ACV)
Lost to: In-house solution
Primary reason: "We need role-based permissions. 1500 people at our company, we can't have everyone seeing the same data. Your product doesn't support this."
Secondary: "No audit logs makes us nervous from a compliance standpoint."

Deal: FinServe Group (Enterprise, $200k ACV)
Lost to: Competitor Y
Primary reason: "We need SOC 2 compliance including audit logs. We reviewed your product and there's no audit trail feature. This is a hard requirement for us."

Deal: SaaSCo (Growth, $24k ACV)
Churned after 6 months
Churn reason: "We wanted to embed dashboard links in our customer portal. There's no way to share a read-only dashboard link. We ended up building this ourselves."

Deal: E-commerce Plus (Growth, $18k ACV)
Churned after 3 months
Churn reason: "Our team couldn't figure out how to get started. The product is powerful but the onboarding is too complex. We didn't have time to figure it out."`,
  },
  {
    title: "User Feedback Survey — May 2026",
    sourceType: "USER_FEEDBACK" as const,
    text: `Survey: Product satisfaction NPS and feature requests
Responses: 47
Date: May 2026

Top feature requests by vote count:
1. CSV / Excel export (38 votes, mentioned by 81% of respondents)
2. Role-based access control / permissions (29 votes)
3. Scheduled email reports (24 votes)
4. Dashboard performance improvements (22 votes)
5. Mobile app or responsive mobile view (18 votes)
6. Shareable dashboard links (16 votes)
7. Metric alerts and notifications (15 votes)
8. Audit logs (12 votes)
9. Better onboarding / tutorials (11 votes)
10. API access (10 votes)

Representative quotes:

"I love the product but I can't use it with clients because there's no way to share a view-only link. This is the #1 thing holding back my adoption." — Agency owner

"We've been asking for CSV export for a year. It's making us look at competitors." — Enterprise ops manager

"Dashboard loads take 45 seconds. I've started opening it and then going to make coffee while it loads. Please fix this." — Growth user

"Our security team won't approve wider rollout until we have role-based permissions. We're stuck at 5 licenses because of this." — Enterprise IT manager

"The product is great once you figure it out, but figuring it out took us 3 weeks. An onboarding checklist or in-product tutorial would have saved us a lot of time." — SMB user

"We need audit logs. Our lawyers are asking who is accessing what data. Without this we can't expand the contract." — Enterprise compliance lead`,
  },
];

async function main() {
  console.log("Seeding database…");

  // Create demo user
  const user = await prisma.user.upsert({
    where: { clerkId: "demo_user_seed" },
    update: {},
    create: {
      clerkId: "demo_user_seed",
      email: "demo@sentinel.ai",
      name: "Demo User",
    },
  });

  // Create demo org
  const org = await prisma.organization.upsert({
    where: { slug: "demo-analytics-co" },
    update: {},
    create: {
      name: "Analytics Co",
      slug: "demo-analytics-co",
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  // Create demo workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: "demo-workspace-1" },
    update: {},
    create: {
      id: "demo-workspace-1",
      organizationId: org.id,
      name: "Analytics Dashboard — B2B Product",
      description: "Customer discovery for our B2B analytics platform. Identifying top pain points and opportunities.",
    },
  });

  // Create demo documents
  for (const doc of DEMO_INTERVIEWS) {
    await prisma.document.create({
      data: {
        workspaceId: workspace.id,
        uploadedById: user.id,
        title: doc.title,
        sourceType: doc.sourceType,
        fileType: "txt",
        rawText: doc.text,
        status: "PENDING",
      },
    });
  }

  console.log(`Seeded workspace: ${workspace.id}`);
  console.log(`Created ${DEMO_INTERVIEWS.length} demo documents`);
  console.log("\nTo process the documents, run: npm run dev and trigger ingestion via the UI.");
  console.log(`Or visit: http://localhost:3000/workspaces/${workspace.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
