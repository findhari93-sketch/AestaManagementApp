// src/contexts/JourneyWatchContext/JourneyWatchProvider.test.tsx
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { JourneyWatchProvider } from "./JourneyWatchProvider";
import { useJourneyWatch } from "./index";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <JourneyWatchProvider>{children}</JourneyWatchProvider>
);

beforeEach(() => {
  sessionStorage.clear();
});

describe("JourneyWatchContext", () => {
  it("starts with no active journey", () => {
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    expect(result.current.activeJourneyId).toBeNull();
    expect(result.current.isExpanded).toBe(false);
  });

  it("activateJourney sets id and persists to sessionStorage", () => {
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    act(() => result.current.activateJourney("MR-TEST-001"));
    expect(result.current.activeJourneyId).toBe("MR-TEST-001");
    expect(sessionStorage.getItem("journeyWatch:activeId")).toBe("MR-TEST-001");
  });

  it("deactivateJourney clears id and sessionStorage", () => {
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    act(() => result.current.activateJourney("MR-TEST-001"));
    act(() => result.current.deactivateJourney());
    expect(result.current.activeJourneyId).toBeNull();
    expect(sessionStorage.getItem("journeyWatch:activeId")).toBeNull();
  });

  it("setExpanded updates isExpanded", () => {
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    act(() => result.current.setExpanded(true));
    expect(result.current.isExpanded).toBe(true);
    act(() => result.current.setExpanded(false));
    expect(result.current.isExpanded).toBe(false);
  });

  it("reads activeJourneyId from sessionStorage on mount", () => {
    sessionStorage.setItem("journeyWatch:activeId", "MR-RESTORED-001");
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    expect(result.current.activeJourneyId).toBe("MR-RESTORED-001");
  });
});
