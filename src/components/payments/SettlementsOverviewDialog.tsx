"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  Paper,
  Card,
  CardContent,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Modal,
  Backdrop,
  Fade,
} from "@mui/material";
import {
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  AccountBalanceWallet as WalletIcon,
  TrendingUp as AdvanceIcon,
  Payment as PaymentIcon,
  Image as ImageIcon,
  ZoomIn as ZoomInIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { getPaymentByReference } from "@/lib/services/settlementService";
import dayjs from "dayjs";
import type { PaymentDetails, ContractPaymentType } from "@/types/payment.types";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";

interface SettlementsOverviewDialogProps {
  open: boolean;
  onClose: () => void;
  settlementRefs: string[];
  weekStart?: string;
  weekEnd?: string;
  laborerName?: string;
  onViewDetails?: (ref: string) => void;
}

function getPaymentTypeLabel(type: ContractPaymentType): string {
  switch (type) {
    case "salary":
      return "Salary";
    case "advance":
      return "Advance";
    case "other":
      return "Other";
    default:
      return type;
  }
}

function getPaymentTypeColor(
  type: ContractPaymentType
): "success" | "warning" | "default" {
  switch (type) {
    case "salary":
      return "success";
    case "advance":
      return "warning";
    case "other":
      return "default";
    default:
      return "default";
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
    default:
      return mode;
  }
}

export default function SettlementsOverviewDialog({
  open,
  onClose,
  settlementRefs,
  weekStart,
  weekEnd,
  laborerName,
  onViewDetails,
}: SettlementsOverviewDialogProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [settlements, setSettlements] = useState<PaymentDetails[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState<string>("");

  useEffect(() => {
    const fetchAllSettlements = async () => {
      if (!open || settlementRefs.length === 0) {
        setSettlements([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await Promise.all(
          settlementRefs.map((ref) => getPaymentByReference(supabase, ref))
        );
        const validResults = results.filter(
          (r): r is PaymentDetails => r !== null
        );
        setSettlements(validResults);
      } catch (err: any) {
        console.error("Error fetching settlements:", err);
        setError(err.message || "Failed to load settlement details");
      } finally {
        setLoading(false);
      }
    };

    fetchAllSettlements();
  }, [open, settlementRefs, supabase]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const total = settlements.reduce((sum, s) => sum + s.amount, 0);
    const salary = settlements
      .filter((s) => s.paymentType === "salary")
      .reduce((sum, s) => sum + s.amount, 0);
    const advance = settlements
      .filter((s) => s.paymentType === "advance")
      .reduce((sum, s) => sum + s.amount, 0);
    const other = settlements
      .filter((s) => s.paymentType === "other")
      .reduce((sum, s) => sum + s.amount, 0);
    return { total, salary, advance, other };
  }, [settlements]);

  // Get images with proofs
  const images = useMemo(() => {
    return settlements
      .filter((s) => s.proofUrl)
      .map((s) => ({
        url: s.proofUrl!,
        date: s.actualPaymentDate,
        amount: s.amount,
        ref: s.settlementReference || s.paymentReference,
        type: s.paymentType,
        notes: s.notes,
      }));
  }, [settlements]);

  // Table columns
  const columns = useMemo<MRT_ColumnDef<PaymentDetails>[]>(
    () => [
      {
        accessorKey: "actualPaymentDate",
        header: "Date",
        size: 100,
        Cell: ({ cell }) =>
          dayjs(cell.getValue<string>()).format("DD MMM YYYY"),
      },
      {
        accessorKey: "settlementReference",
        header: "Ref Code",
        size: 140,
        Cell: ({ row }) => {
          const ref =
            row.original.settlementReference || row.original.paymentReference;
          return (
            <Chip
              label={ref}
              size="small"
              color="primary"
              variant="outlined"
              clickable
              onClick={() => onViewDetails?.(ref)}
              sx={{
                fontFamily: "monospace",
                fontWeight: 600,
                fontSize: "0.7rem",
              }}
            />
          );
        },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 100,
        Cell: ({ cell }) => (
          <Typography fontWeight={600} color="error.main">
            ₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "paymentType",
        header: "Type",
        size: 90,
        Cell: ({ cell }) => (
          <Chip
            label={getPaymentTypeLabel(cell.getValue<ContractPaymentType>())}
            size="small"
            color={getPaymentTypeColor(cell.getValue<ContractPaymentType>())}
          />
        ),
      },
      {
        accessorKey: "paymentMode",
        header: "Mode",
        size: 100,
        Cell: ({ cell }) => getPaymentModeLabel(cell.getValue<string>()),
      },
      {
        accessorKey: "proofUrl",
        header: "Proof",
        size: 80,
        Cell: ({ row }) => {
          const proofUrl = row.original.proofUrl;
          if (!proofUrl) {
            return (
              <Typography variant="body2" color="text.disabled">
                —
              </Typography>
            );
          }
          return (
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImage(proofUrl);
                setLightboxCaption(
                  `${dayjs(row.original.actualPaymentDate).format("DD MMM YYYY")} - ₹${row.original.amount.toLocaleString()}`
                );
                setLightboxOpen(true);
              }}
            >
              <ImageIcon fontSize="small" />
            </IconButton>
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        size: 150,
        Cell: ({ cell }) => {
          const notes = cell.getValue<string>();
          return notes ? (
            <Typography
              variant="body2"
              sx={{
                maxWidth: 150,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={notes}
            >
              {notes}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          );
        },
      },
    ],
    [onViewDetails]
  );

  const openLightbox = (
    url: string,
    caption: string
  ) => {
    setLightboxImage(url);
    setLightboxCaption(caption);
    setLightboxOpen(true);
  };

  const dateRangeLabel = weekStart && weekEnd
    ? `${dayjs(weekStart).format("MMM D")} - ${dayjs(weekEnd).format("MMM D, YYYY")}`
    : "";

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { maxHeight: "90vh" } }}
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ReceiptIcon color="primary" />
              <Box>
                <Typography variant="h6" component="span">Settlements Overview</Typography>
                {(laborerName || dateRangeLabel) && (
                  <Typography variant="caption" color="text.secondary">
                    {laborerName && `${laborerName}`}
                    {laborerName && dateRangeLabel && " • "}
                    {dateRangeLabel && `Week: ${dateRangeLabel}`}
                  </Typography>
                )}
              </Box>
            </Box>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography color="error" sx={{ py: 2 }}>
              {error}
            </Typography>
          ) : (
            <Box>
              {/* Summary Cards */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 2,
                  mb: 3,
                }}
              >
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <PaymentIcon color="primary" fontSize="small" />
                      <Typography variant="caption" color="text.secondary">
                        Total
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700}>
                      ₹{summary.total.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {settlements.length} settlements
                    </Typography>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <WalletIcon color="success" fontSize="small" />
                      <Typography variant="caption" color="text.secondary">
                        Salary
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="success.main">
                      ₹{summary.salary.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <AdvanceIcon color="warning" fontSize="small" />
                      <Typography variant="caption" color="text.secondary">
                        Advance
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="warning.main">
                      ₹{summary.advance.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>

                {summary.other > 0 && (
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">
                        Other
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        ₹{summary.other.toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Box>

              {/* Settlements Table */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Settlement Details
              </Typography>
              <Paper variant="outlined" sx={{ mb: 3 }}>
                <DataTable
                  columns={columns}
                  data={settlements}
                  enablePagination={false}
                  enableTopToolbar={false}
                  enableBottomToolbar={false}
                  initialState={{
                    density: "compact",
                    sorting: [{ id: "actualPaymentDate", desc: true }],
                  }}
                  muiTableContainerProps={{
                    sx: { maxHeight: 300 },
                  }}
                />
              </Paper>

              {/* Payment Proofs Gallery */}
              {images.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Payment Proofs ({images.length})
                  </Typography>
                  <ImageList
                    sx={{ width: "100%", maxHeight: 250 }}
                    cols={Math.min(images.length, 4)}
                    rowHeight={180}
                    gap={8}
                  >
                    {images.map((img, idx) => (
                      <ImageListItem
                        key={idx}
                        sx={{
                          cursor: "pointer",
                          borderRadius: 1,
                          overflow: "hidden",
                          border: "1px solid",
                          borderColor: "divider",
                          "&:hover": {
                            borderColor: "primary.main",
                            "& .MuiImageListItemBar-root": {
                              bgcolor: "primary.main",
                            },
                          },
                        }}
                        onClick={() =>
                          openLightbox(
                            img.url,
                            `${dayjs(img.date).format("DD MMM YYYY")} - ₹${img.amount.toLocaleString()}${img.notes ? ` - ${img.notes}` : ""}`
                          )
                        }
                      >
                        <img
                          src={img.url}
                          alt={`Payment proof ${idx + 1}`}
                          loading="lazy"
                          style={{
                            objectFit: "cover",
                            width: "100%",
                            height: "100%",
                          }}
                        />
                        <ImageListItemBar
                          title={`₹${img.amount.toLocaleString()}`}
                          subtitle={
                            <Box>
                              <Typography variant="caption">
                                {dayjs(img.date).format("DD MMM YYYY")}
                              </Typography>
                              {img.notes && (
                                <Typography
                                  variant="caption"
                                  display="block"
                                  sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {img.notes}
                                </Typography>
                              )}
                            </Box>
                          }
                          actionIcon={
                            <IconButton
                              sx={{ color: "white" }}
                              size="small"
                            >
                              <ZoomInIcon fontSize="small" />
                            </IconButton>
                          }
                        />
                      </ImageListItem>
                    ))}
                  </ImageList>
                </>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox Modal */}
      <Modal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 300,
            sx: { bgcolor: "rgba(0, 0, 0, 0.9)" },
          },
        }}
      >
        <Fade in={lightboxOpen}>
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              maxWidth: "90vw",
              maxHeight: "90vh",
              outline: "none",
            }}
          >
            <IconButton
              onClick={() => setLightboxOpen(false)}
              sx={{
                position: "absolute",
                top: -40,
                right: 0,
                color: "white",
              }}
            >
              <CloseIcon />
            </IconButton>
            {lightboxImage && (
              <Box>
                <img
                  src={lightboxImage}
                  alt="Payment proof"
                  style={{
                    maxWidth: "90vw",
                    maxHeight: "80vh",
                    objectFit: "contain",
                    borderRadius: 8,
                  }}
                />
                {lightboxCaption && (
                  <Typography
                    variant="body1"
                    sx={{
                      color: "white",
                      textAlign: "center",
                      mt: 2,
                    }}
                  >
                    {lightboxCaption}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Fade>
      </Modal>
    </>
  );
}
