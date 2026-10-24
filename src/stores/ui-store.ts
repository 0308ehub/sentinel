"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  commandPaletteOpen: boolean;
  notificationPanelOpen: boolean;
  proposeFeatureOpen: boolean;
  chatDockOpen: boolean;
  activeProductId: string;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelHeight: (height: number) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setNotificationPanelOpen: (open: boolean) => void;
  setProposeFeatureOpen: (open: boolean) => void;
  setChatDockOpen: (open: boolean) => void;
  setActiveProductId: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      bottomPanelOpen: true,
      bottomPanelHeight: 240,
      commandPaletteOpen: false,
      notificationPanelOpen: false,
      proposeFeatureOpen: false,
      chatDockOpen: false,
      activeProductId: "product-workspace",
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
      setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setNotificationPanelOpen: (open) => set({ notificationPanelOpen: open }),
      setProposeFeatureOpen: (open) => set({ proposeFeatureOpen: open }),
      setChatDockOpen: (open) => set({ chatDockOpen: open }),
      setActiveProductId: (id) => set({ activeProductId: id }),
    }),
    {
      name: "product-ide-ui",
      version: 2,
      migrate: (persisted) => ({
        ...(persisted as object),
        activeProductId: "product-workspace",
      }),
    }
  )
);

interface WorkspaceState {
  activeFeatureId: string | null;
  leftPanelTab: "problems" | "research" | "support" | "evidence";
  centerPanelTab: "requirements" | "prd" | "goals" | "roadmap";
  rightPanelTab: "engineering" | "github" | "linear" | "figma" | "releases";
  bottomPanelTab: "metrics" | "funnels" | "experiments" | "retention";
  setActiveFeatureId: (id: string | null) => void;
  setLeftPanelTab: (tab: WorkspaceState["leftPanelTab"]) => void;
  setCenterPanelTab: (tab: WorkspaceState["centerPanelTab"]) => void;
  setRightPanelTab: (tab: WorkspaceState["rightPanelTab"]) => void;
  setBottomPanelTab: (tab: WorkspaceState["bottomPanelTab"]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeFeatureId: null,
  leftPanelTab: "problems",
  centerPanelTab: "prd",
  rightPanelTab: "engineering",
  bottomPanelTab: "metrics",
  setActiveFeatureId: (id) => set({ activeFeatureId: id }),
  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setCenterPanelTab: (tab) => set({ centerPanelTab: tab }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
}));
