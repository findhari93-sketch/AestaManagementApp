"use client";

import React from "react";
import { Alert, AlertTitle, Button } from "@mui/material";
import Link from "next/link";

export interface JourneyBlockerBannerProps {
  what: string;
  why: string;
  actionLabel?: string;
  actionHref?: string;
}

export function JourneyBlockerBanner({
  what,
  why,
  actionLabel,
  actionHref,
}: JourneyBlockerBannerProps) {
  return (
    <Alert
      severity="error"
      sx={{ borderRadius: 2, fontSize: "0.8rem" }}
      action={
        actionLabel && actionHref ? (
          <Button
            component={Link}
            href={actionHref}
            size="small"
            color="error"
            variant="outlined"
            sx={{ fontSize: "0.72rem", textTransform: "none", whiteSpace: "nowrap" }}
          >
            {actionLabel}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle sx={{ fontSize: "0.82rem", fontWeight: 700 }}>{what}</AlertTitle>
      {why}
    </Alert>
  );
}

export default JourneyBlockerBanner;
