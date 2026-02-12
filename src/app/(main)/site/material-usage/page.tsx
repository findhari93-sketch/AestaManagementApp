"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";

/**
 * Redirect from old /site/material-usage to new unified /site/inventory page (usage tab)
 */
export default function MaterialUsagePageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/site/inventory?tab=usage");
  }, [router]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography color="text.secondary">
        Redirecting to Inventory...
      </Typography>
    </Box>
  );
}
