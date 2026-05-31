"use client";

import { create } from "zustand";
import type { ArbitrageOpportunity } from "@arbix/shared";

type OpportunitiesStore = {
  opportunities: ArbitrageOpportunity[];
  selectedId: string | undefined;
  freshIds: Record<string, number>;
  setOpportunities: (opportunities: ArbitrageOpportunity[]) => void;
  upsertOpportunity: (opportunity: ArbitrageOpportunity) => void;
  markStale: (id: string) => void;
  select: (id?: string) => void;
};

export const useOpportunitiesStore = create<OpportunitiesStore>((set) => ({
  opportunities: [],
  selectedId: undefined,
  freshIds: {},
  setOpportunities: (opportunities) =>
    set((state) => {
      const next = opportunities.slice(0, 60);
      const selectedStillVisible = next.some((opportunity) => opportunity.id === state.selectedId);
      return {
        opportunities: next,
        selectedId: selectedStillVisible ? state.selectedId : next[0]?.id
      };
    }),
  upsertOpportunity: (opportunity) =>
    set((state) => {
      const without = state.opportunities.filter((item) => item.id !== opportunity.id);
      return {
        opportunities: [opportunity, ...without].slice(0, 60),
        selectedId: state.selectedId ?? opportunity.id,
        freshIds: { ...state.freshIds, [opportunity.id]: Date.now() }
      };
    }),
  markStale: (id) =>
    set((state) => {
      if (!(id in state.freshIds)) return state;
      const nextFresh = { ...state.freshIds };
      delete nextFresh[id];
      return { freshIds: nextFresh };
    }),
  select: (selectedId) => set({ selectedId })
}));
