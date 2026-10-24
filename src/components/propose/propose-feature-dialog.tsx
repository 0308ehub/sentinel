"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/ui-store";
import { graphStore } from "@/lib/graph/graph-store";
import { people } from "@/lib/data/seed";
import {
  MOCK_REPOS,
  PRODUCT_DEFAULT_REPO,
  parseCustomRepo,
} from "@/lib/repos";
import type { Priority } from "@/types/graph";
import { cn } from "@/lib/utils";
import { GitBranch, Plus, Search, X } from "lucide-react";

const PRIORITIES: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const DEFAULT_SCAFFOLD = {
  customerProblem: true,
  prd: true,
  goal: false,
  metric: false,
};

export function ProposeFeatureDialog() {
  const { proposeFeatureOpen, setProposeFeatureOpen, activeProductId } = useUIStore();
  const { setActiveFeatureId } = useWorkspaceStore();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerProblemText, setCustomerProblemText] = useState("");
  const [ownerId, setOwnerId] = useState("person-sarah");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [repoSearch, setRepoSearch] = useState("");
  const [primaryRepo, setPrimaryRepo] = useState(PRODUCT_DEFAULT_REPO);
  const [primaryRepoUrl, setPrimaryRepoUrl] = useState(
    MOCK_REPOS.find((r) => r.fullName === PRODUCT_DEFAULT_REPO)?.url ?? ""
  );
  const [customRepoInput, setCustomRepoInput] = useState("");
  const [showCustomRepo, setShowCustomRepo] = useState(false);
  const [additionalRepos, setAdditionalRepos] = useState<{ fullName: string; url: string }[]>([]);
  const [scaffold, setScaffold] = useState(DEFAULT_SCAFFOLD);
  const [submitting, setSubmitting] = useState(false);

  const filteredRepos = useMemo(() => {
    const q = repoSearch.toLowerCase();
    if (!q) return MOCK_REPOS;
    return MOCK_REPOS.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [repoSearch]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCustomerProblemText("");
    setOwnerId("person-sarah");
    setPriority("MEDIUM");
    setRepoSearch("");
    setPrimaryRepo(PRODUCT_DEFAULT_REPO);
    setPrimaryRepoUrl(
      MOCK_REPOS.find((r) => r.fullName === PRODUCT_DEFAULT_REPO)?.url ?? ""
    );
    setCustomRepoInput("");
    setShowCustomRepo(false);
    setAdditionalRepos([]);
    setScaffold(DEFAULT_SCAFFOLD);
  };

  const selectPrimaryRepo = (fullName: string, url: string) => {
    setPrimaryRepo(fullName);
    setPrimaryRepoUrl(url);
    setAdditionalRepos((prev) => prev.filter((r) => r.fullName !== fullName));
  };

  const applyCustomRepo = () => {
    const parsed = parseCustomRepo(customRepoInput);
    if (!parsed) return;
    selectPrimaryRepo(parsed.fullName, parsed.url);
    setShowCustomRepo(false);
    setCustomRepoInput("");
  };

  const toggleAdditionalRepo = (fullName: string, url: string) => {
    if (fullName === primaryRepo) return;
    setAdditionalRepos((prev) => {
      const exists = prev.some((r) => r.fullName === fullName);
      if (exists) return prev.filter((r) => r.fullName !== fullName);
      return [...prev, { fullName, url }];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);

    const result = graphStore.getState().proposeFeature({
      title: title.trim(),
      description: description.trim() || "New feature proposal",
      customerProblemText: customerProblemText.trim() || undefined,
      ownerId,
      priority,
      primaryRepo,
      primaryRepoUrl,
      additionalRepos,
      scaffold,
      productId: activeProductId,
    });

    setSubmitting(false);
    setProposeFeatureOpen(false);
    resetForm();
    setActiveFeatureId(result.featureId);
    router.push(`/features/${result.featureId}`);
  };

  return (
    <Dialog
      open={proposeFeatureOpen}
      onOpenChange={(open) => {
        setProposeFeatureOpen(open);
        if (!open) resetForm();
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold">Propose Feature</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Instantly adds nodes to the product graph in DRAFT status
          </p>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(90vh-140px)]">
          <form id="propose-feature-form" onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="title">Feature title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Real-time collaboration"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What are we building and why?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {scaffold.customerProblem && (
                <div className="space-y-1.5">
                  <Label htmlFor="problem">Customer problem</Label>
                  <Textarea
                    id="problem"
                    placeholder="What customer pain does this address?"
                    value={customerProblemText}
                    onChange={(e) => setCustomerProblemText(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="owner">Owner</Label>
                <select
                  id="owner"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Primary repository</Label>
                {PRODUCT_DEFAULT_REPO ? (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    Product default: {PRODUCT_DEFAULT_REPO}
                  </Badge>
                ) : null}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search repos..."
                  className="pl-8 h-8 text-xs"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                />
              </div>
              <div className="rounded-md border border-border divide-y divide-border max-h-32 overflow-y-auto">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => selectPrimaryRepo(repo.fullName, repo.url)}
                    className={cn(
                      "w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors",
                      primaryRepo === repo.fullName && "bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium">{repo.fullName}</span>
                      {repo.fullName === PRODUCT_DEFAULT_REPO && (
                        <Badge variant="outline" className="text-[10px] ml-auto">default</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 ml-5">{repo.description}</p>
                  </button>
                ))}
              </div>

              {!showCustomRepo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowCustomRepo(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Paste custom repo URL
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="owner/repo or https://github.com/owner/repo"
                    value={customRepoInput}
                    onChange={(e) => setCustomRepoInput(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={applyCustomRepo}>
                    Add
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowCustomRepo(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {primaryRepo && (
                <p className="text-[10px] text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{primaryRepo}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Also touches (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {MOCK_REPOS.filter((r) => r.fullName !== primaryRepo).map((repo) => {
                  const selected = additionalRepos.some((r) => r.fullName === repo.fullName);
                  return (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => toggleAdditionalRepo(repo.fullName, repo.url)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                        selected
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      {repo.fullName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Graph scaffolding</Label>
              <p className="text-[10px] text-muted-foreground">
                Choose which linked nodes to create automatically
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["customerProblem", "Customer Problem"],
                    ["prd", "PRD"],
                    ["goal", "Goal / OKR"],
                    ["metric", "Success Metric"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={scaffold[key]}
                      onCheckedChange={(checked) =>
                        setScaffold((s) => ({ ...s, [key]: checked === true }))
                      }
                    />
                    <span className="text-xs">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </form>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setProposeFeatureOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="propose-feature-form"
            disabled={!title.trim() || submitting}
          >
            {submitting ? "Creating..." : "Propose & open workspace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
