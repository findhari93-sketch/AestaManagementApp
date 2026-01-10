"use client";

import { useMemo, useEffect } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
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
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <CssBaseline />
        {children}
      </LocalizationProvider>
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
