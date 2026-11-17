import Link from "next/link";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { COMPARISONS, type Comparison } from "@/lib/comparisons";

export function CompareIndex() {
  return (
    <MarketingFrame>
      <main className="mx-auto max-w-[800px] px-6 pb-24 pt-16 md:px-8 md:pt-20">
        <p className="text-sm text-[#6a717c]">Resources</p>
        <h1 className="mt-3 max-w-xl text-[2rem] font-medium leading-[1.15] tracking-[-0.03em] text-[#141414] md:text-[2.5rem]">
          Compare
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[#3c4250]">
          Kismet sits next to the tools a product team already uses. These pages say what each one is for, and where Kismet takes over.
        </p>
        <ul className="mt-10 divide-y divide-[#eceae4] border-y border-[#eceae4]">
          {COMPARISONS.map((item) => (
            <li key={item.slug}>
              <Link href={`/compare/${item.slug}`} className="block py-5 hover:bg-[#fbfbfa]">
                <span className="block text-[15px] font-medium text-[#141414]">Kismet and {item.name}</span>
                <span className="mt-1 block text-[15px] leading-relaxed text-[#5c6570]">{item.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </MarketingFrame>
  );
}

export function CompareArticle({ comparison }: { comparison: Comparison }) {
  return (
    <MarketingFrame>
      <main className="mx-auto max-w-[800px] px-6 pb-24 pt-16 md:px-8 md:pt-20">
        <p className="text-sm text-[#6a717c]">
          <Link href="/compare" className="hover:text-[#141414]">
            Compare
          </Link>
        </p>
        <h1 className="mt-3 text-[2rem] font-medium leading-[1.15] tracking-[-0.03em] text-[#141414] md:text-[2.5rem]">
          Kismet and {comparison.name}
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[#3c4250]">{comparison.summary}</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[#3c4250]">
          <section>
            <h2 className="text-lg font-medium tracking-[-0.02em] text-[#141414]">{comparison.name}</h2>
            <p className="mt-2">{comparison.theirs}</p>
          </section>
          <section>
            <h2 className="text-lg font-medium tracking-[-0.02em] text-[#141414]">Kismet</h2>
            <p className="mt-2">{comparison.ours}</p>
          </section>
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[14px] leading-snug">
            <thead>
              <tr className="border-b border-[#eceae4] text-[#6a717c]">
                <th className="py-2 pr-4 font-medium">Job</th>
                <th className="py-2 pr-4 font-medium text-[#141414]">Kismet</th>
                <th className="py-2 font-medium">{comparison.name}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.job} className="border-b border-[#eceae4] align-top">
                  <th className="py-3 pr-4 font-medium text-[#141414]">{row.job}</th>
                  <td className="py-3 pr-4 text-[#3c4250]">{row.kismet}</td>
                  <td className="py-3 text-[#3c4250]">{row.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-10 text-sm text-[#6a717c]">
          <Link href="/contact" className="font-medium text-[#141414] hover:underline">
            Request a demo
          </Link>
          <span> if you want to see the workflow on your own product.</span>
        </p>
      </main>
    </MarketingFrame>
  );
}
