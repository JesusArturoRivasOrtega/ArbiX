"use client";

import { create } from "zustand";

type TutorialStore = {
  isActive: boolean;
  currentStepIndex: number;
  completed: boolean;
  skipped: boolean;
  startTutorial: () => void;
  nextStep: (totalSteps: number) => void;
  previousStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
};

const LS_KEY = "arbix:tutorial:v1";

function readLS(): { completed?: boolean; skipped?: boolean } {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as { completed?: boolean; skipped?: boolean };
  } catch {
    return {};
  }
}

function writeLS(data: { completed: boolean; skipped: boolean }) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export const useTutorialStore = create<TutorialStore>((set) => ({
  isActive: false,
  currentStepIndex: 0,
  completed: false,
  skipped: false,
  startTutorial: () => set({ isActive: true, currentStepIndex: 0, skipped: false }),
  nextStep: (totalSteps: number) =>
    set((state) => {
      const next = state.currentStepIndex + 1;
      if (next >= totalSteps) {
        writeLS({ completed: true, skipped: false });
        return { isActive: false, completed: true, currentStepIndex: 0 };
      }
      return { currentStepIndex: next };
    }),
  previousStep: () =>
    set((state) => ({ currentStepIndex: Math.max(0, state.currentStepIndex - 1) })),
  skipTutorial: () => {
    writeLS({ completed: false, skipped: true });
    set({ isActive: false, skipped: true });
  },
  completeTutorial: () => {
    writeLS({ completed: true, skipped: false });
    set({ isActive: false, completed: true });
  },
  resetTutorial: () => {
    writeLS({ completed: false, skipped: false });
    set({ isActive: false, completed: false, skipped: false, currentStepIndex: 0 });
  },
}));

export function hydrateFromStorage() {
  const { completed, skipped } = readLS();
  useTutorialStore.setState({
    completed: completed ?? false,
    skipped: skipped ?? false,
  });
}
