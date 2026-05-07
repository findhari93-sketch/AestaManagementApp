"use client";

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function InfoRow({
  label,
  value,
  chip,
}: {
  label: string;
  value?: string | number | null;
  chip?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        py: 0.5,
        gap: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {chip ?? (
        <Typography
          variant="body2"
          fontWeight={500}
          sx={{ textAlign: "right", wordBreak: "break-word" }}
        >
          {value === null || value === undefined || value === "" ? "—" : value}
        </Typography>
      )}
    </Box>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{
        fontWeight: 600,
        letterSpacing: 0.5,
        display: "block",
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}
