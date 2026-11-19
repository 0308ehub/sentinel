export type Arm = "control" | "treatment";

export interface Kismet {
  variant(flag: string, visitor: string): Promise<Arm>;
  track(name: string, visitor: string): Promise<void>;
  visitorFrom(cookieHeader: string | null | undefined): { id: string; setCookie: string | null };
  flush(): Promise<void>;
}

export function createKismet(options?: { site?: string; host?: string }): Kismet;
export function visitorId(id: string): string;
export const kismet: Kismet;
