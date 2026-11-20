"use client";

import type { GooglePickerSession } from "@/lib/google/types";

interface PickerDoc {
  id: string;
  name?: string;
}

interface PickerResponse {
  action: string;
  docs?: PickerDoc[];
}

interface PickerBuilder {
  addView(view: unknown): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setOrigin(origin: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(callback: (response: PickerResponse) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

interface PickerApi {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId: string) => { setIncludeFolders(on: boolean): unknown; setMode(mode: string): unknown };
  ViewId: { DOCUMENTS: string };
  DocsViewMode: { LIST: string };
  Feature: { MULTISELECT_ENABLED: string; SUPPORT_DRIVES: string };
  Action: { PICKED: string; CANCEL: string };
}

declare global {
  interface Window {
    gapi?: { load(name: string, callback: () => void): void };
    google?: { picker?: PickerApi };
  }
}

let loading: Promise<PickerApi> | null = null;

function loadPicker(): Promise<PickerApi> {
  if (window.google?.picker) return Promise.resolve(window.google.picker);
  loading ??= new Promise<PickerApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load the Google Picker."));
    };
    script.onload = () => {
      window.gapi?.load("picker", () => {
        if (window.google?.picker) resolve(window.google.picker);
        else reject(new Error("Could not load the Google Picker."));
      });
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Opens Google's file chooser. Docs picked there become readable by Kismet; nothing else in Drive does. */
export async function pickGoogleDocs(): Promise<PickerDoc[]> {
  const res = await fetch("/api/google/picker", { cache: "no-store" });
  const session = (await res.json()) as GooglePickerSession & { error?: string };
  if (!res.ok) throw new Error(session.error ?? "Could not open the Google Picker.");
  const picker = await loadPicker();
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCUMENTS);
    view.setIncludeFolders(false);
    view.setMode(picker.DocsViewMode.LIST);
    new picker.PickerBuilder()
      .addView(view)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .enableFeature(picker.Feature.SUPPORT_DRIVES)
      .setOAuthToken(session.accessToken)
      .setDeveloperKey(session.apiKey)
      .setAppId(session.appId)
      .setOrigin(window.location.origin)
      .setTitle("Choose docs for Kismet to read")
      .setCallback((response) => {
        if (response.action === picker.Action.PICKED) resolve(response.docs ?? []);
        else if (response.action === picker.Action.CANCEL) resolve([]);
      })
      .build()
      .setVisible(true);
  });
}
