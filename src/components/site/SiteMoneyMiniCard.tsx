"use client";

import React from "react";
import { Box, Paper, Typography, Skeleton, Button, Stack } from "@mui/material";
import Link from "next/link";
import { KpiTile, formatINR } from "@/components/payments/KpiTile";
import { useSiteFinancialSummary } from "@/hooks/queries/useSiteFinancialSummary";

export interface SiteMoneyMiniCardProps {
  siteId: string;
}

/**
 * Condensed 3-tile rollup of the Site Money Overview hero. Lives on
 * the site dashboard so engineers see "what's left in our hand" without
 * navigating into /site/client-payments. Click "Open" to drill in.
 */
export function SiteMoneyMiniCard({ siteId }: SiteMoneyMiniCardProps) {
  const q = useSiteFinancialSummary(siteId);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="overline" color="text.secondary">
          Site Money Overview
        </Typography>
        <Button component={Link} href="/site/client-payments" size="small">
          Open
        </Button>
      </Stack>
      {q.isLoading || !q.data ? (
        <Skeleton variant="rectangular" height={80} />
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          <KpiTile
            label="Total Contract"
            variant="neutral"
            value={formatINR(q.data.totalContract)}
          />
          <KpiTile
            label="Remaining from Client"
            variant="warning"
            value={formatINR(q.data.remainingFromClient)}
          />
          <KpiTile
            label="Net In Hand"
            variant={q.data.netInHand >= 0 ? "success" : "error"}
            value={formatINR(q.data.netInHand)}
          />
        </Box>
      )}
    </Paper>
  );
}

export default SiteMoneyMiniCard;
