"use client";

import {
  Box,
  Button,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Description as ContractIcon,
  ChevronRight,
  InfoOutlined,
} from "@mui/icons-material";
import LaborGroupCard from "./LaborGroupCard";
import BuildingGroupCard from "./BuildingGroupCard";
import {
  groupExpenseBreakdown,
  formatINR,
  type GroupedBreakdown,
} from "@/lib/utils/expenseGrouping";
import { type ExpenseBreakdown } from "@/lib/utils/expenseBreakdown";
import { type ExpenseGroup } from "@/hooks/queries/useExpensesData";
import { type SubcontractTotals } from "@/lib/services/subcontractService";

interface Props {
  total: number;
  totalCount: number;
  breakdown: ExpenseBreakdown;
  group: ExpenseGroup;
  activeTypes: string[];
  onSelectGroup: (group: ExpenseGroup) => void;
  onSelectTypes: (types: string[]) => void;
  /** Pre-loaded subcontract totals for the inline summary, or null if not yet loaded. */
  subcontracts: SubcontractTotals[] | null;
  /** Triggers the lazy load + opens the drawer. */
  onOpenSubcontracts: () => void;
  subcontractsLoading?: boolean;
}

export default function ExpensesSummaryBand({
  total,
  totalCount,
  breakdown,
  group,
  activeTypes,
  onSelectGroup,
  onSelectTypes,
  subcontracts,
  onOpenSubcontracts,
  subcontractsLoading,
}: Props) {
  const theme = useTheme();

  const grouped: GroupedBreakdown = groupExpenseBreakdown(breakdown);

  const subcontractValue = subcontracts?.reduce((s, sc) => s + sc.totalValue, 0) ?? 0;
  const subcontractPaid = subcontracts?.reduce((s, sc) => s + sc.totalPaid, 0) ?? 0;
  const subcontractBalance = subcontracts?.reduce((s, sc) => s + sc.balance, 0) ?? 0;

  const laborAmt = grouped.laborTotal.amount;
  const buildingAmt = grouped.buildingTotal.amount;
  const ratioTotal = laborAmt + buildingAmt;
  const laborPctRaw = ratioTotal > 0 ? (laborAmt / ratioTotal) * 100 : 0;
  const RATIO_MIN = 8;
  const showLabor = laborAmt > 0;
  const showBuilding = buildingAmt > 0;
  const laborPct =
    showLabor && showBuilding
      ? Math.min(100 - RATIO_MIN, Math.max(RATIO_MIN, laborPctRaw))
      : showLabor
        ? 100
        : 0;
  const buildingPct =
    showLabor && showBuilding
      ? 100 - laborPct
      : showBuilding
        ? 100
        : 0;

  const SOURCES_TOOLTIP =
    "Every expense for this site, split by domain (Labor / Building) and bucket. The Daily wages bucket here matches only attendance-linked daily settlements; market wages, tea/snacks, excess and unlinked are separate buckets. On /site/payments these are all summed as 'Daily + Market'.";

  return (
    <Box
      sx={{
        flexShrink: 0,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* Refined header row: eyebrow + hero figure + ratio bar + actions */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: { xs: 1.5, md: 2.5 },
          px: { xs: 2, md: 2.5 },
          pt: 1.5,
          pb: 1.25,
          flexWrap: { xs: "wrap", md: "nowrap" },
        }}
      >
        <Box sx={{ minWidth: 0, flex: "1 1 280px" }}>
          {/* Eyebrow */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
            <Typography
              sx={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: 1.2,
              }}
            >
              All Site Expenses
            </Typography>
            <Tooltip title={SOURCES_TOOLTIP} placement="top" arrow>
              <InfoOutlined
                sx={{
                  fontSize: 13,
                  color: "text.disabled",
                  cursor: "help",
                  "&:hover": { color: "text.secondary" },
                }}
              />
            </Tooltip>
          </Box>

          {/* Hero figure */}
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap" }}>
            <Typography
              sx={{
                fontSize: { xs: 26, sm: 32 },
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                letterSpacing: -0.6,
              }}
            >
              {formatINR(total)}
            </Typography>
            <Typography
              sx={{
                fontSize: 11.5,
                color: "text.secondary",
                fontWeight: 500,
              }}
            >
              across{" "}
              <Box
                component="span"
                sx={{
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 600,
                  color: "text.primary",
                }}
              >
                {totalCount}
              </Box>{" "}
              {totalCount === 1 ? "record" : "records"}
            </Typography>
          </Box>

          {/* Proportional ratio bar — Labor vs Building. Always visible so the
              split reads even with the breakdown collapsed. */}
          {ratioTotal > 0 ? (
            <Box sx={{ mt: 1.25, maxWidth: 480 }}>
              <Box
                sx={{
                  display: "flex",
                  height: 8,
                  borderRadius: 999,
                  overflow: "hidden",
                  bgcolor: alpha(theme.palette.text.primary, 0.06),
                }}
                role="img"
                aria-label={`Labor ${formatINR(laborAmt)}, Building ${formatINR(buildingAmt)}`}
              >
                {showLabor ? (
                  <Box
                    sx={{
                      width: `${laborPct}%`,
                      bgcolor: "info.main",
                      transition: "width 240ms ease",
                    }}
                  />
                ) : null}
                {showBuilding ? (
                  <Box
                    sx={{
                      width: `${buildingPct}%`,
                      bgcolor: "secondary.main",
                      transition: "width 240ms ease",
                    }}
                  />
                ) : null}
              </Box>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  mt: 0.75,
                  flexWrap: "wrap",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "info.main",
                      flexShrink: 0,
                    }}
                  />
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    <Box component="span" sx={{ color: "text.primary", fontWeight: 700 }}>
                      Labor
                    </Box>{" "}
                    {formatINR(laborAmt)} · {grouped.laborTotal.count}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "secondary.main",
                      flexShrink: 0,
                    }}
                  />
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    <Box component="span" sx={{ color: "text.primary", fontWeight: 700 }}>
                      Building
                    </Box>{" "}
                    {formatINR(buildingAmt)} · {grouped.buildingTotal.count}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : null}
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 0.5,
            flexShrink: 0,
            mt: { xs: 0, md: 0.25 },
          }}
        >
          {subcontracts && subcontracts.length > 0 ? (
            <Box
              onClick={onOpenSubcontracts}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenSubcontracts();
                }
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.25,
                py: 0.75,
                border: 1,
                borderColor: "divider",
                borderRadius: 1.25,
                cursor: "pointer",
                bgcolor: "background.paper",
                transition: "background-color 120ms, border-color 120ms",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: alpha(theme.palette.primary.main, 0.4),
                },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 1,
                },
              }}
            >
              <ContractIcon sx={{ fontSize: 16, color: "primary.main" }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.1 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                  <Typography
                    sx={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      color: "text.secondary",
                    }}
                  >
                    Subcontracts
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatINR(subcontractValue)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Typography
                    color="success.main"
                    sx={{
                      fontSize: 10.5,
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                    }}
                  >
                    {formatINR(subcontractPaid)} paid
                  </Typography>
                  <Typography
                    color="warning.main"
                    sx={{
                      fontSize: 10.5,
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                    }}
                  >
                    {formatINR(subcontractBalance)} bal
                  </Typography>
                </Box>
              </Box>
              <ChevronRight sx={{ fontSize: 16, color: "text.secondary" }} />
            </Box>
          ) : (
            <Tooltip title="Subcontract totals are loaded on demand to keep this page fast">
              <Button
                variant="text"
                size="small"
                startIcon={<ContractIcon />}
                onClick={onOpenSubcontracts}
                disabled={subcontractsLoading}
                sx={{ textTransform: "none", fontWeight: 500 }}
              >
                {subcontractsLoading ? "Loading…" : "Subcontracts"}
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: { xs: 2, md: 3 },
          px: { xs: 2, md: 2.5 },
          pb: 2,
          alignItems: "flex-start",
        }}
      >
        <LaborGroupCard
          grouped={grouped}
          group={group}
          activeTypes={activeTypes}
          onSelectGroup={() => onSelectGroup(group === "labor" ? "all" : "labor")}
          onSelectTypes={onSelectTypes}
        />
        <BuildingGroupCard
          grouped={grouped}
          group={group}
          activeTypes={activeTypes}
          onSelectGroup={() => onSelectGroup(group === "building" ? "all" : "building")}
          onSelectTypes={onSelectTypes}
        />
      </Box>
    </Box>
  );
}
