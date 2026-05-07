"use client";

import { useCallback, useState } from "react";

export type InspectStackEntry =
  | { kind: "material"; id: string; title: string }
  | { kind: "vendor"; id: string; title: string };

export function useInspectStack() {
  const [stack, setStack] = useState<InspectStackEntry[]>([]);

  const top = stack[stack.length - 1] || null;
  const trail = stack.slice(0, -1);

  const openRoot = useCallback((entry: InspectStackEntry) => {
    setStack([entry]);
  }, []);

  const push = useCallback((entry: InspectStackEntry) => {
    setStack((s) => [...s, entry]);
  }, []);

  const popTo = useCallback((index: number) => {
    setStack((s) => s.slice(0, index + 1));
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const close = useCallback(() => {
    setStack([]);
  }, []);

  return { stack, top, trail, openRoot, push, popTo, back, close };
}
