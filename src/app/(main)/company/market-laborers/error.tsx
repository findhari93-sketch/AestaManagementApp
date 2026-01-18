"use client";

import { useState } from "react";
import { Box, Button, Typography, Alert, Stack } from "@mui/material";
import { Refresh as RefreshIcon, DeleteSweep } from "@mui/icons-material";
import { forceResetAllCache } from "@/lib/cache/persistor";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isClearing, setIsClearing] = useState(false);

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
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="body1" fontWeight={600}>
          Failed to load market laborer rates
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error.message}
        </Typography>
      </Alert>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" startIcon={<RefreshIcon />} onClick={reset}>
          Try Again
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
    </Box>
  );
}
