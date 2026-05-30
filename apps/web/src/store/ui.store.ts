"use client";

import { create } from "zustand";

type UiState = {
  activeReplay: string | null;
  hydrated: boolean;
  setActiveReplay: (scenario: string | null) => void;
  setHydrated: (value: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  activeReplay: null,
  hydrated: false,
  setActiveReplay: (activeReplay) => set({ activeReplay }),
  setHydrated: (hydrated) => set({ hydrated })
}));
