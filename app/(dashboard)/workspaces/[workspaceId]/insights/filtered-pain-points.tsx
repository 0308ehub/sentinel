"use client";

import { useState, useMemo } from "react";
import { PainPointCard } from "./pain-point-card";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface PainPoint {
  id: string;
  title: string;
  description: string;
  severity: number;
  urgency: number;
  frequency: number;
  affectedSegments: string[];
  evidenceIds: string[];
}

export function FilteredPainPoints({
  painPoints,
  workspaceId,
}: {
  painPoints: PainPoint[];
  workspaceId: string;
}) {
  const [search, setSearch] = useState("");
  const [minSeverity, setMinSeverity] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState("");

  const allSegments = useMemo(() => {
    const set = new Set<string>();
    for (const pp of painPoints) {
      for (const seg of pp.affectedSegments) {
        if (seg) set.add(seg);
      }
    }
    return Array.from(set).sort();
  }, [painPoints]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return painPoints.filter((pp) => {
      if (q && !pp.title.toLowerCase().includes(q) && !pp.description.toLowerCase().includes(q)) return false;
      if (minSeverity > 0 && pp.severity < minSeverity) return false;
      if (selectedSegment && !pp.affectedSegments.includes(selectedSegment)) return false;
      return true;
    });
  }, [painPoints, search, minSeverity, selectedSegment]);

  const isFiltered = search || minSeverity > 0 || selectedSegment;

  function clearFilters() {
    setSearch("");
    setMinSeverity(0);
    setSelectedSegment("");
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pain points…"
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-52"
          />
        </div>

        {/* Min severity */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">Min severity:</span>
          <select
            value={minSeverity}
            onChange={(e) => setMinSeverity(Number(e.target.value))}
            className="text-sm rounded-lg border border-gray-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value={0}>Any</option>
            {[3, 5, 7, 8, 9].map((v) => (
              <option key={v} value={v}>{v}+</option>
            ))}
          </select>
        </div>

        {/* Segment filter */}
        {allSegments.length > 0 && (
          <select
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value)}
            className="text-sm rounded-lg border border-gray-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-[200px]"
          >
            <option value="">All segments</option>
            {allSegments.map((seg) => (
              <option key={seg} value={seg}>{seg}</option>
            ))}
          </select>
        )}

        {/* Clear */}
        {isFiltered && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} of {painPoints.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">
          No pain points match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((pp) => (
            <PainPointCard key={pp.id} pp={pp} workspaceId={workspaceId} />
          ))}
        </div>
      )}
    </div>
  );
}
