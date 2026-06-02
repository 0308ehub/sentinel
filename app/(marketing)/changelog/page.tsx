import { MarketingPageShell } from '../components/MarketingPageShell'

export const metadata = { title: 'Changelog — Sentinel' }

const ENTRIES = [
  {
    date: 'May 2025',
    title: 'Roadmap agent + Linear bi-directional sync',
    body: 'The roadmap agent now reviews your Linear backlog weekly and suggests priority changes based on fresh signals. Bi-directional sync means status updates in Linear instantly reflect in Sentinel.',
  },
  {
    date: 'April 2025',
    title: 'Customer request linking and revenue weighting',
    body: 'Requests are now linked to the company and contact they came from. Each request is weighted by ARR so the highest-value asks surface automatically.',
  },
  {
    date: 'March 2025',
    title: 'Digest agent and weekly stakeholder reports',
    body: 'The digest agent composes personalized weekly summaries for each stakeholder. Reports are sent automatically every Monday morning.',
  },
  {
    date: 'February 2025',
    title: 'Gong and Chorus integrations',
    body: 'Ingest sales call transcripts automatically. Sentinel clusters recurring objections and feature requests from calls at scale.',
  },
  {
    date: 'January 2025',
    title: 'Segment analysis and churn risk scoring',
    body: 'Break down any insight by customer segment. Churn risk scoring correlates feedback themes with cancellation events.',
  },
]

export default function ChangelogPage() {
  return (
    <>
      <div>
        <MarketingPageShell
          pill={{ label: 'Changelog' }}
          title="What's new in Sentinel"
          description="Every update, improvement, and new feature — documented as it ships."
          ctaLabel="Get started free"
          ctaHref="/sign-up"
          ctaSecondaryLabel="Subscribe to updates"
          ctaSecondaryHref="/contact"
        />
      </div>
      <section className="max-w-[720px] mx-auto px-6 pb-24 -mt-8">
        <div className="space-y-10">
          {ENTRIES.map((entry) => (
            <div key={entry.date} className="border-l-2 border-indigo-500/40 pl-6">
              <p className="text-[12px] text-indigo-400 font-medium uppercase tracking-widest mb-1">{entry.date}</p>
              <h3 className="text-[17px] font-semibold text-white mb-2">{entry.title}</h3>
              <p className="text-[14px] text-[#9ca3af] leading-relaxed">{entry.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
