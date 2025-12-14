"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import {
  Send as SendIcon,
  Engineering as EngineerIcon,
  CheckCircle as CheckIcon,
  Schedule as PendingIcon,
  Cancel as DisputedIcon,
  Image as ImageIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";

export type SettlementStatus =
  | "pending_settlement"
  | "pending_confirmation"
  | "confirmed"
  | "disputed"
  | null;

interface SettlementStatusIndicatorProps {
  paidVia: "engineer_wallet" | "direct" | null;
  settlementStatus: SettlementStatus;
  compact?: boolean;
  // Optional: Additional data for showing dates and proofs
  amount?: number;
  companyProofUrl?: string | null;
  engineerProofUrl?: string | null;
  transactionDate?: string | null;
  settledDate?: string | null;
  confirmedAt?: string | null;
}

interface StepConfig {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  isComplete: boolean;
  isActive: boolean;
  isError: boolean;
  proofUrl?: string | null;
  date?: string | null;
}

export default function SettlementStatusIndicator({
  paidVia,
  settlementStatus,
  compact = false,
  amount,
  companyProofUrl,
  engineerProofUrl,
  transactionDate,
  settledDate,
  confirmedAt,
}: SettlementStatusIndicatorProps) {
  // Proof viewer state
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [selectedProof, setSelectedProof] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Don't show for direct payments or if not sent via engineer
  if (paidVia !== "engineer_wallet") {
    return null;
  }

  // Determine step states
  const companyComplete = true; // Always complete if paidVia is engineer_wallet
  const engineerComplete =
    settlementStatus === "pending_confirmation" ||
    settlementStatus === "confirmed";
  const engineerActive = settlementStatus === "pending_settlement";
  const settlementComplete = settlementStatus === "confirmed";
  const settlementActive = settlementStatus === "pending_confirmation";
  const settlementError = settlementStatus === "disputed";

  const steps: StepConfig[] = [
    {
      label: "Company",
      shortLabel: "Co.",
      icon: <SendIcon sx={{ fontSize: compact ? 12 : 14 }} />,
      isComplete: companyComplete,
      isActive: false,
      isError: false,
      proofUrl: companyProofUrl,
      date: transactionDate,
    },
    {
      label: "Engineer",
      shortLabel: "Eng.",
      icon: <EngineerIcon sx={{ fontSize: compact ? 12 : 14 }} />,
      isComplete: engineerComplete,
      isActive: engineerActive,
      isError: false,
      proofUrl: engineerProofUrl,
      date: settledDate,
    },
    {
      label: "Confirmed",
      shortLabel: "Done",
      icon: settlementError ? (
        <DisputedIcon sx={{ fontSize: compact ? 12 : 14 }} />
      ) : settlementActive ? (
        <PendingIcon sx={{ fontSize: compact ? 12 : 14 }} />
      ) : (
        <CheckIcon sx={{ fontSize: compact ? 12 : 14 }} />
      ),
      isComplete: settlementComplete,
      isActive: settlementActive,
      isError: settlementError,
      date: confirmedAt,
    },
  ];

  const getStepColor = (step: StepConfig) => {
    if (step.isError) return "error.main";
    if (step.isComplete) return "success.main";
    if (step.isActive) return "warning.main";
    return "text.disabled";
  };

  const getStatusSymbol = (step: StepConfig) => {
    if (step.isError) return "✗";
    if (step.isComplete) return "✓";
    if (step.isActive) return "⏳";
    return "○";
  };

  const handleViewProof = (url: string, title: string) => {
    setSelectedProof({ url, title });
    setProofDialogOpen(true);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return null;
    return dayjs(date).format("MMM D");
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: compact ? 0.25 : 0.5,
        }}
      >
        {steps.map((step, index) => (
          <React.Fragment key={step.label}>
            {/* Step */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
              }}
            >
              {/* Status symbol */}
              <Typography
                component="span"
                sx={{
                  color: getStepColor(step),
                  fontWeight: 600,
                  fontSize: compact ? "0.65rem" : "0.75rem",
                  lineHeight: 1,
                }}
              >
                {getStatusSymbol(step)}
              </Typography>

              {/* Label */}
              <Typography
                component="span"
                sx={{
                  color: getStepColor(step),
                  fontWeight: step.isComplete || step.isActive ? 600 : 400,
                  fontSize: compact ? "0.65rem" : "0.7rem",
                  lineHeight: 1,
                }}
              >
                {compact ? step.shortLabel : step.label}
              </Typography>

              {/* Proof button (only if proof exists) */}
              {step.proofUrl && (
                <Tooltip title={`View ${step.label} proof`}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewProof(step.proofUrl!, `${step.label} Proof`);
                    }}
                    sx={{
                      p: 0.25,
                      color: getStepColor(step),
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <ImageIcon sx={{ fontSize: compact ? 10 : 12 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* Arrow connector */}
            {index < steps.length - 1 && (
              <Typography
                component="span"
                sx={{
                  color: "text.disabled",
                  fontSize: compact ? "0.6rem" : "0.7rem",
                  mx: 0.25,
                }}
              >
                →
              </Typography>
            )}
          </React.Fragment>
        ))}
      </Box>

      {/* Proof Viewer Dialog */}
      <Dialog
        open={proofDialogOpen}
        onClose={() => setProofDialogOpen(false)}
        maxWidth="md"
        fullWidth
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">{selectedProof?.title}</Typography>
            <IconButton onClick={() => setProofDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedProof?.url && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 300,
                bgcolor: "action.selected",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <img
                src={selectedProof.url}
                alt={selectedProof.title}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (selectedProof?.url) {
                window.open(selectedProof.url, "_blank");
              }
            }}
            color="primary"
          >
            Open in New Tab
          </Button>
          <Button onClick={() => setProofDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
