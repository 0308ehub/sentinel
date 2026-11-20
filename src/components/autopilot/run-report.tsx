"use client";

import { X } from "lucide-react";
import type { RunReport as RunReportData } from "@/lib/autopilot/run-report-core";

export function RunReport({
  report,
  onOpenSignal,
  onOpenExperiment,
  onDismiss,
}: {
  report: RunReportData;
  onOpenSignal: (id: string) => void;
  onOpenExperiment: (id: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-3 max-w-3xl rounded-md border border-[#e1e4e8] bg-white p-3 text-xs text-[#374151]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[#111]">{report.headline}</p>
        <button type="button" onClick={onDismiss} className="text-[#9aa0a8] hover:text-[#111]" aria-label="Dismiss run report">
          <X className="h-4 w-4" />
        </button>
      </div>
      {report.looked.length > 0 && <Section title="Looked at" items={report.looked} />}
      {report.suggested.length > 0 && (
        <section className="mt-3">
          <h3 className="font-medium text-[#6b7280]">Suggested</h3>
          <ul className="mt-1 space-y-1">
            {report.suggested.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onOpenSignal(item.id)} className="text-left text-[#111] hover:underline">
                  {item.title}
                </button>
                {item.byKismet && <span className="ml-2 rounded bg-[#f2f2f4] px-1.5 py-0.5 text-[10px] text-[#6b7280]">Kismet&apos;s idea</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {report.moved.length > 0 && (
        <section className="mt-3">
          <h3 className="font-medium text-[#6b7280]">Moved</h3>
          <ul className="mt-1 space-y-1">
            {report.moved.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onOpenExperiment(item.id)} className="text-left text-[#111] hover:underline">
                  {item.title}: {item.from} → {item.to}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {report.notes.length > 0 && <Section title="Notes" items={report.notes} />}
      {report.errors.length > 0 && <Section title="Errors" items={report.errors} error />}
    </div>
  );
}

function Section({ title, items, error = false }: { title: string; items: string[]; error?: boolean }) {
  return (
    <section className="mt-3">
      <h3 className={error ? "font-medium text-red-700" : "font-medium text-[#6b7280]"}>{title}</h3>
      <ul className={`mt-1 space-y-1 ${error ? "text-red-700" : ""}`}>
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </section>
  );
}
