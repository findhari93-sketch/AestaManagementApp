"use client";

import { useEffect, useState } from "react";
import { Box, Typography, Button, Paper, Stack } from "@mui/material";
import { ErrorOutline, Refresh, DeleteSweep } from "@mui/icons-material";
import { forceResetAllCache } from "@/lib/cache/persistor";

export default function LaborersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    console.error("Laborers page error:", error);
  }, [error]);

  const handleClearCacheAndRetry = async () => {
    setIsClearing(true);
    try {
      await forceResetAllCache();
      window.location.reload();
    } catch (e) {
      console.error("Failed to clear cache:", e);
      setIsClearing(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
        <ErrorOutline sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Something went wrong
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error.message || "Failed to load laborers data"}
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="contained" onClick={reset} startIcon={<Refresh />}>
            Try again
          </Button>
          <Button
            variant="outlined"
            onClick={handleClearCacheAndRetry}
            startIcon={<DeleteSweep />}
            disabled={isClearing}
          >
            {isClearing ? "Clearing..." : "Clear Cache"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
