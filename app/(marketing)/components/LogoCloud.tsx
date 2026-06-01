export function LogoCloud() {
  const logos = [
    { name: "Slack" },
    { name: "Linear" },
    { name: "GitHub" },
    { name: "Notion" },
    { name: "Jira" },
    { name: "Intercom" },
    { name: "Salesforce" },
    { name: "HubSpot" },
  ];

  return (
    <section className="py-16 border-t border-white/[0.06]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex items-center justify-between gap-8 flex-wrap">
          {logos.map((logo) => (
            <span
              key={logo.name}
              className="text-[#333333] hover:text-[#555555] transition-colors cursor-default font-semibold text-[15px] tracking-tight"
            >
              {logo.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
