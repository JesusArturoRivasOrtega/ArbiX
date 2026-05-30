import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage before store import
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

import { useTutorialStore, hydrateFromStorage } from "./tutorial.store";

describe("tutorial.store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset store to initial state
    useTutorialStore.setState({
      isActive: false,
      currentStepIndex: 0,
      completed: false,
      skipped: false
    });
  });

  it("starts inactive with step 0, not completed, not skipped", () => {
    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.currentStepIndex).toBe(0);
    expect(state.completed).toBe(false);
    expect(state.skipped).toBe(false);
  });

  it("startTutorial sets isActive to true and resets step to 0", () => {
    useTutorialStore.setState({ currentStepIndex: 5 });
    useTutorialStore.getState().startTutorial();
    expect(useTutorialStore.getState().isActive).toBe(true);
    expect(useTutorialStore.getState().currentStepIndex).toBe(0);
  });

  it("nextStep advances to the next step", () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().nextStep(10);
    expect(useTutorialStore.getState().currentStepIndex).toBe(1);
  });

  it("nextStep on last step closes tutorial and marks completed", () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.setState({ currentStepIndex: 9 });
    useTutorialStore.getState().nextStep(10); // 10 steps total, index 9 = last
    expect(useTutorialStore.getState().isActive).toBe(false);
    expect(useTutorialStore.getState().completed).toBe(true);
  });

  it("previousStep goes back one step", () => {
    useTutorialStore.setState({ currentStepIndex: 3, isActive: true });
    useTutorialStore.getState().previousStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(2);
  });

  it("previousStep does not go below 0", () => {
    useTutorialStore.setState({ currentStepIndex: 0, isActive: true });
    useTutorialStore.getState().previousStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(0);
  });

  it("skipTutorial closes tutorial, sets skipped, saves to localStorage", () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().skipTutorial();
    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.skipped).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "arbix:tutorial:v1",
      JSON.stringify({ completed: false, skipped: true })
    );
  });

  it("completeTutorial closes tutorial, sets completed, saves to localStorage", () => {
    useTutorialStore.getState().startTutorial();
    useTutorialStore.getState().completeTutorial();
    const state = useTutorialStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.completed).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "arbix:tutorial:v1",
      JSON.stringify({ completed: true, skipped: false })
    );
  });

  it("resetTutorial clears state and resets localStorage", () => {
    useTutorialStore.setState({ completed: true, skipped: true, isActive: false, currentStepIndex: 5 });
    useTutorialStore.getState().resetTutorial();
    const state = useTutorialStore.getState();
    expect(state.completed).toBe(false);
    expect(state.skipped).toBe(false);
    expect(state.currentStepIndex).toBe(0);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "arbix:tutorial:v1",
      JSON.stringify({ completed: false, skipped: false })
    );
  });

  it("hydrateFromStorage loads completed and skipped from localStorage", () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ completed: true, skipped: false }));
    hydrateFromStorage();
    expect(useTutorialStore.getState().completed).toBe(true);
    expect(useTutorialStore.getState().skipped).toBe(false);
  });

  it("hydrateFromStorage handles invalid JSON gracefully", () => {
    localStorageMock.getItem.mockReturnValue("not-valid-json");
    expect(() => hydrateFromStorage()).not.toThrow();
    // State should remain with defaults
    expect(useTutorialStore.getState().completed).toBe(false);
  });
});
