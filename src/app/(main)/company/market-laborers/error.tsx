"use client";

import { Box, Button, Typography, Alert } from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
      <Button variant="contained" startIcon={<RefreshIcon />} onClick={reset}>
        Try Again
      </Button>
    </Box>
  );
}
