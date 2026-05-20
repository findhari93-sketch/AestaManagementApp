"use client";

import React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Typography,
} from "@mui/material";
import PayerSourceSelector from "@/components/settlement/PayerSourceSelector";
import type { WalletBalanceCardProps } from "@/types/settle-via-wallet.types";

export default function WalletBalanceCard({
  amount,
  balance,
  isLoading,
  sourceLabel,
  hasNoDeposit,
  isInsufficient,
  payerSource,
  customName,
  showOverride,
  onToggleOverride,
  onPayerSourceChange,
  onCustomNameChange,
  enableOverride = true,
  siteId,
}: WalletBalanceCardProps) {
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box display="flex" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Amount
        </Typography>
        <Typography variant="body1" fontWeight={700}>
          ₹{amount.toLocaleString("en-IN")}
        </Typography>
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="text.secondary">
          Wallet balance
        </Typography>
        <Typography
          variant="body1"
          fontWeight={600}
          color={isInsufficient ? "warning.main" : "success.main"}
        >
          ₹{balance.toLocaleString("en-IN")}
        </Typography>
      </Box>

      {isInsufficient && (
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            After this payment
          </Typography>
          <Typography variant="body2" fontWeight={600} color="warning.main">
            ₹{(balance - amount).toLocaleString("en-IN")}
          </Typography>
        </Box>
      )}

      {!hasNoDeposit && (
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Funded by
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            {!showOverride && (
              <Typography variant="body2">{sourceLabel}</Typography>
            )}
            {enableOverride && (
              <Button
                size="small"
                onClick={onToggleOverride}
                sx={{
                  textTransform: "none",
                  minWidth: 0,
                  px: 0.5,
                  py: 0,
                  fontWeight: 500,
                }}
              >
                {showOverride ? "Use default" : "Change"}
              </Button>
            )}
          </Box>
        </Box>
      )}

      <Collapse in={enableOverride && showOverride} unmountOnExit>
        <Box sx={{ mt: 0.5 }}>
          <PayerSourceSelector
            value={payerSource}
            customName={customName}
            onChange={onPayerSourceChange}
            onCustomNameChange={onCustomNameChange}
            compact
            siteId={siteId}
          />
        </Box>
      </Collapse>

      {isInsufficient && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Wallet will go negative by ₹{(amount - balance).toLocaleString("en-IN")} — office will owe you this amount until next deposit
        </Alert>
      )}

      {hasNoDeposit && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          No wallet deposit found — ask admin to add funds
        </Alert>
      )}
    </Box>
  );
}
