// src/contexts/JourneyWatchContext/JourneyWatchProvider.tsx
"use client";

import React, { createContext, useCallback, useState } from "react";

const SESSION_KEY = "journeyWatch:activeId";

interface JourneyWatchState {
  activeJourneyId: string | null;
  isExpanded: boolean;
  activateJourney: (id: string) => void;
  deactivateJourney: () => void;
  setExpanded: (val: boolean) => void;
}

export const JourneyWatchContext = createContext<JourneyWatchState | undefined>(undefined);

export function JourneyWatchProvider({ children }: { children: React.ReactNode }) {
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(SESSION_KEY);
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const activateJourney = useCallback((id: string) => {
    sessionStorage.setItem(SESSION_KEY, id);
    setActiveJourneyId(id);
  }, []);

  const deactivateJourney = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setActiveJourneyId(null);
    setIsExpanded(false);
  }, []);

  const setExpanded = useCallback((val: boolean) => {
    setIsExpanded(val);
  }, []);

  return (
    <JourneyWatchContext.Provider
      value={{ activeJourneyId, isExpanded, activateJourney, deactivateJourney, setExpanded }}
    >
      {children}
    </JourneyWatchContext.Provider>
  );
}
