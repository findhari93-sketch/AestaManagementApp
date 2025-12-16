"use client";

import { useEffect } from "react";
import { Box, Typography, Button, Paper } from "@mui/material";
import { ErrorOutline, Refresh } from "@mui/icons-material";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
        <ErrorOutline sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Something went wrong
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error.message || "Failed to load dashboard data"}
        </Typography>
        <Button variant="contained" onClick={reset} startIcon={<Refresh />}>
          Try again
        </Button>
      </Paper>
    </Box>
  );
}
