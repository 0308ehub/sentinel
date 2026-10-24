"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { notifications as seedNotifications } from "@/lib/data/seed";
import type { Notification } from "@/types/graph";

interface NotificationState {
  items: Notification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: seedNotifications.map((n) => ({ ...n })),

      markAsRead: (id) =>
        set((s) => ({
          items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),

      markAllAsRead: () =>
        set((s) => ({
          items: s.items.map((n) => (n.read ? n : { ...n, read: true })),
        })),

      unreadCount: () => get().items.filter((n) => !n.read).length,
    }),
    {
      name: "kismet-notifications-v2",
      partialize: (s) => ({
        // Persist only read flags keyed by id so new seed items still appear
        items: s.items,
      }),
      merge: (persisted, current) => {
        const p = persisted as { items?: Notification[] } | undefined;
        const saved = p?.items ?? [];
        const savedById = new Map(saved.map((n) => [n.id, n]));
        const items = seedNotifications.map((seed) => {
          const prev = savedById.get(seed.id);
          return prev ? { ...seed, read: prev.read } : { ...seed };
        });
        return { ...current, items };
      },
    }
  )
);
