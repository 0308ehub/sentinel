"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, Loader2, FileText, Mail, Globe, Mic, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceType: string;
  content: string;
  similarity: number;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  EMAIL: Mail,
  URL: Globe,
  AUDIO: Mic,
  NOTE: StickyNote,
};

function SourceIcon({ type }: { type: string }) {
  const Icon = SOURCE_ICONS[type] ?? FileText;
  return <Icon className="h-3.5 w-3.5" />;
}

function highlightQuery(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-indigo-100 text-indigo-800 rounded px-0.5">{part}</mark>
    ) : (
      part
    )
  );
}

export function SearchClient({ workspaceId }: { workspaceId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.data?.results ?? []);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 500);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
  }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.documentId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Semantic Search</h1>
        <p className="text-sm text-gray-400 mb-5">Search across all ingested documents using AI-powered vector similarity</p>

        <form onSubmit={handleSubmit} className="relative max-w-2xl">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {loading ? (
              <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
            ) : (
              <Search className="h-4 w-4 text-gray-400" />
            )}
          </div>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search by concept, topic, or exact phrase…"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 shadow-sm"
          />
        </form>

        {query.length >= 2 && !loading && (
          <p className="text-xs text-gray-400 mt-2 max-w-2xl">
            {searched
              ? results.length === 0
                ? "No results — try different keywords or a broader phrase"
                : `${results.length} passage${results.length !== 1 ? "s" : ""} from ${Object.keys(grouped).length} document${Object.keys(grouped).length !== 1 ? "s" : ""}`
              : "Searching…"}
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {!searched && !loading && (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Search className="h-7 w-7 text-indigo-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Start typing to search your knowledge base</p>
            <p className="text-xs text-gray-400 mt-1">Finds semantically similar content — not just exact matches</p>
          </div>
        )}

        {searched && results.length > 0 && (
          <div className="space-y-4 max-w-2xl">
            {Object.entries(grouped).map(([docId, chunks]) => {
              const best = chunks[0];
              return (
                <div key={docId} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                  {/* Document header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-500">
                      <SourceIcon type={best.sourceType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/workspaces/${workspaceId}/documents/${docId}`}
                        className="text-sm font-semibold text-gray-900 hover:text-indigo-700 transition-colors truncate block"
                      >
                        {best.documentTitle}
                      </Link>
                      <span className="text-xs text-gray-400 capitalize">{best.sourceType.toLowerCase()}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                      best.similarity >= 0.8 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      best.similarity >= 0.6 ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-gray-50 text-gray-500 border-gray-200"
                    )}>
                      {Math.round(best.similarity * 100)}% match
                    </span>
                  </div>

                  {/* Passages */}
                  <div className="divide-y divide-gray-50">
                    {chunks.map((chunk) => (
                      <div key={chunk.chunkId} className="px-4 py-3">
                        <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
                          {highlightQuery(chunk.content, query)}
                        </p>
                        {chunks.length > 1 && (
                          <span className="text-[10px] text-gray-300 mt-1 block">
                            {Math.round(chunk.similarity * 100)}% similarity
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
