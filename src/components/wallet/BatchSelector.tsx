"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Typography,
  Checkbox,
  TextField,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  InputAdornment,
  Collapse,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from "@mui/material";
import {
  AccountBalance as TrustIcon,
  Person as PersonIcon,
  Business as ClientIcon,
  Wallet as WalletIcon,
  LocationOn as SiteIcon,
  Edit as CustomIcon,
  Lock as LockIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { getAvailableBatches } from "@/lib/services/walletService";
import type { BatchOption, BatchAllocation } from "@/types/wallet.types";
import type { PayerSource } from "@/types/settlement.types";
import dayjs from "dayjs";

interface BatchSelectorProps {
  engineerId: string;
  siteId?: string | null;
  requiredAmount: number;
  selectedBatches: BatchAllocation[];
  onSelectionChange: (batches: BatchAllocation[]) => void;
  disabled?: boolean;
  showSiteRestrictionWarning?: boolean;
}

/** Get icon for payer source */
function getPayerSourceIcon(source: PayerSource) {
  switch (source) {
    case "trust_account":
      return <TrustIcon fontSize="small" />;
    case "amma_money":
    case "mothers_money":
      return <PersonIcon fontSize="small" />;
    case "client_money":
      return <ClientIcon fontSize="small" />;
    case "own_money":
      return <WalletIcon fontSize="small" />;
    case "other_site_money":
      return <SiteIcon fontSize="small" />;
    case "custom":
    default:
      return <CustomIcon fontSize="small" />;
  }
}

/** Get color for payer source */
function getPayerSourceColor(
  source: PayerSource
): "primary" | "secondary" | "success" | "info" | "warning" | "default" {
  switch (source) {
    case "trust_account":
      return "info";
    case "amma_money":
    case "mothers_money":
      return "secondary";
    case "client_money":
      return "success";
    case "own_money":
      return "primary";
    case "other_site_money":
      return "warning";
    case "custom":
    default:
      return "default";
  }
}

/** Get label for payer source */
function getPayerSourceLabel(source: PayerSource, payerName?: string | null): string {
  switch (source) {
    case "trust_account":
      return "Trust Account";
    case "amma_money":
    case "mothers_money":
      return "Amma Money";
    case "client_money":
      return "Client Money";
    case "own_money":
      return "Own Money";
    case "other_site_money":
      return payerName ? `Site: ${payerName}` : "Other Site";
    case "custom":
      return payerName || "Other";
    default:
      return source;
  }
}

export default function BatchSelector({
  engineerId,
  siteId,
  requiredAmount,
  selectedBatches,
  onSelectionChange,
  disabled = false,
  showSiteRestrictionWarning = true,
}: BatchSelectorProps) {
  const theme = useTheme();
  const supabase = createClient();

  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Fetch available batches
  useEffect(() => {
    async function fetchBatches() {
      if (!engineerId) {
        setBatches([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const availableBatches = await getAvailableBatches(supabase, engineerId, siteId);
        setBatches(availableBatches);
      } catch (err: any) {
        setError(err.message || "Failed to load batches");
      } finally {
        setLoading(false);
      }
    }

    fetchBatches();
  }, [engineerId, siteId, supabase]);

  // Calculate total selected
  const totalSelected = useMemo(() => {
    return selectedBatches.reduce((sum, b) => sum + b.amount, 0);
  }, [selectedBatches]);

  // Calculate remaining needed
  const remainingNeeded = requiredAmount - totalSelected;

  // Total available
  const totalAvailable = useMemo(() => {
    return batches.reduce((sum, b) => sum + b.remaining_balance, 0);
  }, [batches]);

  // Handle batch selection toggle
  const handleToggleBatch = (batch: BatchOption, checked: boolean) => {
    if (checked) {
      // Add batch with default amount (min of remaining balance or remaining needed)
      const defaultAmount = Math.min(batch.remaining_balance, Math.max(0, remainingNeeded));
      onSelectionChange([
        ...selectedBatches,
        {
          batchId: batch.id,
          batchCode: batch.batch_code,
          payerSource: batch.payer_source,
          payerName: batch.payer_name || undefined,
          amount: defaultAmount,
        },
      ]);
    } else {
      // Remove batch
      onSelectionChange(selectedBatches.filter((b) => b.batchId !== batch.id));
    }
  };

  // Handle amount change for a batch
  const handleAmountChange = (batchId: string, amount: number) => {
    onSelectionChange(
      selectedBatches.map((b) =>
        b.batchId === batchId ? { ...b, amount: Math.max(0, amount) } : b
      )
    );
  };

  // Check if a batch is selected
  const isBatchSelected = (batchId: string) => {
    return selectedBatches.some((b) => b.batchId === batchId);
  };

  // Get selected amount for a batch
  const getSelectedAmount = (batchId: string) => {
    return selectedBatches.find((b) => b.batchId === batchId)?.amount || 0;
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading available batches...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 1 }}>
        {error}
      </Alert>
    );
  }

  if (batches.length === 0) {
    return (
      <Alert severity="warning" sx={{ my: 1 }}>
        No funds available in wallet. Please add money to the engineer's wallet first.
      </Alert>
    );
  }

  return (
    <Box sx={{ my: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Select Money Source(s)
          </Typography>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Available: <strong>Rs.{totalAvailable.toLocaleString()}</strong>
          </Typography>
        </Box>
      </Box>

      {/* Summary */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          p: 1.5,
          mb: 1,
          bgcolor: alpha(
            remainingNeeded === 0
              ? theme.palette.success.main
              : remainingNeeded > 0
              ? theme.palette.warning.main
              : theme.palette.error.main,
            0.1
          ),
          borderRadius: 1,
          border: `1px solid ${alpha(
            remainingNeeded === 0
              ? theme.palette.success.main
              : remainingNeeded > 0
              ? theme.palette.warning.main
              : theme.palette.error.main,
            0.3
          )}`,
        }}
      >
        <Typography variant="body2">
          Selected: <strong>Rs.{totalSelected.toLocaleString()}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          of Rs.{requiredAmount.toLocaleString()} required
        </Typography>
        {remainingNeeded > 0 && (
          <Chip
            label={`Rs.${remainingNeeded.toLocaleString()} more needed`}
            size="small"
            color="warning"
          />
        )}
        {remainingNeeded < 0 && (
          <Chip
            label={`Rs.${Math.abs(remainingNeeded).toLocaleString()} over`}
            size="small"
            color="error"
          />
        )}
        {remainingNeeded === 0 && (
          <Chip label="Amount matched" size="small" color="success" />
        )}
      </Box>

      {/* Batch Table */}
      <Collapse in={expanded}>
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ maxHeight: 300, overflow: "auto" }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 40 }} />
                <TableCell>Batch Code</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell align="right" sx={{ width: 150 }}>
                  Use Amount
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {batches.map((batch) => {
                const selected = isBatchSelected(batch.id);
                const selectedAmount = getSelectedAmount(batch.id);
                const isOverLimit = selectedAmount > batch.remaining_balance;

                return (
                  <TableRow
                    key={batch.id}
                    hover
                    selected={selected}
                    sx={{
                      opacity: disabled ? 0.6 : 1,
                      bgcolor: selected
                        ? alpha(theme.palette.primary.main, 0.05)
                        : "inherit",
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected}
                        onChange={(e) => handleToggleBatch(batch, e.target.checked)}
                        disabled={disabled}
                        size="small"
                      />
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" fontFamily="monospace">
                          {batch.batch_code}
                        </Typography>
                        {batch.site_restricted && (
                          <Tooltip title={`Restricted to: ${batch.site_name}`}>
                            <LockIcon
                              fontSize="small"
                              color="warning"
                              sx={{ fontSize: 14 }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                      {batch.transaction_date && (
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(batch.transaction_date).format("DD MMM YYYY")}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Chip
                        icon={getPayerSourceIcon(batch.payer_source)}
                        label={getPayerSourceLabel(batch.payer_source, batch.payer_name)}
                        size="small"
                        color={getPayerSourceColor(batch.payer_source)}
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500}>
                        Rs.{batch.remaining_balance.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        of Rs.{batch.original_amount.toLocaleString()}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      {selected && (
                        <TextField
                          type="number"
                          size="small"
                          value={selectedAmount || ""}
                          onChange={(e) =>
                            handleAmountChange(batch.id, Number(e.target.value) || 0)
                          }
                          disabled={disabled}
                          error={isOverLimit}
                          helperText={isOverLimit ? "Exceeds available" : ""}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">Rs.</InputAdornment>
                            ),
                          }}
                          sx={{
                            width: 130,
                            "& .MuiInputBase-input": {
                              textAlign: "right",
                              py: 0.5,
                            },
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>

      {/* Site restriction warning */}
      {showSiteRestrictionWarning &&
        batches.some((b) => b.site_restricted && b.site_id !== siteId) && (
          <Alert severity="info" sx={{ mt: 1 }} icon={<InfoIcon />}>
            Some batches are restricted to specific sites and are not shown here.
          </Alert>
        )}
    </Box>
  );
}
