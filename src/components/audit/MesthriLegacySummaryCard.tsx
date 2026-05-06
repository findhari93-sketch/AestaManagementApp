"use client";

import React, { useState } from "react";
import {
  Box,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PushPinOutlined,
  MoreVert as MoreVertIcon,
  LockOpenOutlined,
} from "@mui/icons-material";
import type { LegacyMesthriSummary } from "@/hooks/queries/useLegacyMesthriSummary";
import ReopenAuditConfirmDialog from "./ReopenAuditConfirmDialog";

interface MesthriLegacySummaryCardProps {
  cutoffDate: string;
  summaries: LegacyMesthriSummary[];
  siteId: string;
  siteName: string;
  canReopen?: boolean;
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Read-only display card for pre-cutoff context, written by the Mode C
 * reconcile (reconcile_site_zero_balance). Shows aggregated totals at the
 * mesthri level — what the user actually cares about. No calculation depends
 * on these rows; the live waterfall starts at zero from data_started_at.
 *
 * Kebab → Re-open audit calls the reverse RPC and brings back the LegacyBand
 * so the user can iterate without dropping to SQL.
 */
export default function MesthriLegacySummaryCard({
  cutoffDate,
  summaries,
  siteId,
  siteName,
  canReopen = true,
}: MesthriLegacySummaryCardProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);

  if (summaries.length === 0) return null;

  const totalOwed = summaries.reduce((s, b) => s + b.totalWagesOwed, 0);
  const totalPaid = summaries.reduce((s, b) => s + b.totalPaid, 0);
  const totalLaborers = summaries.reduce((s, b) => s + b.laborerCount, 0);
  const tone = {
    fg: theme.palette.info.dark,
    bg: alpha(theme.palette.info.main, 0.08),
    border: alpha(theme.palette.info.main, 0.3),
  };

  const headerLabel = summaries.length === 1
    ? `${summaries[0].mesthriName}'s crew`
    : `${summaries.length} mesthri groups`;

  return (
    <>
      <Box
        sx={{
          mb: 1,
          bgcolor: "background.paper",
          border: `1px solid ${tone.border}`,
          borderRadius: 1.5,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 0.875,
            bgcolor: tone.bg,
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse legacy summary" : "Expand legacy summary"}
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 1,
              border: 0,
              bgcolor: "transparent",
              cursor: "pointer",
              textAlign: "left",
              font: "inherit",
              p: 0,
            }}
          >
            <PushPinOutlined sx={{ fontSize: 16, color: tone.fg }} />
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                color: tone.fg,
                flexShrink: 0,
              }}
            >
              Pre-{formatDate(cutoffDate)} context
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary", flexShrink: 0 }}>
              {headerLabel}
            </Typography>
            <Box
              sx={{
                flex: 1,
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 1.5,
                fontSize: 12,
                color: "text.secondary",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span>{totalLaborers} {totalLaborers === 1 ? "laborer" : "laborers"}</span>
              {totalOwed > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatINR(totalOwed)} owed</span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>{formatINR(totalPaid)} paid</span>
            </Box>
            <IconButton
              size="small"
              component="span"
              tabIndex={-1}
              sx={{ p: 0.25, color: "text.secondary", flexShrink: 0 }}
            >
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>

          {canReopen && (
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="Legacy summary actions"
              sx={{ p: 0.5, color: "text.secondary", flexShrink: 0 }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        <Collapse in={expanded} unmountOnExit>
          <Box sx={{ borderTop: `1px solid ${tone.border}`, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
            {summaries.map((s) => (
              <Box
                key={s.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  "&:last-of-type": { borderBottom: 0 },
                  fontSize: 13,
                }}
              >
                <Box sx={{ flex: 1, fontWeight: 600 }}>
                  {s.mesthriName}
                  <Box component="span" sx={{ ml: 1, fontWeight: 400, color: "text.secondary", fontSize: 12 }}>
                    {s.laborerCount} {s.laborerCount === 1 ? "laborer" : "laborers"} · {s.weeksCovered} {s.weeksCovered === 1 ? "week" : "weeks"}
                  </Box>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    alignItems: "center",
                    fontVariantNumeric: "tabular-nums",
                    color: "text.secondary",
                  }}
                >
                  {s.totalWagesOwed > 0 && (
                    <>
                      <span>owed: <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>{formatINR(s.totalWagesOwed)}</Box></span>
                      <span aria-hidden>·</span>
                    </>
                  )}
                  <span>paid: <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>{formatINR(s.totalPaid)}</Box></span>
                </Box>
              </Box>
            ))}
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                fontSize: 11,
                color: "text.secondary",
                fontStyle: "italic",
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              }}
            >
              Informational only — does not affect the live waterfall. Pre-cutoff
              attendance and settlement rows are archived.
              {canReopen && " Use the menu to re-open the audit if you need to redo the reconcile."}
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setReopenOpen(true);
          }}
        >
          <LockOpenOutlined fontSize="small" sx={{ mr: 1 }} />
          Re-open audit
        </MenuItem>
      </Menu>

      <ReopenAuditConfirmDialog
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        siteId={siteId}
        siteName={siteName}
      />
    </>
  );
}
