"use client";

import { IconButton, Tooltip, useTheme } from "@mui/material";
import { LightMode as SunIcon, DarkMode as MoonIcon } from "@mui/icons-material";
import { useThemeMode } from "@/contexts/ThemeContext";

interface ThemeToggleProps {
  size?: "small" | "medium" | "large";
}

export default function ThemeToggle({ size = "medium" }: ThemeToggleProps) {
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();

  const isDark = mode === "dark";

  return (
    <Tooltip title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
      <IconButton
        onClick={toggleTheme}
        size={size}
        sx={{
          color: theme.palette.text.primary,
          transition: "transform 0.3s ease-in-out, color 0.3s ease-in-out",
          "&:hover": {
            transform: "rotate(30deg)",
            bgcolor: theme.palette.action.hover,
          },
        }}
      >
        {isDark ? (
          <SunIcon
            sx={{
              color: "#ffc107",
              transition: "transform 0.3s ease-in-out",
            }}
          />
        ) : (
          <MoonIcon
            sx={{
              color: "#5c6bc0",
              transition: "transform 0.3s ease-in-out",
            }}
          />
        )}
      </IconButton>
    </Tooltip>
  );
}
