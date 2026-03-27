"use client";

import React from "react";
import { Snackbar, Alert, Button, IconButton, Box, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import GetAppIcon from "@mui/icons-material/GetApp";
import IosShareIcon from "@mui/icons-material/IosShare";
import { usePWA } from "./PWAProvider";

export default function InstallPrompt() {
  const { canInstall, isInstalled, isIOS, promptInstall, dismissInstall, isDismissed } =
    usePWA();

  // Don't show if already installed or dismissed
  if (isInstalled || isDismissed) return null;

  // Android/Desktop: native install prompt available
  if (canInstall) {
    return (
      <Snackbar
        open
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ mb: 2 }}
      >
        <Alert
          severity="info"
          variant="filled"
          icon={<GetAppIcon />}
          action={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Button
                color="inherit"
                size="small"
                onClick={promptInstall}
                sx={{ fontWeight: 600 }}
              >
                Install
              </Button>
              <IconButton
                size="small"
                color="inherit"
                onClick={dismissInstall}
                aria-label="dismiss"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
          sx={{ width: "100%", alignItems: "center" }}
        >
          Install Aesta for a better experience
        </Alert>
      </Snackbar>
    );
  }

  // iOS: manual instructions
  if (isIOS) {
    return (
      <Snackbar
        open
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ mb: 2 }}
      >
        <Alert
          severity="info"
          variant="filled"
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={dismissInstall}
              aria-label="dismiss"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{ width: "100%", alignItems: "center" }}
        >
          <Typography variant="body2" component="div">
            Install Aesta: tap{" "}
            <IosShareIcon sx={{ fontSize: 16, verticalAlign: "middle", mx: 0.5 }} />
            then &quot;Add to Home Screen&quot;
          </Typography>
        </Alert>
      </Snackbar>
    );
  }

  return null;
}
