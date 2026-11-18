"use client";

export type GitHubInstallStatus = "connected" | "pending" | "error";

export function openGitHubInstall(
  returnPath: string,
  onDone: (status: GitHubInstallStatus, error?: string) => void,
  options: { install?: boolean } = {},
): () => void {
  // Default: sign in with GitHub and connect existing installations. install: open the install/configure page.
  const target = options.install ? "&target=install" : "";
  const installUrl = `/api/github/app/install?popup=1${target}&return=${encodeURIComponent(returnPath)}`;
  const width = 1020;
  const height = 760;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const popup = window.open(
    installUrl,
    "kismet-github",
    `popup,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`,
  );
  if (!popup) {
    window.location.href = `/api/github/app/install?${target.slice(1)}${target ? "&" : ""}return=${encodeURIComponent(returnPath)}`;
    return () => undefined;
  }

  let finished = false;
  const cleanup = () => {
    window.removeEventListener("message", receive);
    window.clearInterval(closedPoll);
  };
  const finish = (status: GitHubInstallStatus, error?: string) => {
    if (finished) return;
    finished = true;
    cleanup();
    onDone(status, error);
  };
  const receive = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== "kismet-github") return;
    const status = event.data.status;
    if (status === "connected" || status === "pending" || status === "error") finish(status, event.data.error);
  };
  window.addEventListener("message", receive);
  const closedPoll = window.setInterval(() => {
    if (popup.closed) finish("error", "popup_closed");
  }, 500);
  return cleanup;
}
