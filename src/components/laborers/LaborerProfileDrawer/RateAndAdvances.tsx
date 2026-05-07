"use client";

import { Box, Stack } from "@mui/material";
import { formatCurrency } from "@/lib/formatters";
import type { LaborerWithDetails } from "@/lib/data/laborers";
import { InfoRow, SectionTitle } from "./shared";

interface RateAndAdvancesProps {
  laborer: LaborerWithDetails;
}

export default function RateAndAdvances({ laborer }: RateAndAdvancesProps) {
  const given = Number(laborer.total_advance_given ?? 0);
  const deducted = Number(laborer.total_advance_deducted ?? 0);
  const balance = given - deducted;

  return (
    <Box>
      <SectionTitle>Rate &amp; advances</SectionTitle>
      <Stack divider={undefined}>
        <InfoRow
          label="Daily rate"
          value={formatCurrency(Number(laborer.daily_rate ?? 0))}
        />
        <InfoRow
          label="Employment type"
          value={
            laborer.employment_type
              ? laborer.employment_type.replace("_", " ")
              : null
          }
        />
        <InfoRow
          label="Laborer type"
          value={
            laborer.laborer_type === "contract"
              ? "Contract (paid via mesthri)"
              : laborer.laborer_type === "daily_market"
                ? "Daily market (paid directly)"
                : (laborer.laborer_type as string | null)
          }
        />
        <InfoRow label="Advance given" value={formatCurrency(given)} />
        <InfoRow label="Advance deducted" value={formatCurrency(deducted)} />
        <InfoRow
          label="Outstanding advance"
          value={formatCurrency(balance)}
        />
      </Stack>
    </Box>
  );
}
