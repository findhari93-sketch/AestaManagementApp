"use client";

import React, { useState, useEffect } from "react";
import {
  SwipeableDrawer,
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Divider,
} from "@mui/material";
import { OpenInNew as OpenInNewIcon, CheckCircle as CheckCircleIcon } from "@mui/icons-material";

interface TeaShopPayBottomSheetProps {
  open: boolean;
  onClose: () => void;
  shopName: string;
  upiId: string;
  pendingBalance: number;
  onRecordPayment: (amount: number) => void;
}

export default function TeaShopPayBottomSheet({
  open,
  onClose,
  shopName,
  upiId,
  pendingBalance,
  onRecordPayment,
}: TeaShopPayBottomSheetProps) {
  const [amount, setAmount] = useState(Math.round(pendingBalance));

  useEffect(() => {
    if (open) setAmount(Math.round(pendingBalance));
  }, [open, pendingBalance]);

  const isPartial = amount !== Math.round(pendingBalance);

  const handleOpenUpi = () => {
    const params = new URLSearchParams({
      pa: upiId,
      am: String(amount),
      tn: "T&S Payment",
      cu: "INR",
    });
    window.location.href = `upi://pay?${params.toString()}`;
  };

  const handleRecordPayment = () => {
    onRecordPayment(amount);
    onClose();
  };

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          pb: 3,
        },
      }}
    >
      {/* Drag handle */}
      <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5, pb: 0.5 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: "grey.300" }} />
      </Box>

      <Box sx={{ px: 3, pt: 1.5 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Pay {shopName}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {/* Amount field */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          Amount
        </Typography>
        <TextField
          fullWidth
          type="number"
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
          InputProps={{
            startAdornment: <InputAdornment position="start">₹</InputAdornment>,
          }}
          inputProps={{ min: 1 }}
          sx={{ mb: 0.5 }}
        />
        <Typography variant="caption" color={isPartial ? "warning.main" : "text.secondary"} sx={{ mb: 2, display: "block" }}>
          {isPartial ? "Partial payment" : "Full pending balance"}
        </Typography>

        {/* UPI ID display */}
        <Box sx={{ mb: 2.5, p: 1.5, bgcolor: "grey.50", borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            UPI ID
          </Typography>
          <Typography variant="body2" fontWeight={500}>
            {upiId}
          </Typography>
        </Box>

        {/* Open UPI App button */}
        <Button
          fullWidth
          variant="contained"
          size="large"
          endIcon={<OpenInNewIcon />}
          onClick={handleOpenUpi}
          disabled={!amount || amount <= 0}
          sx={{ mb: 1.5 }}
        >
          Open UPI App
        </Button>

        {/* Record payment button */}
        <Button
          fullWidth
          variant="outlined"
          size="large"
          startIcon={<CheckCircleIcon />}
          onClick={handleRecordPayment}
          disabled={!amount || amount <= 0}
          color="success"
        >
          I&apos;ve paid — Record it
        </Button>
      </Box>
    </SwipeableDrawer>
  );
}
