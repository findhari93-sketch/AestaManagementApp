"use client";

import { useState, useEffect } from "react";
import { Box, CircularProgress, Typography, Button, Paper, Stack } from "@mui/material";
import { Refresh, Warning } from "@mui/icons-material";

interface LoadingWithTimeoutProps {
  isLoading: boolean;
  error?: Error | null;
  timeout?: number;
  onRetry?: () => void;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  loadingText?: string;
}

/**
 * A wrapper component that shows loading state with timeout detection.
 * After the timeout, shows a "taking longer than expected" message with retry option.
 */
export function LoadingWithTimeout({
  isLoading,
  error,
  timeout = 15000,
  onRetry,
  children,
  loadingComponent,
  loadingText = "Loading...",
}: LoadingWithTimeoutProps) {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, timeout);

    return () => clearTimeout(timer);
  }, [isLoading, timeout]);

  if (error) {
    return (
      <Paper sx={{ p: 3, textAlign: "center", borderRadius: 2 }}>
        <Warning sx={{ fontSize: 48, color: "error.main", mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Failed to load
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {error.message || "An error occurred while loading data"}
        </Typography>
        {onRetry && (
          <Button variant="contained" startIcon={<Refresh />} onClick={onRetry}>
            Retry
          </Button>
        )}
      </Paper>
    );
  }

  if (isLoading && isTimedOut) {
    return (
      <Paper sx={{ p: 3, textAlign: "center", borderRadius: 2 }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="body1" gutterBottom>
          Taking longer than expected...
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          There might be a connection issue.
        </Typography>
        {onRetry && (
          <Button variant="outlined" startIcon={<Refresh />} onClick={onRetry}>
            Force Refresh
          </Button>
        )}
      </Paper>
    );
  }

  if (isLoading) {
    return (
      loadingComponent || (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 4, gap: 2 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            {loadingText}
          </Typography>
        </Box>
      )
    );
  }

  return <>{children}</>;
}

export default LoadingWithTimeout;
