"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";

/**
 * Redirect from old /site/stock to new unified /site/inventory page
 */
export default function StockPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/site/inventory");
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
