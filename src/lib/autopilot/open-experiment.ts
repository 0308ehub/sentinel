let openId: string | null = null;
const listeners = new Set<() => void>();

export function getOpenExperiment(): string | null {
  return openId;
}

export function setOpenExperiment(id: string | null) {
  if (openId === id) return;
  openId = id;
  listeners.forEach((listener) => listener());
}

export function subscribeOpenExperiment(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
