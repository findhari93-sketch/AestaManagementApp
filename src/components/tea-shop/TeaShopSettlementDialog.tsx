"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Radio,
  RadioGroup,
  Paper,
  Divider,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";
import {
  Close as CloseIcon,
  QrCode2 as QrCodeIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import FileUploader, { UploadedFile } from "@/components/common/FileUploader";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import type { TeaShopAccount, TeaShopEntry, TeaShopSettlement, PaymentMode, Subcontract } from "@/types/database.types";
import dayjs from "dayjs";

interface TeaShopSettlementDialogProps {
  open: boolean;
  onClose: () => void;
  shop: TeaShopAccount;
  pendingBalance: number;
  entries: TeaShopEntry[];
  onSuccess?: () => void;
  settlement?: TeaShopSettlement | null; // For edit mode
}

interface SiteEngineer {
  id: string;
  name: string;
}

interface SubcontractOption {
  id: string;
  title: string;
  team_name?: string;
}

interface AllocationPreview {
  entryId: string;
  date: string;
  entryAmount: number;
  previouslyPaid: number;
  allocatedAmount: number;
  isFullyPaid: boolean;
}

// Generate settlement reference in TSS-YYMMDD-NNN format
const generateSettlementRef = (): string => {
  const date = dayjs().format("YYMMDD");
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TSS-${date}-${random}`;
};

export default function TeaShopSettlementDialog({
  open,
  onClose,
  shop,
  pendingBalance,
  entries,
  onSuccess,
  settlement,
}: TeaShopSettlementDialogProps) {
  const isEditMode = !!settlement;
  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [amountPaying, setAmountPaying] = useState(pendingBalance);
  const [paymentDate, setPaymentDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [payerType, setPayerType] = useState<"site_engineer" | "company_direct">("company_direct");
  const [selectedEngineerId, setSelectedEngineerId] = useState("");
  const [createWalletTransaction, setCreateWalletTransaction] = useState(true);
  const [notes, setNotes] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  // Site engineers list
  const [engineers, setEngineers] = useState<SiteEngineer[]>([]);

  // Subcontracts for linking
  const [subcontracts, setSubcontracts] = useState<SubcontractOption[]>([]);
  const [selectedSubcontractId, setSelectedSubcontractId] = useState<string>("");

  // Unsettled entries for waterfall (fetched fresh)
  const [unsettledEntries, setUnsettledEntries] = useState<TeaShopEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    if (open) {
      // Fetch site engineers and subcontracts
      fetchEngineers();
      fetchSubcontracts();
      fetchUnsettledEntries();

      if (isEditMode && settlement) {
        // Edit mode - populate from settlement
        setAmountPaying(settlement.amount_paid || 0);
        setPaymentDate(settlement.payment_date);
        setPaymentMode((settlement.payment_mode as PaymentMode) || "cash");
        setPayerType(settlement.payer_type === "site_engineer" ? "site_engineer" : "company_direct");
        setSelectedEngineerId(settlement.site_engineer_id || "");
        setCreateWalletTransaction(false); // Don't create new transaction when editing
        setNotes(settlement.notes || "");
        setSelectedSubcontractId(settlement.subcontract_id || "");
        setProofUrl((settlement as any).proof_url || null);
      } else {
        // New settlement - reset form
        setAmountPaying(pendingBalance);
        setPaymentDate(dayjs().format("YYYY-MM-DD"));
        setPaymentMode("cash");
        setPayerType("company_direct");
        setSelectedEngineerId("");
        setCreateWalletTransaction(true);
        setNotes("");
        setSelectedSubcontractId("");
        setProofUrl(null);
      }
      setError(null);
    }
  }, [open, pendingBalance, settlement, isEditMode]);

  const fetchEngineers = async () => {
    if (!selectedSite) return;

    try {
      // Get users who have site_engineer role or are assigned to this site
      const { data } = await supabase
        .from("users")
        .select("id, name")
        .in("role", ["site_engineer", "admin", "office"]);

      setEngineers(data || []);
    } catch (err) {
      console.error("Error fetching engineers:", err);
    }
  };

  const fetchSubcontracts = async () => {
    if (!selectedSite) return;

    try {
      // Fetch teams first to avoid FK ambiguity issues
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("site_id", selectedSite.id);

      const teamsMap = new Map<string, string>();
      (teamsData || []).forEach((t: any) => teamsMap.set(t.id, t.name));

      const { data } = await supabase
        .from("subcontracts")
        .select("id, title, team_id")
        .eq("site_id", selectedSite.id)
        .in("status", ["draft", "active"]);

      const options: SubcontractOption[] = (data || []).map((sc: any) => ({
        id: sc.id,
        title: sc.title,
        team_name: sc.team_id ? teamsMap.get(sc.team_id) : undefined,
      }));
      setSubcontracts(options);
    } catch (err) {
      console.error("Error fetching subcontracts:", err);
    }
  };

  // Fetch unsettled entries (oldest first for waterfall)
  const fetchUnsettledEntries = async () => {
    setLoadingEntries(true);
    try {
      // Fetch entries that are not fully paid
      // is_fully_paid = NULL (new entry) or FALSE (partially paid)
      const { data } = await (supabase
        .from("tea_shop_entries") as any)
        .select("*")
        .eq("tea_shop_id", shop.id)
        .or("is_fully_paid.is.null,is_fully_paid.eq.false")
        .order("date", { ascending: true }); // Oldest first

      // Filter out entries that are actually fully paid (amount_paid >= total_amount)
      const filteredData = (data || []).filter((entry: any) => {
        const totalAmount = entry.total_amount || 0;
        const amountPaid = entry.amount_paid || 0;
        return amountPaid < totalAmount;
      });

      setUnsettledEntries(filteredData as TeaShopEntry[]);
    } catch (err) {
      console.error("Error fetching unsettled entries:", err);
    } finally {
      setLoadingEntries(false);
    }
  };

  // Calculate waterfall allocation preview
  const allocationPreview = useMemo((): AllocationPreview[] => {
    if (amountPaying <= 0 || unsettledEntries.length === 0) return [];

    let remaining = amountPaying;
    const allocations: AllocationPreview[] = [];

    for (const entry of unsettledEntries) {
      if (remaining <= 0) break;

      const entryAmount = entry.total_amount || 0;
      const previouslyPaid = (entry as any).amount_paid || 0;
      const entryRemaining = entryAmount - previouslyPaid;

      if (entryRemaining <= 0) continue;

      const toAllocate = Math.min(remaining, entryRemaining);

      allocations.push({
        entryId: entry.id,
        date: entry.date,
        entryAmount,
        previouslyPaid,
        allocatedAmount: toAllocate,
        isFullyPaid: toAllocate >= entryRemaining,
      });

      remaining -= toAllocate;
    }

    return allocations;
  }, [amountPaying, unsettledEntries]);

  // Calculate totals
  const totalAllocated = allocationPreview.reduce((sum, a) => sum + a.allocatedAmount, 0);
  const balanceRemaining = Math.max(0, pendingBalance - amountPaying);

  const handleSave = async () => {
    if (amountPaying <= 0) {
      setError("Please enter amount to pay");
      return;
    }

    if (payerType === "site_engineer" && !selectedEngineerId) {
      setError("Please select a site engineer");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let engineerTransactionId: string | null = null;

      // If site engineer is paying, create wallet transaction
      if (payerType === "site_engineer" && createWalletTransaction && !isEditMode) {
        const transactionData = {
          user_id: selectedEngineerId,
          site_id: selectedSite?.id,
          transaction_type: "spent_on_behalf",
          amount: amountPaying,
          transaction_date: paymentDate,
          description: `Tea shop payment - ${shop.shop_name}`,
          recipient_type: "vendor",
          payment_mode: paymentMode,
          is_settled: false,
          recorded_by: userProfile?.name || "System",
          recorded_by_user_id: userProfile?.id || null,
        };

        const { data: txData, error: txError } = await (supabase
          .from("site_engineer_transactions") as any)
          .insert(transactionData)
          .select()
          .single();

        if (txError) throw txError;
        engineerTransactionId = txData?.id || null;
      }

      // Generate settlement reference for new settlements
      const settlementRef = isEditMode
        ? (settlement as any)?.settlement_reference || generateSettlementRef()
        : generateSettlementRef();

      // Settlement record data
      const settlementData = {
        tea_shop_id: shop.id,
        settlement_reference: settlementRef,
        period_start: allocationPreview.length > 0 ? allocationPreview[0].date : paymentDate,
        period_end: allocationPreview.length > 0 ? allocationPreview[allocationPreview.length - 1].date : paymentDate,
        entries_total: totalAllocated,
        previous_balance: 0, // Not using period-based anymore
        total_due: pendingBalance,
        amount_paid: amountPaying,
        balance_remaining: balanceRemaining,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        payer_type: payerType,
        site_engineer_id: payerType === "site_engineer" ? selectedEngineerId : null,
        site_engineer_transaction_id: isEditMode ? settlement?.site_engineer_transaction_id : engineerTransactionId,
        is_engineer_settled: isEditMode ? settlement?.is_engineer_settled : false,
        status: balanceRemaining > 0 ? "partial" : "completed",
        notes: notes.trim() || null,
        recorded_by: userProfile?.name || null,
        recorded_by_user_id: userProfile?.id || null,
        subcontract_id: selectedSubcontractId || null,
        proof_url: proofUrl,
      };

      let settlementId: string;

      if (isEditMode && settlement) {
        // Update existing settlement
        const { error: settlementError } = await (supabase
          .from("tea_shop_settlements") as any)
          .update(settlementData)
          .eq("id", settlement.id);

        if (settlementError) throw settlementError;
        settlementId = settlement.id;

        // Delete old allocations
        await (supabase.from as any)("tea_shop_settlement_allocations")
          .delete()
          .eq("settlement_id", settlement.id);
      } else {
        // Create new settlement
        const { data: newSettlement, error: settlementError } = await (supabase
          .from("tea_shop_settlements") as any)
          .insert(settlementData)
          .select()
          .single();

        if (settlementError) throw settlementError;
        settlementId = newSettlement.id;
      }

      // Create allocation records and update entries
      for (const alloc of allocationPreview) {
        // Insert allocation record
        await (supabase.from as any)("tea_shop_settlement_allocations")
          .insert({
            settlement_id: settlementId,
            entry_id: alloc.entryId,
            allocated_amount: alloc.allocatedAmount,
          });

        // Update entry with new payment info
        const newPaid = alloc.previouslyPaid + alloc.allocatedAmount;
        await (supabase
          .from("tea_shop_entries") as any)
          .update({
            amount_paid: newPaid,
            is_fully_paid: alloc.isFullyPaid,
          })
          .eq("id", alloc.entryId);
      }

      onSuccess?.();
    } catch (err: any) {
      console.error("Error saving settlement:", err);
      setError(err.message || "Failed to save settlement");
    } finally {
      setLoading(false);
    }
  };

  // Get shop's QR code and UPI ID
  const shopQrCodeUrl = (shop as any).qr_code_url;
  const shopUpiId = (shop as any).upi_id;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" fontWeight={700}>
            {isEditMode ? "Edit Settlement" : "Pay Shop"}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Shop Info with QR Code */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
            {/* QR Code Display */}
            {shopQrCodeUrl && (
              <Box sx={{ textAlign: "center", flexShrink: 0 }}>
                <Box
                  component="img"
                  src={shopQrCodeUrl}
                  alt="Payment QR"
                  sx={{
                    width: 120,
                    height: 120,
                    objectFit: "contain",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Scan to Pay
                </Typography>
              </Box>
            )}

            {/* Shop Details */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {shop.shop_name}
              </Typography>
              {shopUpiId && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  UPI: <strong>{shopUpiId}</strong>
                </Typography>
              )}
              <Box sx={{ mt: 1, p: 1, bgcolor: "error.50", borderRadius: 1 }}>
                <Typography variant="body2" color="error.main">
                  Pending Balance: <strong>₹{pendingBalance.toLocaleString()}</strong>
                </Typography>
              </Box>
            </Box>

            {/* QR Icon if no QR code */}
            {!shopQrCodeUrl && (
              <Box sx={{ p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
                <QrCodeIcon sx={{ fontSize: 48, color: "text.disabled" }} />
              </Box>
            )}
          </Box>
        </Paper>

        {/* Amount Paying */}
        <TextField
          label="Amount Paying"
          type="number"
          value={amountPaying}
          onChange={(e) => setAmountPaying(Math.max(0, parseFloat(e.target.value) || 0))}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          slotProps={{
            htmlInput: { min: 0 },
            input: { startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> },
          }}
        />

        {/* Waterfall Allocation Preview */}
        {allocationPreview.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              ALLOCATION PREVIEW (Oldest First)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Date</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Entry</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Paying</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allocationPreview.map((alloc, idx) => (
                  <TableRow key={alloc.entryId}>
                    <TableCell sx={{ py: 0.75 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {idx === 0 && (
                          <Chip label="Oldest" size="small" color="warning" sx={{ height: 18, fontSize: "0.6rem" }} />
                        )}
                        <Typography variant="body2" fontSize="0.8rem">
                          {dayjs(alloc.date).format("DD MMM")}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.75 }}>
                      <Typography variant="body2" fontSize="0.8rem">
                        ₹{alloc.entryAmount.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.75 }}>
                      <Typography variant="body2" fontSize="0.8rem" fontWeight={600} color="success.main">
                        ₹{alloc.allocatedAmount.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 0.75 }}>
                      <Chip
                        label={alloc.isFullyPaid ? "Full" : "Partial"}
                        size="small"
                        color={alloc.isFullyPaid ? "success" : "warning"}
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 1.5, display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Entries covered: {allocationPreview.length}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                Total: ₹{totalAllocated.toLocaleString()}
              </Typography>
            </Box>
          </Paper>
        )}

        {loadingEntries && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Balance After Payment:
          </Typography>
          <Typography
            variant="body2"
            fontWeight={600}
            color={balanceRemaining > 0 ? "error.main" : "success.main"}
          >
            ₹{balanceRemaining.toLocaleString()}
          </Typography>
        </Box>

        {/* Payment Date */}
        <TextField
          label="Payment Date"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          fullWidth
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ mb: 3 }}
        />

        {/* Who is Paying */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            WHO IS PAYING?
          </Typography>

          <RadioGroup
            value={payerType}
            onChange={(e) => setPayerType(e.target.value as "site_engineer" | "company_direct")}
          >
            <FormControlLabel
              value="site_engineer"
              control={<Radio />}
              label="Site Engineer"
            />
            <FormControlLabel
              value="company_direct"
              control={<Radio />}
              label="Company Direct"
            />
          </RadioGroup>

          {payerType === "site_engineer" && (
            <Box sx={{ mt: 2, pl: 4 }}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Select Engineer</InputLabel>
                <Select
                  value={selectedEngineerId}
                  onChange={(e) => setSelectedEngineerId(e.target.value)}
                  label="Select Engineer"
                >
                  {engineers.map((eng) => (
                    <MenuItem key={eng.id} value={eng.id}>
                      {eng.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {!isEditMode && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={createWalletTransaction}
                      onChange={(e) => setCreateWalletTransaction(e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">Create wallet transaction</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Records as &quot;Spent on Behalf&quot; in engineer wallet
                      </Typography>
                    </Box>
                  }
                />
              )}
            </Box>
          )}
        </Paper>

        {/* Link to Subcontract (Optional) */}
        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Link to Subcontract (Optional)</InputLabel>
          <Select
            value={selectedSubcontractId}
            onChange={(e) => setSelectedSubcontractId(e.target.value)}
            label="Link to Subcontract (Optional)"
          >
            <MenuItem value="">
              <em>None - General Site Expense</em>
            </MenuItem>
            {subcontracts.map((sc) => (
              <MenuItem key={sc.id} value={sc.id}>
                {sc.title}{sc.team_name ? ` (${sc.team_name})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Payment Mode */}
        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Payment Mode</InputLabel>
          <Select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            label="Payment Mode"
          >
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="upi">UPI</MenuItem>
            <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
            <MenuItem value="cheque">Cheque</MenuItem>
          </Select>
        </FormControl>

        {/* Payment Proof Uploader for UPI payments */}
        {paymentMode === "upi" && (
          <Box sx={{ mb: 3 }}>
            <FileUploader
              supabase={supabase}
              bucketName="settlement-proofs"
              folderPath={`tea-shop/${shop.id}`}
              fileNamePrefix="tea-settlement"
              accept="image"
              label="Payment Screenshot (Required for UPI)"
              helperText="Upload screenshot of UPI payment confirmation"
              compact
              uploadOnSelect
              value={proofUrl ? { name: "Payment Proof", size: 0, url: proofUrl } : null}
              onUpload={(file: UploadedFile) => setProofUrl(file.url)}
              onRemove={() => setProofUrl(null)}
            />
          </Box>
        )}

        {/* Notes */}
        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          multiline
          rows={2}
          size="small"
          placeholder="e.g., Settled as per shop notebook..."
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || amountPaying <= 0}
        >
          {loading ? <CircularProgress size={24} /> : isEditMode ? "Update Settlement" : "Record Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
