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
} from "@mui/material";
import { LockOpenOutlined } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useSiteActions } from "@/contexts/SiteContext";

interface ReopenAuditConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
}

/**
 * Confirms re-opening the audit on a reconciled site. Calls the existing
 * reopen_audit_after_opening_balance_reconcile RPC, which un-archives all
 * pre-cutoff rows + deletes laborer_opening_balances + site_legacy_mesthri_summary
 * and flips legacy_status back to 'auditing'. After this, the LegacyBand and
 * its green "Reconcile site" button reappear so the user can re-reconcile.
 */
export default function ReopenAuditConfirmDialog({
  open,
  onClose,
  siteId,
  siteName,
}: ReopenAuditConfirmDialogProps) {
  const queryClient = useQueryClient();
  const { refreshSites } = useSiteActions();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReopen = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await (supabase as any).rpc(
        "reopen_audit_after_opening_balance_reconcile",
        { p_site_id: siteId }
      );
      if (rpcError) throw rpcError;
      await Promise.all([refreshSites(), queryClient.invalidateQueries()]);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to re-open audit");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Re-open audit on {siteName}?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>
          This will:
        </DialogContentText>
        <Box component="ul" sx={{ m: 0, pl: 2.5, "& li": { fontSize: 13.5, mb: 0.25 } }}>
          <li>Un-archive all pre-cutoff attendance and settlement rows</li>
          <li>Delete the per-mesthri summary card and any opening balances</li>
          <li>Flip the site back to <Box component="span" sx={{ fontWeight: 600 }}>auditing</Box> so the legacy band reappears</li>
        </Box>
        <DialogContentText sx={{ mt: 1.5, fontSize: 13 }}>
          Live (post-cutoff) data is unaffected. After re-opening, run Reconcile site again to commit the new approach.
        </DialogContentText>
        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleReopen}
          disabled={submitting}
          variant="contained"
          color="warning"
          startIcon={<LockOpenOutlined />}
        >
          {submitting ? "Re-opening…" : "Re-open audit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
