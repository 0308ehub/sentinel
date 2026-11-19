export type Arm = "control" | "treatment";

export interface BrowserKismet {
  visitor: string;
  ready: Promise<void>;
  variant(flag: string): Arm;
  track(name: string): void;
}

export function loadKismet(options: { site: string; host?: string }): Promise<BrowserKismet | null>;
export function variant(flag: string): Arm;
export function track(name: string): void;
