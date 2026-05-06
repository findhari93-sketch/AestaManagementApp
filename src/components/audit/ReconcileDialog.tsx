"use client";

import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import { CheckCircleOutline } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useSiteActions } from "@/contexts/SiteContext";

type ReconcileMode = "zero_balance" | "keep_granular" | "opening_balance";

interface ReconcileDialogProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  cutoffDate: string;
  legacyWagesOwed?: number;
  legacyPaid?: number;
  legacyWeeksPending?: number;
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Mode A (keep_granular): UPDATE sites.legacy_status='reconciled'. Legacy
 *   weeks remain visible, just no longer in their own band. Allocation gating
 *   in the waterfall RPC lifts.
 *
 * Mode B (opening_balance): calls reconcile_site_with_opening_balance RPC.
 *   Per-laborer opening balances are computed, granular legacy rows soft-
 *   archived. Live waterfall starts clean. UI shows OpeningBalanceRow above
 *   the first live week.
 *
 * Mode C (zero_balance — default): calls reconcile_site_zero_balance RPC.
 *   Pre-cutoff totals aggregated at the mesthri level into a per-mesthri
 *   summary card; granular legacy rows soft-archived; opening balance left
 *   at zero so the live waterfall starts fresh. Right shape when payments
 *   to mesthri were settled outside the app.
 */
export default function ReconcileDialog({
  open,
  onClose,
  siteId,
  siteName,
  cutoffDate,
  legacyWagesOwed,
  legacyPaid,
  legacyWeeksPending,
}: ReconcileDialogProps) {
  const queryClient = useQueryClient();
  const { refreshSites } = useSiteActions();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);

  const difference =
    typeof legacyWagesOwed === "number" && typeof legacyPaid === "number"
      ? legacyWagesOwed - legacyPaid
      : null;

  // Mode C ("Start fresh — zero balance") is the default for these projects:
  // payments to mesthri are settled outside the app, so per-laborer carry-
  // forward is noise. Modes A and B remain available for sites that want
  // either granular legacy history or per-laborer carry-forward.
  const recommendedMode: ReconcileMode = "zero_balance";
  const [mode, setMode] = useState<ReconcileMode>(recommendedMode);

  const handleReconcile = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();

      if (mode === "keep_granular") {
        // Mode A — simple status flip
        const { error: updateError } = await (supabase as any)
          .from("sites")
          .update({ legacy_status: "reconciled" })
          .eq("id", siteId);
        if (updateError) throw updateError;
      } else if (mode === "opening_balance") {
        // Mode B — atomic snapshot RPC
        const { data, error: rpcError } = await (supabase as any).rpc(
          "reconcile_site_with_opening_balance",
          { p_site_id: siteId }
        );
        if (rpcError) throw rpcError;
        setSnapshot(data);
      } else {
        // Mode C — zero opening balance + per-mesthri summary
        const { data, error: rpcError } = await (supabase as any).rpc(
          "reconcile_site_zero_balance",
          { p_site_id: siteId }
        );
        if (rpcError) throw rpcError;
        setSnapshot(data);
      }

      await Promise.all([refreshSites(), queryClient.invalidateQueries()]);
      // Modes B/C: keep dialog open for one beat so the user sees the snapshot summary
      if (mode === "keep_granular") {
        onClose();
      } else {
        setSubmitting(false);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to reconcile site");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reconcile {siteName}?</DialogTitle>
      <DialogContent>
        {snapshot && (() => {
          const isZeroBalance = typeof snapshot.summaries_inserted === "number";
          const insertedCount = isZeroBalance
            ? snapshot.summaries_inserted
            : snapshot.balances_inserted;
          const insertedNoun = isZeroBalance ? "mesthri summar" : "opening balance";
          const insertedSuffix = isZeroBalance
            ? (insertedCount === 1 ? "y" : "ies")
            : (insertedCount === 1 ? "" : "s");
          return (
            <Alert severity="success" sx={{ mb: 2 }}>
              Reconcile complete. Inserted {insertedCount} {insertedNoun}{insertedSuffix};
              archived {snapshot.attendance_archived} attendance row
              {snapshot.attendance_archived === 1 ? "" : "s"},{" "}
              {snapshot.settlements_archived} settlement
              {snapshot.settlements_archived === 1 ? "" : "s"}. Site is now{" "}
              <Box component="span" sx={{ fontWeight: 600 }}>reconciled</Box>.
            </Alert>
          );
        })()}

        {!snapshot && (
          <>
            <DialogContentText sx={{ mb: 2 }}>
              This closes the audit on legacy data dated before{" "}
              <Box component="span" sx={{ fontWeight: 600 }}>{formatDate(cutoffDate)}</Box>.
            </DialogContentText>

            {(typeof legacyWagesOwed === "number" || typeof legacyWeeksPending === "number") && (
              <Box
                sx={{
                  p: 1.5,
                  mb: 2,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  fontSize: 13,
                }}
              >
                <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "text.secondary", mb: 0.5 }}>
                  Pre-flight
                </Typography>
                {typeof legacyWeeksPending === "number" && (
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Weeks reviewed</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {legacyWeeksPending > 0 ? `⚠️ ${legacyWeeksPending} unfilled` : "✓ all reviewed"}
                    </span>
                  </Box>
                )}
                {typeof legacyWagesOwed === "number" && (
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Wages owed (legacy)</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatINR(legacyWagesOwed)}</span>
                  </Box>
                )}
                {typeof legacyPaid === "number" && (
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Paid (legacy)</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatINR(legacyPaid)}</span>
                  </Box>
                )}
                {difference !== null && difference !== 0 && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", color: "warning.dark", fontWeight: 600 }}>
                    <span>Difference</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatINR(Math.abs(difference))} {difference > 0 ? "underpaid" : "overpaid"}
                    </span>
                  </Box>
                )}
              </Box>
            )}

            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>
              How should legacy data be merged?
            </Typography>
            <FormControl component="fieldset" sx={{ mb: 1 }}>
              <RadioGroup
                value={mode}
                onChange={(e) => setMode(e.target.value as ReconcileMode)}
              >
                <FormControlLabel
                  value="zero_balance"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 600 }}>
                        Start fresh — zero balance
                        {recommendedMode === "zero_balance" && (
                          <Box component="span" sx={{ ml: 0.75, fontSize: 11, color: "success.main" }}>
                            (recommended)
                          </Box>
                        )}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>
                        Pre-cutoff totals saved as a per-mesthri summary card
                        above the live timeline. Opening balance is ₹0 — the
                        live waterfall starts fresh from {formatDate(cutoffDate)}.
                        Use when payments to mesthri were settled outside the app.
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", mb: 0.5 }}
                />
                <FormControlLabel
                  value="keep_granular"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 600 }}>
                        Keep granular history
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>
                        Legacy weeks stay visible. Allocation gating lifts —
                        future payments may flow across periods.
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", mb: 0.5 }}
                />
                <FormControlLabel
                  value="opening_balance"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 600 }}>
                        Roll up to per-laborer opening balance
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>
                        Per-laborer balances become a single &quot;Opening
                        balance as of {formatDate(cutoffDate)}&quot; row above
                        the live timeline. Granular legacy weeks archived
                        (recoverable via SQL).
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start" }}
                />
              </RadioGroup>
            </FormControl>
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {snapshot ? "Close" : "Cancel"}
        </Button>
        {!snapshot && (
          <Button
            onClick={handleReconcile}
            disabled={submitting}
            variant="contained"
            color="success"
            startIcon={<CheckCircleOutline />}
          >
            {submitting
              ? "Reconciling…"
              : mode === "opening_balance"
                ? "Roll up to opening balance"
                : mode === "zero_balance"
                  ? "Start fresh with zero balance"
                  : "Reconcile site"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
