// src/contexts/JourneyWatchContext/index.ts
export { JourneyWatchProvider, JourneyWatchContext } from "./JourneyWatchProvider";

import { useContext } from "react";
import { JourneyWatchContext } from "./JourneyWatchProvider";

export function useJourneyWatch() {
  const ctx = useContext(JourneyWatchContext);
  if (!ctx) throw new Error("useJourneyWatch must be used inside JourneyWatchProvider");
  return ctx;
}
