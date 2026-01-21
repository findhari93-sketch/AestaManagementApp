"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
type ThemePreference = string;

const STORAGE_KEY = "aesta_theme_preference";

interface ThemeContextType {
  mode: ThemePreference;
  toggleTheme: () => void;
  setTheme: (mode: ThemePreference) => void;
  isSystemPreference: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeContextProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode?: ThemePreference;
}) {
  const [mode, setMode] = useState<ThemePreference>(initialMode || "light");
  const [isSystemPreference, setIsSystemPreference] = useState(false);

  // Initialize theme from localStorage - default to light mode
  useEffect(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;

    if (stored && (stored === "light" || stored === "dark")) {
      setMode(stored);
      setIsSystemPreference(false);
    } else {
      // Default to light mode (not system preference)
      setMode("light");
      setIsSystemPreference(false);
    }
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if using system preference
      if (isSystemPreference) {
        setMode(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [isSystemPreference]);

  const setTheme = useCallback((newMode: ThemePreference) => {
    setMode(newMode);
    setIsSystemPreference(false);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode = mode === "light" ? "dark" : "light";
    setTheme(newMode);
  }, [mode, setTheme]);

  const value = useMemo(
    () => ({
      mode,
      toggleTheme,
      setTheme,
      isSystemPreference,
    }),
    [mode, toggleTheme, setTheme, isSystemPreference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeMode must be used within a ThemeContextProvider");
  }
  return context;
}

export default ThemeContext;
