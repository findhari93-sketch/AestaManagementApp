"use client";

import { useEffect, useState } from "react";
import { Snackbar, Alert } from "@mui/material";

/**
 * Listens for the global "stale-state-error" event dispatched by
 * QueryProvider's mutation onError handler when a guarded mutation matches
 * 0 rows (StaleStateError). Shows a single friendly toast instead of letting
 * the cryptic PostgREST 406 surface as a generic console error.
 *
 * Mounted once at the layout root so every dialog/page gets the behavior
 * for free — no per-callsite wiring required.
 */
export default function StaleStateSnackbar() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setMessage(
        detail?.message ??
          "This action is no longer available. Refresh the page and try again.",
      );
    };
    window.addEventListener("stale-state-error", handler);
    return () => window.removeEventListener("stale-state-error", handler);
  }, []);

  return (
    <Snackbar
      open={message !== null}
      autoHideDuration={6000}
      onClose={() => setMessage(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity="warning"
        variant="filled"
        onClose={() => setMessage(null)}
        sx={{ width: "100%" }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
