"use client";

import { useMemo } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeContextProvider, useThemeMode } from "@/contexts/ThemeContext";
import { createAppTheme } from "@/theme/theme";

function ThemeProviderInner({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeContextProvider>
      <ThemeProviderInner>{children}</ThemeProviderInner>
    </ThemeContextProvider>
  );
}
