"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useUIStore } from "@/stores/ui-store";
import { searchGraph, getNodeLabel } from "@/lib/graph";
import { useGraphStore } from "@/lib/graph/graph-store";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Frame,
  Clock,
  GitBranch,
  BarChart3,
  Scale,
  Search,
  Plus,
  Boxes,
  CircleAlert,
  Home,
} from "lucide-react";
import type { NodeType } from "@/types/graph";
import { ReportProblem } from "@/components/feedback/report-problem";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/experiments", icon: LayoutDashboard },
  { label: "Timeline", href: "/timeline", icon: Clock },
  { label: "Graph", href: "/graph", icon: GitBranch },
  { label: "Design canvas", href: "/design", icon: Frame },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Connections", href: "/settings/connectors", icon: Boxes },
  { label: "Kismet home", href: "/", icon: Home },
];

const TYPE_ICONS: Partial<Record<NodeType, React.ElementType>> = {
  FEATURE: Layers,
  METRIC: BarChart3,
  DECISION: Scale,
  CUSTOMER_PROBLEM: Search,
};

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setProposeFeatureOpen } = useUIStore();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useGraphStore((s) => s.nodes.length);
  const results = searchGraph(query);
  // Pages hidden from the sidebar stay findable: typing a page name matches it.
  const needle = query.trim().toLowerCase();
  const matchingPages = needle ? NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(needle)) : [];

  const navigate = (href: string) => {
    setCommandPaletteOpen(false);
    setQuery("");
    router.push(href);
  };

  const openProposeFeature = () => {
    setCommandPaletteOpen(false);
    setQuery("");
    setProposeFeatureOpen(true);
  };

  return (
    <>
      <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <DialogContent className="top-[18%] translate-y-0 overflow-hidden p-0 shadow-lg max-w-lg">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {!query && (
              <>
                <CommandGroup heading="Actions">
                  <CommandItem onSelect={openProposeFeature}>
                    <Plus className="mr-2 h-4 w-4 text-primary" />
                    Propose feature…
                  </CommandItem>
                  <CommandItem onSelect={() => {
                    setCommandPaletteOpen(false);
                    setFeedbackOpen(true);
                  }}>
                    <CircleAlert className="mr-2 h-4 w-4 text-primary" />
                    Report a problem…
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Navigation">
                {NAV_ITEMS.map((item) => (
                  <CommandItem key={item.href} onSelect={() => navigate(item.href)}>
                    <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              </>
            )}
            {query && matchingPages.length > 0 && (
              <CommandGroup heading="Pages">
                {matchingPages.map((item) => (
                  <CommandItem key={item.href} onSelect={() => navigate(item.href)}>
                    <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {query && results.length > 0 && (
              <CommandGroup heading="Graph Nodes">
                {results.map((result) => {
                  const Icon = TYPE_ICONS[result.type] ?? Search;
                  const href =
                    result.type === "FEATURE"
                      ? `/features/${result.id}`
                      : result.type === "ENGINEERING_TASK"
                        ? `/board/${result.id}`
                      : `/graph?node=${result.id}`;
                  return (
                    <CommandItem key={result.id} onSelect={() => navigate(href)}>
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>{result.title}</span>
                        <span className="text-xs text-muted-foreground">{result.breadcrumb}</span>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {getNodeLabel(result.type)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
      <ReportProblem open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
