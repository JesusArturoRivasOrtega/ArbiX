"use client";

import { create } from "zustand";

type UiState = {
  activeReplay: string | null;
  hydrated: boolean;
  hydrationStatus: "idle" | "loading" | "ready" | "partial" | "failed";
  hydrationError: string | null;
  setActiveReplay: (scenario: string | null) => void;
  setHydrated: (value: boolean) => void;
  setHydrationStatus: (status: UiState["hydrationStatus"], error?: string | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  activeReplay: null,
  hydrated: false,
  hydrationStatus: "idle",
  hydrationError: null,
  setActiveReplay: (activeReplay) => set({ activeReplay }),
  setHydrated: (hydrated) => set({ hydrated, hydrationStatus: hydrated ? "ready" : "idle", hydrationError: null }),
  setHydrationStatus: (hydrationStatus, hydrationError = null) =>
    set({ hydrationStatus, hydrationError, hydrated: hydrationStatus === "ready" || hydrationStatus === "partial" })
}));
