"use client";

import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
  Paper,
  alpha,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from "@mui/material";
import {
  Close as CloseIcon,
  CheckCircle as PaidIcon,
  Schedule as PendingIcon,
  Send as SentIcon,
  CurrencyRupee,
  Person as PersonIcon,
  Groups as GroupsIcon,
  CalendarToday,
  Image as ImageIcon,
  AccountBalanceWallet,
  ArrowForward,
  Notes,
  Wallet as WalletIcon,
  Link as LinkIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
} from "@mui/icons-material";
import type { DateGroup, DailyPaymentRecord } from "@/types/payment.types";
import dayjs from "dayjs";

function getPayerSourceLabel(
  source: string | null | undefined,
  customName?: string | null
): string {
  if (!source) return "N/A";
  switch (source) {
    case "own_money":
      return "Own Money";
    case "amma_money":
    case "mothers_money":
      return "Amma Money";
    case "client_money":
      return "Client Money";
    case "trust_account":
      return "Trust Account";
    case "other_site_money":
      return customName || "Other Site Money";
    case "custom":
      return customName || "Custom";
    default:
      return source;
  }
}

function getPaymentModeLabel(mode: string | null | undefined): string {
  if (!mode) return "N/A";
  switch (mode) {
    case "upi":
      return "UPI";
    case "cash":
      return "Cash";
    case "net_banking":
      return "Net Banking";
    case "company_direct_online":
      return "Direct (Online)";
    case "via_site_engineer":
      return "Via Engineer";
    default:
      return mode;
  }
}

interface DateViewDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  group: DateGroup | null;
}

export default function DateViewDetailsDialog({
  open,
  onClose,
  date,
  group,
}: DateViewDetailsDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [viewingProof, setViewingProof] = useState<{
    url: string;
    type: "company" | "engineer";
  } | null>(null);

  // Calculate summary data
  const summary = useMemo(() => {
    if (!group) return null;

    const allRecords = [...group.dailyRecords, ...group.marketRecords];
    const pendingRecords = allRecords.filter(
      (r) => !r.isPaid && r.paidVia !== "engineer_wallet"
    );
    const sentToEngineerRecords = allRecords.filter(
      (r) => !r.isPaid && r.paidVia === "engineer_wallet"
    );
    const paidRecords = allRecords.filter((r) => r.isPaid);

    const pendingAmount = pendingRecords.reduce((sum, r) => sum + r.amount, 0);
    const sentToEngineerAmount = sentToEngineerRecords.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const paidAmount = paidRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalAmount = pendingAmount + sentToEngineerAmount + paidAmount;

    // Determine overall status
    let status: "all_paid" | "all_pending" | "partial" | "sent_to_engineer" =
      "partial";
    if (paidRecords.length === allRecords.length && allRecords.length > 0) {
      status = "all_paid";
    } else if (pendingRecords.length === allRecords.length) {
      status = "all_pending";
    } else if (
      sentToEngineerRecords.length > 0 &&
      pendingRecords.length === 0 &&
      paidRecords.length === 0
    ) {
      status = "sent_to_engineer";
    }

    // Get settlement info from paid records
    const settledRecords = allRecords.filter(
      (r) => r.isPaid || r.paidVia === "engineer_wallet"
    );
    const settlementInfo = settledRecords.length > 0 ? {
      transactionDate: settledRecords[0]?.transactionDate,
      settledDate: settledRecords[0]?.settledDate,
      settlementMode: settledRecords[0]?.settlementMode,
      companyProofUrl: settledRecords[0]?.companyProofUrl,
      engineerProofUrl: settledRecords[0]?.engineerProofUrl,
      cashReason: settledRecords[0]?.cashReason,
      confirmedAt: settledRecords[0]?.confirmedAt,
    } : null;

    // Collect all unique proofs
    const proofs: { type: string; url: string; date?: string }[] = [];
    allRecords.forEach((r) => {
      if (r.companyProofUrl && !proofs.find((p) => p.url === r.companyProofUrl)) {
        proofs.push({
          type: "Company → Engineer",
          url: r.companyProofUrl,
          date: r.transactionDate || undefined,
        });
      }
      if (r.engineerProofUrl && !proofs.find((p) => p.url === r.engineerProofUrl)) {
        proofs.push({
          type: "Engineer → Laborers",
          url: r.engineerProofUrl,
          date: r.settledDate || undefined,
        });
      }
    });

    // Get settlement details from records (money source, subcontract, reference, notes)
    const recordWithMoneySource = settledRecords.find((r) => r.moneySource);
    const moneySourceInfo = recordWithMoneySource ? {
      source: recordWithMoneySource.moneySource,
      sourceName: recordWithMoneySource.moneySourceName,
    } : null;

    const recordWithSubcontract = allRecords.find((r) => r.subcontractId);
    const subcontractInfo = recordWithSubcontract ? {
      id: recordWithSubcontract.subcontractId,
      title: recordWithSubcontract.subcontractTitle,
    } : null;

    const settlementRef = allRecords.find((r) => r.settlementReference)?.settlementReference || null;

    // Get payment notes from first record that has notes
    const paymentNotes = allRecords.find((r) => r.paymentNotes)?.paymentNotes || null;

    // Get payment mode from settled records
    const paymentMode = settledRecords.find((r) => r.paymentMode)?.paymentMode || null;

    return {
      totalAmount,
      pendingAmount,
      sentToEngineerAmount,
      paidAmount,
      status,
      dailyCount: group.dailyRecords.length,
      marketCount: group.marketRecords.reduce((sum, r) => sum + (r.count || 1), 0),
      pendingCount: pendingRecords.length,
      sentCount: sentToEngineerRecords.length,
      paidCount: paidRecords.length,
      settlementInfo,
      proofs,
      moneySourceInfo,
      subcontractInfo,
      settlementRef,
      paymentNotes,
      paymentMode,
    };
  }, [group]);

  const formatCurrency = (amount: number) => {
    return `Rs.${amount.toLocaleString("en-IN")}`;
  };

  const getStatusChip = () => {
    if (!summary) return null;

    switch (summary.status) {
      case "all_paid":
        return (
          <Chip icon={<PaidIcon />} label="All Paid" color="success" size="small" />
        );
      case "all_pending":
        return (
          <Chip icon={<PendingIcon />} label="Pending" color="warning" size="small" />
        );
      case "sent_to_engineer":
        return (
          <Chip icon={<SentIcon />} label="With Engineer" color="info" size="small" />
        );
      default:
        return <Chip label="Partial" color="default" size="small" />;
    }
  };

  if (!group) return null;

  const allRecords = [...group.dailyRecords, ...group.marketRecords];

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: { borderRadius: isMobile ? 0 : 2 },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CalendarToday color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {dayjs(date).format("dddd, MMM D, YYYY")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Salary Settlement Details
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {getStatusChip()}
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 2 }}>
          {summary && (
            <Box>
              {/* Summary Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Total Amount
                  </Typography>
                  <Chip
                    icon={<CurrencyRupee sx={{ fontSize: 16 }} />}
                    label={summary.totalAmount.toLocaleString("en-IN")}
                    color="primary"
                    size="medium"
                    sx={{ fontWeight: 700, fontSize: "1rem" }}
                  />
                </Box>

                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <PersonIcon sx={{ fontSize: 16, color: "primary.main" }} />
                    <Typography variant="body2">
                      {summary.dailyCount} Daily
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <GroupsIcon sx={{ fontSize: 16, color: "secondary.main" }} />
                    <Typography variant="body2">
                      {summary.marketCount} Market
                    </Typography>
                  </Box>
                </Box>

                {/* Amount Breakdown */}
                <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {summary.pendingAmount > 0 && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={`Pending: ${formatCurrency(summary.pendingAmount)}`}
                    />
                  )}
                  {summary.sentToEngineerAmount > 0 && (
                    <Chip
                      size="small"
                      color="info"
                      variant="outlined"
                      label={`With Engineer: ${formatCurrency(summary.sentToEngineerAmount)}`}
                    />
                  )}
                  {summary.paidAmount > 0 && (
                    <Chip
                      size="small"
                      color="success"
                      variant="outlined"
                      label={`Paid: ${formatCurrency(summary.paidAmount)}`}
                    />
                  )}
                </Box>
              </Paper>

              {/* Settlement Details Section */}
              {(summary.moneySourceInfo || summary.subcontractInfo || summary.settlementRef || summary.paymentMode || summary.paymentNotes) && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    gutterBottom
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <ReceiptIcon fontSize="small" />
                    Settlement Details
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {/* Money Source / Paid By */}
                      {summary.moneySourceInfo && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <WalletIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            Paid By:
                          </Typography>
                          <Chip
                            size="small"
                            label={getPayerSourceLabel(
                              summary.moneySourceInfo.source,
                              summary.moneySourceInfo.sourceName
                            )}
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      )}

                      {/* Payment Mode */}
                      {summary.paymentMode && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <PaymentIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            Payment Mode:
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {getPaymentModeLabel(summary.paymentMode)}
                          </Typography>
                        </Box>
                      )}

                      {/* Subcontract Link */}
                      {summary.subcontractInfo?.title && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <LinkIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            Linked to:
                          </Typography>
                          <Chip
                            size="small"
                            label={summary.subcontractInfo.title}
                            color="info"
                            variant="outlined"
                            icon={<LinkIcon sx={{ fontSize: 14 }} />}
                          />
                        </Box>
                      )}

                      {/* Settlement Reference */}
                      {summary.settlementRef && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <ReceiptIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            Reference:
                          </Typography>
                          <Chip
                            size="small"
                            label={summary.settlementRef}
                            variant="outlined"
                            sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                          />
                        </Box>
                      )}

                      {/* Payment Notes */}
                      {summary.paymentNotes && (
                        <Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                            <Notes fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              Notes:
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              p: 1,
                              bgcolor: "action.hover",
                              borderRadius: 1,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {summary.paymentNotes}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Box>
              )}

              {/* Settlement Timeline */}
              {summary.settlementInfo && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    gutterBottom
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <AccountBalanceWallet fontSize="small" />
                    Payment Flow
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stepper orientation="vertical" activeStep={-1}>
                      {/* Step 1: Company → Engineer */}
                      {summary.settlementInfo.transactionDate && (
                        <Step completed>
                          <StepLabel
                            StepIconProps={{
                              icon: <ArrowForward sx={{ fontSize: 16 }} />,
                            }}
                          >
                            <Typography variant="body2" fontWeight={500}>
                              Company → Engineer
                            </Typography>
                          </StepLabel>
                          <StepContent>
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(summary.settlementInfo.transactionDate).format(
                                "DD MMM YYYY"
                              )}
                            </Typography>
                            {summary.settlementInfo.companyProofUrl && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="info"
                                startIcon={<ImageIcon />}
                                onClick={() =>
                                  setViewingProof({
                                    url: summary.settlementInfo!.companyProofUrl!,
                                    type: "company",
                                  })
                                }
                                sx={{ mt: 0.5 }}
                              >
                                View Proof
                              </Button>
                            )}
                          </StepContent>
                        </Step>
                      )}

                      {/* Step 2: Engineer → Laborers */}
                      {(summary.settlementInfo.settledDate ||
                        summary.settlementInfo.settlementMode) && (
                        <Step completed>
                          <StepLabel
                            StepIconProps={{
                              icon: <PaidIcon sx={{ fontSize: 16 }} />,
                            }}
                          >
                            <Typography variant="body2" fontWeight={500}>
                              Engineer → Laborers
                            </Typography>
                          </StepLabel>
                          <StepContent>
                            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                              {summary.settlementInfo.settledDate && (
                                <Typography variant="caption" color="text.secondary">
                                  {dayjs(summary.settlementInfo.settledDate).format(
                                    "DD MMM YYYY"
                                  )}
                                </Typography>
                              )}
                              {summary.settlementInfo.settlementMode && (
                                <Chip
                                  size="small"
                                  label={
                                    summary.settlementInfo.settlementMode === "upi"
                                      ? "UPI / Online"
                                      : "Cash"
                                  }
                                  variant="outlined"
                                />
                              )}
                            </Box>
                            {summary.settlementInfo.engineerProofUrl && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<ImageIcon />}
                                onClick={() =>
                                  setViewingProof({
                                    url: summary.settlementInfo!.engineerProofUrl!,
                                    type: "engineer",
                                  })
                                }
                                sx={{ mt: 0.5 }}
                              >
                                View Settlement Proof
                              </Button>
                            )}
                            {summary.settlementInfo.cashReason && (
                              <Box
                                sx={{
                                  mt: 1,
                                  p: 1,
                                  bgcolor: "action.hover",
                                  borderRadius: 1,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                                >
                                  <Notes fontSize="small" />
                                  Notes:
                                </Typography>
                                <Typography variant="body2">
                                  {summary.settlementInfo.cashReason}
                                </Typography>
                              </Box>
                            )}
                          </StepContent>
                        </Step>
                      )}
                    </Stepper>
                  </Paper>
                </Box>
              )}

              {/* Payment Proofs Section */}
              {summary.proofs.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    gutterBottom
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <ImageIcon fontSize="small" />
                    Payment Proofs ({summary.proofs.length})
                  </Typography>
                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {summary.proofs.map((proof, index) => (
                      <Paper
                        key={index}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            bgcolor: "action.hover",
                            borderColor: "primary.main",
                          },
                          flex: "1 1 150px",
                          minWidth: 150,
                        }}
                        onClick={() =>
                          setViewingProof({
                            url: proof.url,
                            type: proof.type.includes("Company") ? "company" : "engineer",
                          })
                        }
                      >
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Box
                            component="img"
                            src={proof.url}
                            alt={proof.type}
                            sx={{
                              width: 80,
                              height: 80,
                              objectFit: "cover",
                              borderRadius: 1,
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          />
                          <Typography
                            variant="caption"
                            color={
                              proof.type.includes("Company")
                                ? "info.main"
                                : "success.main"
                            }
                            fontWeight={600}
                            textAlign="center"
                          >
                            {proof.type}
                          </Typography>
                          {proof.date && (
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(proof.date).format("DD MMM YYYY")}
                            </Typography>
                          )}
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Laborers List */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <PersonIcon fontSize="small" />
                  Laborers ({allRecords.length})
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ maxHeight: 200, overflow: "auto" }}
                >
                  <List dense disablePadding>
                    {group.dailyRecords.map((record) => (
                      <ListItem
                        key={record.id}
                        sx={{
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                        secondaryAction={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Chip
                              size="small"
                              label={formatCurrency(record.amount)}
                              variant="outlined"
                            />
                            {record.isPaid ? (
                              <PaidIcon
                                fontSize="small"
                                sx={{ color: "success.main" }}
                              />
                            ) : record.paidVia === "engineer_wallet" ? (
                              <SentIcon
                                fontSize="small"
                                sx={{ color: "info.main" }}
                              />
                            ) : (
                              <PendingIcon
                                fontSize="small"
                                sx={{ color: "warning.main" }}
                              />
                            )}
                          </Box>
                        }
                      >
                        <ListItemText
                          primaryTypographyProps={{ component: "div" }}
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Chip
                                label="Daily"
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 18, fontSize: "0.65rem" }}
                              />
                              <Typography variant="body2">
                                {record.laborerName}
                              </Typography>
                            </Box>
                          }
                          secondary={record.role}
                        />
                      </ListItem>
                    ))}
                    {group.marketRecords.map((record) => (
                      <ListItem
                        key={record.id}
                        sx={{
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                        secondaryAction={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Chip
                              size="small"
                              label={formatCurrency(record.amount)}
                              variant="outlined"
                              color="secondary"
                            />
                            {record.isPaid ? (
                              <PaidIcon
                                fontSize="small"
                                sx={{ color: "success.main" }}
                              />
                            ) : record.paidVia === "engineer_wallet" ? (
                              <SentIcon
                                fontSize="small"
                                sx={{ color: "info.main" }}
                              />
                            ) : (
                              <PendingIcon
                                fontSize="small"
                                sx={{ color: "warning.main" }}
                              />
                            )}
                          </Box>
                        }
                      >
                        <ListItemText
                          primaryTypographyProps={{ component: "div" }}
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Chip
                                label="Market"
                                size="small"
                                color="secondary"
                                variant="outlined"
                                sx={{ height: 18, fontSize: "0.65rem" }}
                              />
                              <Typography variant="body2">
                                {record.role || record.laborerName}
                              </Typography>
                            </Box>
                          }
                          secondary={`${record.count || 1} laborer(s)`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            </Box>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Proof Image Viewer - Full Screen */}
      <Dialog
        open={!!viewingProof}
        onClose={() => setViewingProof(null)}
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: "rgba(0, 0, 0, 0.95)",
          },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
            zIndex: 1,
            bgcolor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <Typography variant="h6" sx={{ color: "white" }}>
            {viewingProof?.type === "company"
              ? "Company Payment Proof"
              : "Engineer Settlement Proof"}
          </Typography>
          <IconButton
            onClick={() => setViewingProof(null)}
            sx={{
              color: "white",
              bgcolor: "rgba(255, 255, 255, 0.1)",
              "&:hover": { bgcolor: "rgba(255, 255, 255, 0.2)" },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            p: 0,
            height: "100%",
          }}
        >
          {viewingProof && (
            <Box
              component="img"
              src={viewingProof.url}
              alt={
                viewingProof.type === "company"
                  ? "Company payment proof"
                  : "Engineer settlement proof"
              }
              sx={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
