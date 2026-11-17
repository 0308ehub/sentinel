"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import {
  ROLES,
  isOnboardingStep,
  readOnboarding,
  writeOnboarding,
  type OnboardingDraft,
  type OnboardingStep,
} from "@/lib/onboarding";
import { useAccount } from "@/lib/auth/use-account";
import { cn } from "@/lib/utils";

const LEGACY_STEPS: Record<string, OnboardingStep> = {
  company: "you",
  goals: "github",
  database: "github",
  connect: "evidence",
  organize: "evidence",
  tour: "evidence",
};

export function OnboardingFlow({ step }: { step: string }) {
  const router = useRouter();
  const account = useAccount();
  const [draft, setDraft] = useState<OnboardingDraft>(readOnboarding);

  useEffect(() => {
    const saved = readOnboarding();
    if (account && (!saved.name || !saved.email)) {
      void Promise.resolve().then(() => {
        const next = writeOnboarding({
          started: true,
          name: saved.name || account.name,
          email: saved.email || account.email,
        });
        setDraft(next);
      });
    }
    if (!isOnboardingStep(step)) {
      router.replace(`/onboarding/${LEGACY_STEPS[step] ?? saved.step}`);
      return;
    }
  }, [account, router, step]);

  if (!isOnboardingStep(step)) return <div className="min-h-screen bg-white" />;

  function save(patch: Partial<OnboardingDraft>) {
    const next = writeOnboarding(patch);
    setDraft(next);
  }

  function go(next: OnboardingStep, patch?: Partial<OnboardingDraft>) {
    save({ ...patch, step: next });
    router.push(`/onboarding/${next}`);
  }

  if (step === "you") {
    return <YouStep draft={draft} setDraft={setDraft} onNext={() => go("github", profilePatch(draft))} />;
  }
  if (step === "github") {
    return <GitHubStep onBack={() => go("you")} onNext={() => go("evidence")} />;
  }
  return (
    <EvidenceStep
      onBack={() => go("github")}
      onFinish={() => {
        writeOnboarding({ completed: true, step: "evidence" });
        void fetch("/api/autopilot/tick", { method: "POST", keepalive: true }).catch(() => undefined);
        router.push("/experiments");
      }}
    />
  );
}

function profilePatch(draft: OnboardingDraft): Partial<OnboardingDraft> {
  return { name: draft.name.trim(), role: draft.role, company: draft.company.trim() };
}

function YouStep({
  draft,
  setDraft,
  onNext,
}: {
  draft: OnboardingDraft;
  setDraft: (draft: OnboardingDraft) => void;
  onNext: () => void;
}) {
  return (
    <OnboardingShell
      step="you"
      title="Tell Kismet about you"
      description="A few basics to set up your product workspace."
      nextDisabled={!draft.name.trim() || !draft.role || !draft.company.trim()}
      onNext={onNext}
    >
      <Field label="Name">
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className={inputClass}
          autoFocus
        />
      </Field>
      <Field label="Role" className="mt-5">
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((role) => (
            <Choice key={role} selected={draft.role === role} onClick={() => setDraft({ ...draft, role })} label={role} />
          ))}
        </div>
      </Field>
      <Field label="Company name" className="mt-5">
        <input
          value={draft.company}
          onChange={(event) => setDraft({ ...draft, company: event.target.value })}
          className={inputClass}
          placeholder="Acme"
        />
      </Field>
    </OnboardingShell>
  );
}

interface GitHubRepo {
  fullName: string;
}

function GitHubStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [connected, setConnected] = useState(false);
  const [login, setLogin] = useState("");
  const [token, setToken] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadGitHub().then((result) => {
      if (cancelled) return;
      setConnected(result.connected);
      setLogin(result.login);
      setRepos(result.repos);
      setRepo(result.repo);
      setError(result.error);
      setBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const body = await requestJson<{ connected?: boolean; login?: string; error?: string }>("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!body.connected) throw new Error(body.error || "Could not connect GitHub.");
      const repoBody = await requestJson<{ repos?: GitHubRepo[]; error?: string }>("/api/github/repos");
      if (repoBody.error) throw new Error(repoBody.error);
      setConnected(true);
      setLogin(body.login ?? "");
      setRepos(repoBody.repos ?? []);
      setToken("");
    } catch (caught) {
      setError(errorMessage(caught, "Could not connect GitHub."));
    } finally {
      setBusy(false);
    }
  }

  async function chooseRepo(value: string) {
    setRepo(value);
    setError("");
    if (!value) return;
    setBusy(true);
    try {
      const body = await requestJson<{ repo?: string; error?: string }>("/api/autopilot/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: value }),
      });
      if (!body.repo) throw new Error(body.error || "Could not save the repository.");
      setRepo(body.repo);
    } catch (caught) {
      setRepo("");
      setError(errorMessage(caught, "Could not save the repository."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingShell
      step="github"
      title="Connect GitHub"
      description="Kismet opens pull requests on your repository."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!repo || busy}
    >
      {connected ? (
        <RepoChoice login={login} repos={repos} repo={repo} busy={busy} onChange={(value) => void chooseRepo(value)} />
      ) : (
        <GitHubToken token={token} busy={busy} onChange={setToken} onConnect={() => void connect()} />
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
      <button type="button" onClick={onNext} className={skipClass}>Skip for now</button>
    </OnboardingShell>
  );
}

async function loadGitHub() {
  try {
    const status = await requestJson<{ connected?: boolean; login?: string }>("/api/github/status");
    if (!status.connected) return { connected: false, login: "", repos: [], repo: "", error: "" };
    const [repoList, selected] = await Promise.all([
      requestJson<{ repos?: GitHubRepo[]; error?: string }>("/api/github/repos"),
      requestJson<{ repo?: string }>("/api/autopilot/repo"),
    ]);
    return {
      connected: true,
      login: status.login ?? "",
      repos: repoList.repos ?? [],
      repo: selected.repo ?? "",
      error: repoList.error ?? "",
    };
  } catch (caught) {
    return { connected: false, login: "", repos: [], repo: "", error: errorMessage(caught, "Could not load GitHub.") };
  }
}

function GitHubToken({
  token,
  busy,
  onChange,
  onConnect,
}: {
  token: string;
  busy: boolean;
  onChange: (value: string) => void;
  onConnect: () => void;
}) {
  return (
    <>
      <Field label="Personal access token">
        <input
          type="password"
          value={token}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
          placeholder="github_pat_…"
          autoComplete="off"
        />
      </Field>
      <p className="mt-3 text-sm leading-relaxed text-[#5c6570]">
        <a
          href="https://github.com/settings/personal-access-tokens/new"
          target="_blank"
          rel="noreferrer"
          className="text-[#0571d3] underline underline-offset-2 focus-visible:outline focus-visible:outline-2"
        >
          Create a fine-grained token
        </a>{" "}
        with Contents read/write, Pull requests read/write, Commit statuses read, Checks read, and Metadata read.
      </p>
      <button type="button" onClick={onConnect} disabled={busy || !token.trim()} className={primaryClass}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Connect GitHub
      </button>
    </>
  );
}

function RepoChoice({
  login,
  repos,
  repo,
  busy,
  onChange,
}: {
  login: string;
  repos: GitHubRepo[];
  repo: string;
  busy: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[#e6e8ec] p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-[#0571d3]" />Connected{login ? ` as ${login}` : ""}</p>
      <Field label="Repository Kismet ships to" className="mt-4">
        <select value={repo} onChange={(event) => onChange(event.target.value)} disabled={busy} className={inputClass}>
          <option value="">Choose a repository</option>
          {repos.map((item) => <option key={item.fullName} value={item.fullName}>{item.fullName}</option>)}
        </select>
      </Field>
    </div>
  );
}

function EvidenceStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const searchParams = useSearchParams();
  const [slackConnected, setSlackConnected] = useState(false);
  const [jiraConnected, setJiraConnected] = useState(false);
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [savedPoints, setSavedPoints] = useState(0);
  const [slackTeam, setSlackTeam] = useState("");
  const [jiraSite, setJiraSite] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      requestJson<{ connected?: boolean; team?: string }>("/api/slack/status").catch(
        (): { connected?: boolean; team?: string } => ({}),
      ),
      requestJson<{ connected?: boolean; siteName?: string }>("/api/jira/status").catch(
        (): { connected?: boolean; siteName?: string } => ({}),
      ),
      requestJson<{ available?: boolean }>("/api/slack/oauth/available").catch(
        (): { available?: boolean } => ({}),
      ),
    ]).then(([slack, jira, oauth]) => {
      if (cancelled) return;
      setSlackConnected(Boolean(slack.connected));
      setSlackTeam(slack.team ?? "");
      setJiraConnected(Boolean(jira.connected));
      setJiraSite(jira.siteName ?? "");
      setOauthAvailable(Boolean(oauth.available));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = slackConnected || jiraConnected || savedPoints > 0;
  const slackError = searchParams.get("slack_error");
  return (
    <OnboardingShell
      step="evidence"
      title="Where do customer problems show up?"
      description="Connect an evidence source now, or add one later in Settings."
      onBack={onBack}
      onNext={onFinish}
      nextLabel={ready ? "Start Kismet" : "Skip for now"}
    >
      <div className="space-y-3">
        <SlackOption
          connected={slackConnected}
          team={slackTeam}
          oauthAvailable={oauthAvailable}
          oauthError={slackError}
          onConnected={(team) => { setSlackConnected(true); setSlackTeam(team); }}
        />
        <JiraOption connected={jiraConnected} site={jiraSite} onConnected={(site) => { setJiraConnected(true); setJiraSite(site); }} />
        <ContextOption saved={savedPoints} onSaved={setSavedPoints} />
      </div>
    </OnboardingShell>
  );
}

function SlackOption({
  connected,
  team,
  oauthAvailable,
  oauthError,
  onConnected,
}: {
  connected: boolean;
  team: string;
  oauthAvailable: boolean;
  oauthError: string | null;
  onConnected: (team: string) => void;
}) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const body = await requestJson<{ connected?: boolean; team?: string; error?: string }>("/api/slack/connect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      if (!body.connected) throw new Error(body.error || "Could not connect Slack.");
      onConnected(body.team ?? "");
      setToken("");
    } catch (caught) {
      setError(errorMessage(caught, "Could not connect Slack."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <EvidenceCard title="Slack" connected={connected} detail={team}>
      {oauthAvailable && !showToken ? (
        <>
          <a href="/api/slack/oauth/start?return=/onboarding/evidence" className={primaryClass}>Add to Slack</a>
          <button type="button" onClick={() => setShowToken(true)} className={skipClass}>Use a bot token instead</button>
        </>
      ) : (
        <>
          <Field label="Bot User OAuth Token">
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="xoxb-…" className={inputClass} autoComplete="off" />
          </Field>
          <p className={helpClass}>Create a Slack app, add bot scopes channels:history, channels:read, and users:read, install it, copy the Bot User OAuth Token, then invite the bot to channels.</p>
          <ConnectButton busy={busy} disabled={!token.trim()} onClick={() => void connect()}>Connect Slack</ConnectButton>
        </>
      )}
      {oauthError ? <p role="alert" className="mt-2 text-sm text-red-600">Slack could not connect ({oauthError}).</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-600">{error}</p> : null}
    </EvidenceCard>
  );
}

function ContextOption({ saved, onSaved }: { saved: number; onSaved: (count: number) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const body = await requestJson<{ saved?: number; error?: string }>("/api/autopilot/context", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      if (typeof body.saved !== "number") throw new Error(body.error || "Could not save your context.");
      onSaved(body.saved);
      setText("");
    } catch (caught) {
      setError(errorMessage(caught, "Could not save your context."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <EvidenceCard title="Or tell Kismet in your own words" connected={saved > 0} detail={saved ? `Saved ${saved} points` : ""}>
      <Field label="Product and customer context">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="What your product does and what customers complain about or ask for"
          className={cn(inputClass, "h-32 py-3")}
          maxLength={8000}
        />
      </Field>
      <ConnectButton busy={busy} disabled={text.trim().length < 20} onClick={() => void save()}>Save context</ConnectButton>
      {error ? <p role="alert" className="mt-2 text-sm text-red-600">{error}</p> : null}
    </EvidenceCard>
  );
}

function JiraOption({ connected, site, onConnected }: { connected: boolean; site: string; onConnected: (site: string) => void }) {
  const [fields, setFields] = useState({ baseUrl: "", email: "", apiToken: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const body = await requestJson<{ connected?: boolean; siteName?: string; error?: string }>("/api/jira/connect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
      });
      if (!body.connected) throw new Error(body.error || "Could not connect Jira.");
      onConnected(body.siteName ?? "");
      setFields({ baseUrl: "", email: "", apiToken: "" });
    } catch (caught) {
      setError(errorMessage(caught, "Could not connect Jira."));
    } finally {
      setBusy(false);
    }
  }

  const ready = fields.baseUrl.trim() && fields.email.trim() && fields.apiToken.trim();
  return (
    <EvidenceCard title="Jira" connected={connected} detail={site}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Site URL"><input value={fields.baseUrl} onChange={(event) => setFields({ ...fields, baseUrl: event.target.value })} placeholder="https://company.atlassian.net" className={inputClass} /></Field>
        <Field label="Email"><input type="email" value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} className={inputClass} /></Field>
      </div>
      <Field label="API token" className="mt-3"><input type="password" value={fields.apiToken} onChange={(event) => setFields({ ...fields, apiToken: event.target.value })} className={inputClass} autoComplete="off" /></Field>
      <ConnectButton busy={busy} disabled={!ready} onClick={() => void connect()}>Connect Jira</ConnectButton>
      {error ? <p role="alert" className="mt-2 text-sm text-red-600">{error}</p> : null}
    </EvidenceCard>
  );
}

function EvidenceCard({ title, connected, detail, children }: { title: string; connected: boolean; detail: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e6e8ec] p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        {connected ? <span className="flex items-center gap-1 text-sm text-[#0571d3]"><Check className="h-4 w-4" />Connected{detail ? ` · ${detail}` : ""}</span> : null}
      </div>
      {!connected ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function ConnectButton({ busy, disabled, onClick, children }: { busy: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} disabled={busy || disabled} className={primaryClass}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{children}</button>;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  return response.json() as Promise<T>;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn("block", className)}><span className="mb-2 block text-sm text-[#5c6570]">{label}</span>{children}</label>;
}

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2", selected ? "border-[#111] bg-[#f7f8fa]" : "border-[#e6e8ec] hover:bg-[#fafbfc]")}>
      <span>{label}</span>{selected ? <Check className="h-4 w-4" /> : null}
    </button>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-[#e6e8ec] bg-white px-3 text-sm outline-none focus-visible:border-[#111] focus-visible:ring-2 focus-visible:ring-[#111]/20";
const primaryClass = "mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-[#111] px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-30";
const skipClass = "mt-5 text-sm text-[#5c6570] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2";
const helpClass = "mt-2 text-xs leading-relaxed text-[#5c6570]";
