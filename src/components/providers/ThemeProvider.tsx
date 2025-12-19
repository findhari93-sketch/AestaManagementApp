"use client";

import { useMemo, useEffect } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeContextProvider, useThemeMode } from "@/contexts/ThemeContext";
import { createAppTheme } from "@/theme/theme";

function ThemeProviderInner({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  // Set data attribute for CSS selectors to target dark mode
  useEffect(() => {
    document.documentElement.setAttribute("data-mui-color-scheme", mode);
  }, [mode]);

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
    <AppRouterCacheProvider>
      <ThemeContextProvider>
        <ThemeProviderInner>{children}</ThemeProviderInner>
      </ThemeContextProvider>
    </AppRouterCacheProvider>
  );
}
