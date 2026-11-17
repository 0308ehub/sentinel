"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { readDesignDraft, subscribeDesignExternal, writeDesignDraft, type DesignNote } from "@/lib/design/draft";
import {
  cloneScreen,
  designDiff,
  layoutFromUnknown,
  newId,
  screenBrief,
  screenFromClient,
  screenWith,
  type Piece,
  type PieceKind,
  type Screen,
} from "@/lib/design/scene";
import { graphStore } from "@/lib/graph/graph-store";
import { CURRENT_USER } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

interface RepoOption {
  fullName: string;
}

interface FrameOption {
  id: string;
  name: string;
}

type DialogName = "import" | "app" | "figma" | "ship" | null;

export function DesignView() {
  const productId = useUIStore((s) => s.activeProductId);
  const [ready, setReady] = useState(false);
  const [original, setOriginal] = useState<Screen | null>(null);
  const [versions, setVersions] = useState<Screen[]>([]);
  const [activeId, setActiveId] = useState("");
  const [notes, setNotes] = useState<DesignNote[]>([]);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState("");
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [alternates, setAlternates] = useState(false);
  const [pan, setPan] = useState({ x: 80, y: 72 });
  const [zoom, setZoom] = useState(1);

  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [repo, setRepo] = useState("");
  const [repoError, setRepoError] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [file, setFile] = useState("");
  const [filesError, setFilesError] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [appError, setAppError] = useState("");

  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaConnected, setFigmaConnected] = useState(false);
  const [figmaHandle, setFigmaHandle] = useState("");
  const [figmaFile, setFigmaFile] = useState("");
  const [frames, setFrames] = useState<FrameOption[]>([]);
  const [figmaError, setFigmaError] = useState("");
  const [figmaHint, setFigmaHint] = useState("");

  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [metric, setMetric] = useState("");
  const [guardrail, setGuardrail] = useState("");
  const [shipError, setShipError] = useState("");
  const [shipped, setShipped] = useState<{ url: string; number: number; branch: string; experimentId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const originalRef = useRef(original);
  const activeRef = useRef<Screen | null>(null);
  const forkRef = useRef<string | null>(null);
  const draftGeneration = useRef(0);
  panRef.current = pan;
  zoomRef.current = zoom;
  originalRef.current = original;

  const active =
    versions.find((screen) => screen.id === activeId) ?? (original?.id === activeId ? original : null);
  activeRef.current = active;
  const viewingOriginal = Boolean(original && active?.id === original.id);
  const shipTarget = active && original && active.id !== original.id ? active : null;
  const diff = shipTarget && original ? designDiff(original, shipTarget) : "";
  const selectedPiece = active?.pieces.find((piece) => piece.id === selected) ?? null;

  const changePieces = useCallback((mutator: (pieces: Piece[]) => Piece[]) => {
    const base = originalRef.current;
    const current = activeRef.current;
    if (!base || !current) return;
    if (current.id !== base.id) {
      setVersions((list) => list.map((screen) => (screen.id === current.id ? { ...screen, pieces: mutator(screen.pieces) } : screen)));
      return;
    }
    const id = forkRef.current ?? newId("screen");
    forkRef.current = id;
    setVersions((list) => {
      const existing = list.find((screen) => screen.id === id);
      if (existing) return list.map((screen) => (screen.id === id ? { ...screen, pieces: mutator(screen.pieces) } : screen));
      const next = cloneScreen(base, id);
      return [...list, { ...next, pieces: mutator(base.pieces) }];
    });
    setActiveId(id);
  }, []);

  const fit = useCallback((screen: Screen) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    const next = Math.min(1, (rect.width - 96) / screen.width, (rect.height - 120) / screen.height);
    const scale = Math.max(0.25, next);
    const point = { x: (rect.width - screen.width * scale) / 2, y: (rect.height - screen.height * scale) / 2 };
    zoomRef.current = scale;
    panRef.current = point;
    setZoom(scale);
    setPan(point);
  }, []);

  useEffect(() => {
    const apply = () => {
      const saved = readDesignDraft();
      const known = saved.versions.some((screen) => screen.id === saved.activeId) || saved.original?.id === saved.activeId;
      draftGeneration.current += 1;
      forkRef.current = null;
      setOriginal(saved.original);
      setVersions(saved.versions);
      setActiveId(known ? saved.activeId : saved.versions[0]?.id || saved.original?.id || "");
      setNotes(saved.notes);
      setReady(true);
    };
    apply();
    return subscribeDesignExternal(apply);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeDesignDraft({ original, versions, activeId, notes });
  }, [ready, original, versions, activeId, notes]);

  useEffect(() => {
    const screen = activeRef.current;
    if (!screen) return;
    const frame = requestAnimationFrame(() => fit(screen));
    return () => cancelAnimationFrame(frame);
  }, [activeId, fit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const current = zoomRef.current;
      const next = Math.min(2, Math.max(0.25, current * (event.deltaY > 0 ? 0.92 : 1.08)));
      const scale = next / current;
      const point = panRef.current;
      const moved = { x: px - (px - point.x) * scale, y: py - (py - point.y) * scale };
      panRef.current = moved;
      zoomRef.current = next;
      setPan(moved);
      setZoom(next);
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [notes, working]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]")) return;
      if (!selected) return;
      event.preventDefault();
      changePieces((pieces) => pieces.filter((piece) => piece.id !== selected));
      setSelected("");
      setEditing("");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changePieces, selected]);

  useEffect(() => {
    if (dialog !== "app" || !repo) return;
    let cancel = false;
    setLoadingFiles(true);
    setFilesError("");
    void fetch(`/api/design/files?repo=${encodeURIComponent(repo)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as { files?: unknown; hint?: string; error?: string };
        if (!res.ok) throw new Error(body.hint || body.error || "Could not list files.");
        if (cancel) return;
        const list = Array.isArray(body.files) ? body.files.filter((item): item is string => typeof item === "string") : [];
        setFiles(list);
        setFile(list[0] ?? "");
        if (list.length === 0) setFilesError("This repository has no page or component Kismet can place on the canvas.");
      })
      .catch((error: unknown) => {
        if (!cancel) {
          setFiles([]);
          setFilesError(error instanceof Error ? error.message : "Could not list files.");
        }
      })
      .finally(() => {
        if (!cancel) setLoadingFiles(false);
      });
    return () => {
      cancel = true;
    };
  }, [dialog, repo]);

  function show(id: string) {
    forkRef.current = null;
    setActiveId(id);
    setSelected("");
    setEditing("");
  }

  function take(screen: Screen) {
    const workingCopy = cloneScreen(screen, newId("screen"));
    forkRef.current = null;
    setOriginal(screen);
    setVersions([workingCopy]);
    setActiveId(workingCopy.id);
    setSelected("");
    setEditing("");
    setNotes([{ id: newId("note"), role: "assistant", text: `Brought in ${screen.name} from ${screen.sourceLabel}.` }]);
    setDialog(null);
    setAlternates(false);
  }

  async function loadRepos() {
    setBusy(true);
    setRepoError("");
    try {
      const res = await fetch("/api/github/repos", { cache: "no-store" });
      const body = (await res.json()) as { repos?: RepoOption[]; hint?: string; error?: string };
      if (!res.ok) throw new Error(body.hint || body.error || "Could not list repositories.");
      const list = body.repos ?? [];
      setRepos(list);
      setRepo((current) => current || list[0]?.fullName || "");
      if (list.length === 0) setRepoError("This token cannot push to any repository yet.");
    } catch (error) {
      setRepoError(error instanceof Error ? error.message : "Could not list repositories.");
    } finally {
      setBusy(false);
    }
  }

  function openApp() {
    setAppError("");
    setDialog("app");
    if (!repos) void loadRepos();
  }

  async function openFigma() {
    setFigmaError("");
    setFigmaHint("");
    setFrames([]);
    setDialog("figma");
    try {
      const res = await fetch("/api/figma/status", { cache: "no-store" });
      const body = (await res.json()) as { connected?: boolean; handle?: string };
      setFigmaConnected(Boolean(body.connected));
      setFigmaHandle(body.handle || "");
    } catch {
      setFigmaConnected(false);
    }
  }

  async function importAppFile() {
    if (!repo || !file || busy) return;
    setBusy(true);
    setAppError("");
    try {
      const res = await fetch("/api/design/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "app", repo, path: file }),
      });
      const body = (await res.json()) as { screen?: unknown; hint?: string; error?: string };
      if (!res.ok) throw new Error(body.hint || body.error || "Could not import that file.");
      const screen = screenFromClient(body.screen);
      if (!screen) throw new Error("That file did not become a screen.");
      take(screen);
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Could not import that file.");
    } finally {
      setBusy(false);
    }
  }

  async function importFrame(nodeId = "") {
    if (!figmaUrl.trim() || busy) return;
    setBusy(true);
    setFigmaError("");
    try {
      const res = await fetch("/api/design/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "figma", url: figmaUrl.trim(), nodeId, token: figmaToken.trim() }),
      });
      const body = (await res.json()) as {
        screen?: unknown;
        frames?: FrameOption[];
        file?: string;
        saved?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "Could not import that frame.");
      if (body.saved === false) setFigmaHint("The token worked. It could not be saved on this machine, so keep it for this import.");
      if (body.saved) {
        setFigmaToken("");
        setFigmaConnected(true);
      }
      if (body.frames && body.frames.length > 1 && !body.screen) {
        setFigmaFile(body.file || "Figma");
        setFrames(body.frames);
        return;
      }
      const screen = screenFromClient(body.screen);
      if (!screen) throw new Error("That frame did not become a screen.");
      setFrames([]);
      take(screen);
    } catch (error) {
      setFigmaError(error instanceof Error ? error.message : "Could not import that frame.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const ask = draft.trim();
    const base = activeRef.current;
    const origin = originalRef.current;
    const seen = draftGeneration.current;
    if (!ask || !base || !origin || working) return;
    setDraft("");
    setNotes((list) => [...list, { id: newId("note"), role: "user", text: ask }]);
    setWorking(true);
    try {
      const res = await fetch("/api/design/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: ask, selectedId: selected, screen: base }),
      });
      const body = (await res.json()) as { message?: string; makeVariant?: boolean; layout?: unknown; error?: string };
      if (!res.ok) throw new Error(body.error || "Could not change the screen.");
      const layout = layoutFromUnknown(body.layout);
      if (!layout || draftGeneration.current !== seen) return;
      const makeVariant = body.makeVariant === true;
      const id = !makeVariant && base.id !== origin.id ? base.id : newId("screen");
      const next = screenWith(layout, {
        id,
        source: origin.source,
        sourceLabel: origin.sourceLabel,
        repo: origin.repo,
        path: origin.path,
        figmaUrl: origin.figmaUrl,
      });
      setVersions((list) => {
        if (!makeVariant && list.some((screen) => screen.id === id)) return list.map((screen) => (screen.id === id ? next : screen));
        return [...list, next];
      });
      forkRef.current = null;
      setActiveId(id);
      setNotes((list) => [...list, { id: newId("note"), role: "assistant", text: body.message || "Updated the screen." }]);
    } catch (error) {
      setDraft(ask);
      setNotes((list) => [
        ...list,
        { id: newId("note"), role: "assistant", text: error instanceof Error ? error.message : "Could not change the screen." },
      ]);
    } finally {
      setWorking(false);
    }
  }

  function openShip() {
    if (!shipTarget) return;
    setTitle(shipTarget.name);
    setHypothesis("");
    setMetric("");
    setGuardrail("");
    setShipError("");
    setShipped(null);
    setDialog("ship");
    if (shipTarget.repo) setRepo(shipTarget.repo);
    if (!repos) void loadRepos();
  }

  async function fillPlan() {
    if (!shipTarget || busy) return;
    setBusy(true);
    setShipError("");
    try {
      const res = await fetch("/api/experiments/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: screenBrief(shipTarget, diff) }),
      });
      const body = (await res.json()) as { title?: string; hypothesis?: string; metric?: string; guardrail?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "Could not draft the experiment.");
      if (body.title) setTitle(body.title);
      setHypothesis(body.hypothesis || "");
      setMetric(body.metric || "");
      setGuardrail(body.guardrail || "");
    } catch (error) {
      setShipError(error instanceof Error ? error.message : "Could not draft the experiment.");
    } finally {
      setBusy(false);
    }
  }

  async function ship() {
    if (!shipTarget || !original || busy) return;
    if (!repo || !title.trim() || !hypothesis.trim() || !metric.trim() || !guardrail.trim()) return;
    setBusy(true);
    setShipError("");
    try {
      const res = await fetch("/api/experiments/pull-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          title: title.trim(),
          hypothesis: hypothesis.trim(),
          metric: metric.trim(),
          guardrail: guardrail.trim(),
          control: "The screen as imported.",
          treatment: diff.slice(0, 800),
          design: diff,
          path: shipTarget.path,
        }),
      });
      const body = (await res.json()) as { url?: string; number?: number; branch?: string; hint?: string; error?: string };
      if (!res.ok || !body.url || !body.number || !body.branch) {
        throw new Error(body.hint || body.error || "Could not open the branch.");
      }
      const experimentId = graphStore.getState().saveExperiment({
        title: title.trim(),
        hypothesis: hypothesis.trim(),
        metric: metric.trim(),
        control: "The screen as imported.",
        treatment: diff.slice(0, 800),
        guardrail: guardrail.trim(),
        ownerId: CURRENT_USER.id,
        productId,
      });
      graphStore.getState().notePullRequest(experimentId, { url: body.url, number: body.number, repo, branch: body.branch });
      setShipped({ url: body.url, number: body.number, branch: body.branch, experimentId });
      setNotes((list) => [
        ...list,
        { id: newId("note"), role: "assistant", text: `Opened branch ${body.branch} as pull request #${body.number}.` },
      ]);
    } catch (error) {
      setShipError(error instanceof Error ? error.message : "Could not open the branch.");
    } finally {
      setBusy(false);
    }
  }

  function onCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-piece], [data-ui]")) return;
    setSelected("");
    setEditing("");
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = panRef.current;
    function move(ev: PointerEvent) {
      const next = { x: origin.x + ev.clientX - startX, y: origin.y + ev.clientY - startY };
      panRef.current = next;
      setPan(next);
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function beginDrag(event: ReactPointerEvent, piece: Piece) {
    if (event.button !== 0) return;
    const handle = event.currentTarget;
    if (handle instanceof HTMLElement) handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = piece.x;
    const originY = piece.y;
    const seen = draftGeneration.current;
    function place(ev: PointerEvent) {
      if (draftGeneration.current !== seen) return;
      const scale = zoomRef.current || 1;
      const x = originX + (ev.clientX - startX) / scale;
      const y = originY + (ev.clientY - startY) / scale;
      changePieces((pieces) => pieces.map((item) => (item.id === piece.id ? { ...item, x, y } : item)));
    }
    function up(ev: PointerEvent) {
      place(ev);
      window.removeEventListener("pointermove", place);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", place);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className="flex h-72 w-full shrink-0 flex-col border-b border-border bg-background md:h-full md:w-80 md:border-b-0 md:border-r">
        <div className="flex h-12 items-center gap-2 border-b border-border px-3">
          <h1 className="text-sm font-medium">Design</h1>
          <span className="rounded border border-border px-1 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Alpha
          </span>
        </div>
        <div ref={threadRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {active ? "Move a piece, ask for a variant, or change the one you selected." : "Import a screen, then ask for a change."}
            </p>
          )}
          {notes.map((note) => (
            <p key={note.id} className={cn("text-sm", note.role === "user" ? "ml-6 rounded-lg bg-muted px-3 py-2" : "mr-4 text-foreground")}>
              {note.text}
            </p>
          ))}
          {working && <p className="text-sm text-muted-foreground">Working on the screen…</p>}
        </div>
        <form
          className="border-t border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {selectedPiece && <p className="mb-2 text-xs text-muted-foreground">Selected · {selectedPiece.name}</p>}
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={active ? (selectedPiece ? "Change the selected piece" : "Move a piece, or ask for a variant") : "Import a screen first"}
            rows={3}
            disabled={!active || working}
            className="resize-none text-sm"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {active ? (viewingOriginal ? "A change starts a new version." : "Enter to send") : "Import a screen to start."}
            </p>
            <Button type="submit" size="sm" disabled={!active || working || !draft.trim()}>
              Send
            </Button>
          </div>
        </form>
      </aside>

      <div
        ref={canvasRef}
        className="relative min-h-0 min-w-0 flex-1 cursor-grab overflow-hidden touch-none"
        onPointerDown={onCanvasPointerDown}
        style={{
          backgroundColor: "#e6e7eb",
          backgroundImage: "radial-gradient(#c4c6cc 1px, transparent 1px)",
          backgroundSize: `${16 * zoom}px ${16 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {active && (
          <div data-ui className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-1 shadow-sm">
            <span className="max-w-40 truncate px-1.5 text-xs">{active.name}</span>
            <ToolbarButton pressed={alternates} onClick={() => setAlternates((open) => !open)}>
              Alternates
            </ToolbarButton>
            <ToolbarButton onClick={() => setDialog("import")}>Import</ToolbarButton>
            <ToolbarButton onClick={() => fit(active)}>Fit</ToolbarButton>
            <span className="px-1.5 text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button type="button" size="sm" onClick={openShip} disabled={!diff} title={diff ? "Ship this version" : "Change the screen first"}>
              Ship
            </Button>
          </div>
        )}

        {alternates && original && (
          <div data-ui className="absolute right-3 top-14 z-20 w-[22rem] rounded-lg border border-border bg-background p-3 shadow-lg">
            <p className="mb-2 text-xs text-muted-foreground">Alternates</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Thumb screen={original} label="Original" active={active?.id === original.id} onClick={() => show(original.id)} />
              {versions.map((screen, index) => (
                <Thumb
                  key={screen.id}
                  screen={screen}
                  label={versionName(screen, index, original.name)}
                  active={active?.id === screen.id}
                  onClick={() => show(screen.id)}
                />
              ))}
            </div>
          </div>
        )}

        {active && (
          <div
            className="absolute left-0 top-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
          >
            <div
              className="relative bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
              style={{ width: active.width, height: active.height }}
            >
              <p className="absolute -top-6 left-0 max-w-full truncate text-xs text-muted-foreground">
                {viewingOriginal ? "Original" : active.name}
                <span className="ml-2">{active.sourceLabel}</span>
              </p>
              {active.pieces.map((piece) => (
                <PieceBox
                  key={piece.id}
                  piece={piece}
                  selected={piece.id === selected}
                  editing={piece.id === editing}
                  onSelect={() => {
                    setSelected(piece.id);
                    setEditing("");
                  }}
                  onEdit={() => {
                    setSelected(piece.id);
                    setEditing(piece.id);
                  }}
                  onDrag={(event) => beginDrag(event, piece)}
                  onText={(text) => changePieces((pieces) => pieces.map((item) => (item.id === piece.id ? { ...item, text } : item)))}
                  onDone={() => setEditing("")}
                />
              ))}
            </div>
          </div>
        )}

        {!active && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div data-ui className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-sm">
              <p className="text-sm font-medium">Bring in a screen</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A page from your repository, or a frame from Figma. Each piece stays labeled so you can move it.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button type="button" onClick={openApp}>
                  From your app
                </Button>
                <Button type="button" variant="outline" onClick={() => void openFigma()}>
                  From Figma
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialog === "import"} onOpenChange={(open) => setDialog(open ? "import" : null)}>
        <DialogContent>
          <h2 className="text-sm font-medium">Import a screen</h2>
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={openApp}>From your app</Button>
            <Button type="button" variant="outline" onClick={() => void openFigma()}>From Figma</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "app"} onOpenChange={(open) => setDialog(open ? "app" : null)}>
        <DialogContent>
          <h2 className="text-sm font-medium">From your app</h2>
          <p className="text-sm text-muted-foreground">A page or component from the connected repository.</p>
          {repoError && <p className="text-sm text-destructive">{repoError}</p>}
          {repos && repos.length > 0 && (
            <label className="block text-xs text-muted-foreground">
              Repository
              <select value={repo} onChange={(event) => setRepo(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground">
                {repos.map((item) => (
                  <option key={item.fullName} value={item.fullName}>{item.fullName}</option>
                ))}
              </select>
            </label>
          )}
          {files.length > 0 && (
            <label className="block text-xs text-muted-foreground">
              File
              <select value={file} onChange={(event) => setFile(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground">
                {files.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          {loadingFiles && <p className="text-xs text-muted-foreground">Reading the repository…</p>}
          {filesError && <p className="text-sm text-destructive">{filesError}</p>}
          {appError && <p className="text-sm text-destructive">{appError}</p>}
          <div className="flex items-center justify-between gap-2">
            <Link href="/settings/connectors/github" className="text-xs text-muted-foreground hover:text-foreground">GitHub settings</Link>
            <Button type="button" onClick={() => void importAppFile()} disabled={busy || !file}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "figma"} onOpenChange={(open) => setDialog(open ? "figma" : null)}>
        <DialogContent>
          <h2 className="text-sm font-medium">From Figma</h2>
          <p className="text-sm text-muted-foreground">
            {figmaConnected ? `Connected${figmaHandle ? ` as ${figmaHandle}` : ""}. Paste a file or frame link.` : "Paste a file link. A personal access token is under Figma → Settings → Security."}
          </p>
          {!figmaConnected && (
            <label className="block text-xs text-muted-foreground">
              Token
              <input
                type="password"
                value={figmaToken}
                onChange={(event) => setFigmaToken(event.target.value)}
                autoComplete="off"
                className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
              />
            </label>
          )}
          <label className="block text-xs text-muted-foreground">
            File link
            <input
              value={figmaUrl}
              onChange={(event) => {
                setFigmaUrl(event.target.value);
                setFrames([]);
              }}
              placeholder="https://www.figma.com/design/…"
              className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            />
          </label>
          {frames.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              <p className="text-xs text-muted-foreground">Frames in {figmaFile}</p>
              {frames.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => void importFrame(frame.id)}
                >
                  {frame.name}
                </button>
              ))}
            </div>
          )}
          {figmaHint && <p className="text-xs text-muted-foreground">{figmaHint}</p>}
          {figmaError && <p className="text-sm text-destructive">{figmaError}</p>}
          <div className="flex justify-end">
            <Button type="button" onClick={() => void importFrame()} disabled={busy || !figmaUrl.trim()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {frames.length > 0 ? "Import the link" : "Import"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "ship"} onOpenChange={(open) => setDialog(open ? "ship" : null)}>
        <DialogContent>
          <h2 className="text-sm font-medium">Ship this design</h2>
          {shipped ? (
            <div className="space-y-2 text-sm">
              <p>Branch <span className="font-mono text-xs">{shipped.branch}</span> is open as pull request #{shipped.number}.</p>
              <p>
                <a href={shipped.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open the pull request</a>
                <span className="text-muted-foreground"> · </span>
                <Link href={`/experiments/${shipped.experimentId}`} className="text-brand hover:underline">Open the experiment</Link>
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {shipTarget?.path ? `Kismet edits ${shipTarget.path} on a new branch.` : "Kismet edits one file on a new branch."} The layout stays off until the experiment flag is on.
              </p>
              <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs">{diff}</pre>
              <label className="block text-xs text-muted-foreground">
                Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground" />
              </label>
              <label className="block text-xs text-muted-foreground">
                Hypothesis
                <Textarea value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} rows={2} className="mt-1 text-sm" />
              </label>
              <label className="block text-xs text-muted-foreground">
                Metric
                <input value={metric} onChange={(event) => setMetric(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground" />
              </label>
              <label className="block text-xs text-muted-foreground">
                Guardrail
                <input value={guardrail} onChange={(event) => setGuardrail(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground" />
              </label>
              {repos && repos.length > 0 && (
                <label className="block text-xs text-muted-foreground">
                  Repository
                  <select value={repo} onChange={(event) => setRepo(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground">
                    {repos.map((item) => (
                      <option key={item.fullName} value={item.fullName}>{item.fullName}</option>
                    ))}
                  </select>
                </label>
              )}
              {repoError && <p className="text-sm text-destructive">{repoError}</p>}
              {shipError && <p className="text-sm text-destructive">{shipError}</p>}
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => void fillPlan()} disabled={busy}>
                  Fill from this design
                </button>
                <Button
                  type="button"
                  onClick={() => void ship()}
                  disabled={busy || !repo || !title.trim() || !hypothesis.trim() || !metric.trim() || !guardrail.trim()}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Open branch
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PieceBox({
  piece,
  selected,
  editing,
  onSelect,
  onEdit,
  onDrag,
  onText,
  onDone,
}: {
  piece: Piece;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDrag: (event: ReactPointerEvent) => void;
  onText: (text: string) => void;
  onDone: () => void;
}) {
  return (
    <div
      data-piece
      role="button"
      tabIndex={0}
      aria-label={piece.name}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (editing) return;
        onSelect();
        onDrag(event);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
      className={cn("absolute", selected && "z-10", pieceClass(piece.kind))}
      style={{
        left: piece.x,
        top: piece.y,
        width: piece.w,
        height: piece.h,
        boxShadow: selected ? "0 0 0 1.5px var(--primary)" : undefined,
      }}
    >
      {selected && (
        <span className="pointer-events-none absolute -top-5 left-0 z-10 max-w-[160px] truncate rounded border border-border bg-background px-1 text-[10px] text-muted-foreground">
          {piece.name}
        </span>
      )}
      {editing ? (
        <input
          autoFocus
          value={piece.text}
          aria-label={`${piece.name} text`}
          onChange={(event) => onText(event.target.value)}
          onBlur={onDone}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") onDone();
          }}
          className="h-full w-full bg-transparent px-1 text-xs outline-none"
        />
      ) : (
        <span className={cn("max-w-full", piece.kind === "card" ? "line-clamp-3" : "truncate")}>{piece.text}</span>
      )}
    </div>
  );
}

function Thumb({ screen, label, active, onClick }: { screen: Screen; label: string; active: boolean; onClick: () => void }) {
  const scale = 104 / screen.width;
  return (
    <button type="button" onClick={onClick} className="w-[104px] shrink-0 text-left">
      <span className={cn("relative block h-[72px] overflow-hidden rounded-md border bg-[#f4f5f7]", active ? "border-primary" : "border-border")}>
        <span className="absolute left-0 top-0 bg-white" style={{ width: screen.width, height: screen.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {screen.pieces.map((piece) => (
            <span key={piece.id} className={cn("absolute", pieceClass(piece.kind))} style={{ left: piece.x, top: piece.y, width: piece.w, height: piece.h }} />
          ))}
        </span>
      </span>
      <span className="mt-1 block truncate text-[11px] text-muted-foreground">{label}</span>
    </button>
  );
}

function ToolbarButton({ children, onClick, pressed }: { children: string; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("rounded-md px-2 py-1 text-xs hover:bg-muted", pressed && "bg-muted")}
    >
      {children}
    </button>
  );
}

function versionName(screen: Screen, index: number, originalName: string): string {
  if (screen.name && screen.name !== originalName) return screen.name;
  return index === 0 ? "Current" : `Variant ${index + 1}`;
}

function pieceClass(kind: PieceKind): string {
  if (kind === "button") return "grid cursor-move place-items-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground";
  if (kind === "text") return "flex cursor-move items-center px-1 text-sm text-foreground";
  if (kind === "input") return "flex cursor-move items-center rounded-md border border-border bg-background px-2 text-xs text-muted-foreground";
  if (kind === "image") return "cursor-move rounded-md bg-muted";
  if (kind === "row") return "flex cursor-move items-center rounded-md border border-border bg-background px-2 text-xs";
  return "flex cursor-move items-start rounded-lg border border-border bg-background p-2 text-xs shadow-sm";
}

