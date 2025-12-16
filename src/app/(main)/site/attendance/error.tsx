"use client";

import { useEffect } from "react";
import { Box, Button, Typography, Paper } from "@mui/material";
import { Error as ErrorIcon } from "@mui/icons-material";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Attendance page error:", error);
  }, [error]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
      }}
    >
      <Paper
        sx={{
          p: 4,
          textAlign: "center",
          maxWidth: 400,
        }}
      >
        <ErrorIcon sx={{ fontSize: 48, color: "error.main", mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Something went wrong
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {error.message || "Failed to load attendance data"}
        </Typography>
        <Button variant="contained" onClick={reset}>
          Try again
        </Button>
      </Paper>
    </Box>
  );
}
