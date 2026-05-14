"use client";

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import { useCreateRentalSettlementParty } from "@/hooks/queries/useRentals";
import {
  RENTAL_SETTLEMENT_PARTY_LABELS,
  type RentalOrderWithDetails,
  type RentalSettlementPartyType,
} from "@/types/rental.types";
import { calculateSpentToDate } from "@/lib/utils/rentalCostUtils";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { recordSpend } from "@/lib/services/engineerWalletV2";
import { useSiteSubcontracts } from "@/hooks/queries/useSubcontracts";

interface MultiPartySettlementDialogProps {
  open: boolean;
  onClose: () => void;
  order: RentalOrderWithDetails;
}

interface PartyState {
  skipped: boolean;
  payer_source: string;
  payment_mode: string;
  party_name: string;
  amount: number;
  subcontract_id: string | null;
}

const PAYER_SOURCES = ["Company Account", "Site Cash", "Engineer Wallet"];
const PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "Cheque"];
const ENGINEER_PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer"];

const WALLET_PAYMENT_MODE_MAP: Record<string, "cash" | "upi" | "bank_transfer"> = {
  Cash: "cash",
  UPI: "upi",
  "Bank Transfer": "bank_transfer",
  Cheque: "bank_transfer",
};

export function MultiPartySettlementDialog({ open, onClose, order }: MultiPartySettlementDialogProps) {
  const settleParty = useCreateRentalSettlementParty();
  const { userProfile } = useAuth();
  const isSiteEngineer = userProfile?.role === "site_engineer";
  const supabase = createClient();

  const { data: subcontracts } = useSiteSubcontracts(order.site_id);

  const totalAdvances = (order.advances ?? []).reduce((s, a) => s + (a.amount ?? 0), 0);
  const rentalAmount =
    order.status === "completed" && order.actual_total != null
      ? order.actual_total
      : calculateSpentToDate(
          order.items as any ?? [],
          order.returns ?? [],
          order.start_date ?? order.order_date
        );
  const inboundAmount = order.transport_cost_outward ?? 0;
  const outboundAmount = order.transport_cost_return ?? 0;
  const loadingAmount =
    (order.loading_cost_outward ?? 0) +
    (order.unloading_cost_outward ?? 0) +
    ((order as any).loading_cost_return ?? 0) +
    ((order as any).unloading_cost_return ?? 0);

  const grossTotal = rentalAmount + inboundAmount + outboundAmount;
  const vendorBalance = Math.max(0, rentalAmount - totalAdvances);

  const alreadySettled = new Set((order.settlements ?? []).map((s) => s.party_type));

  const defaultPayer = isSiteEngineer ? "Engineer Wallet" : "Company Account";

  const [parties, setParties] = useState<Record<RentalSettlementPartyType, PartyState>>({
    vendor: {
      skipped: false,
      payer_source: defaultPayer,
      payment_mode: isSiteEngineer ? "Cash" : "Bank Transfer",
      party_name: order.vendor?.name ?? "",
      amount: vendorBalance,
      subcontract_id: null,
    },
    transport: {
      skipped: true,
      payer_source: defaultPayer,
      payment_mode: "Cash",
      party_name: "",
      amount: inboundAmount + outboundAmount,
      subcontract_id: null,
    },
    transport_inbound: {
      skipped: inboundAmount === 0,
      payer_source: defaultPayer,
      payment_mode: "Cash",
      party_name: "",
      amount: inboundAmount,
      subcontract_id: null,
    },
    transport_outbound: {
      skipped: outboundAmount === 0,
      payer_source: defaultPayer,
      payment_mode: "Cash",
      party_name: "",
      amount: outboundAmount,
      subcontract_id: null,
    },
    loading_unloading: {
      skipped: true,
      payer_source: defaultPayer,
      payment_mode: "Cash",
      party_name: "Site Laborers",
      amount: loadingAmount,
      subcontract_id: null,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateParty = (type: RentalSettlementPartyType, patch: Partial<PartyState>) =>
    setParties((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const handleSettle = async (partyType: RentalSettlementPartyType) => {
    const p = parties[partyType];
    setErrors((prev) => ({ ...prev, [partyType]: "" }));

    try {
      let engineerTransactionId: string | null = null;
      const isEngineerWallet = isSiteEngineer || p.payer_source === "Engineer Wallet";

      if (isEngineerWallet && userProfile?.id && order.site_id) {
        const walletMode = WALLET_PAYMENT_MODE_MAP[p.payment_mode] ?? "cash";
        const result = await recordSpend(supabase as any, {
          engineer_id: userProfile.id,
          site_id: order.site_id,
          amount: p.amount,
          payment_mode: walletMode,
          description: `Rental settlement — ${order.rental_order_number} (${RENTAL_SETTLEMENT_PARTY_LABELS[partyType]})`,
          recorded_by: userProfile.name ?? userProfile.id,
          recorded_by_user_id: userProfile.id,
        });
        engineerTransactionId = result.id;
      }

      const { data: refData } = await supabase.rpc("generate_rental_settlement_reference", {
        p_site_id: order.site_id!,
      });
      const settlementRef = refData || `RSET-${Date.now().toString(36).toUpperCase()}`;

      const isTransport = partyType === "transport_inbound" || partyType === "transport_outbound";

      await settleParty.mutateAsync({
        rental_order_id: order.id,
        party_type: partyType,
        party_name: p.party_name || null,
        settlement_date: new Date().toISOString().split("T")[0],
        total_rental_amount: partyType === "vendor" ? rentalAmount : 0,
        total_transport_amount: isTransport ? p.amount : 0,
        total_damage_amount: 0,
        negotiated_final_amount: p.amount,
        total_advance_paid: partyType === "vendor" ? totalAdvances : 0,
        balance_amount: p.amount,
        payment_mode: p.payment_mode,
        payment_channel: isEngineerWallet ? "engineer_wallet" : "direct",
        payer_source: isEngineerWallet ? "own_money" : p.payer_source,
        payer_name: p.party_name,
        engineer_transaction_id: engineerTransactionId,
        settlement_reference: settlementRef,
        subcontract_id: p.subcontract_id ?? undefined,
      });
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [partyType]: err?.message ?? "Settlement failed" }));
    }
  };

  const activePartyTypes: RentalSettlementPartyType[] = [
    "vendor",
    "transport_inbound",
    "transport_outbound",
    "loading_unloading",
  ];

  const partyColors: Record<RentalSettlementPartyType, "success" | "info" | "warning"> = {
    vendor: "success",
    transport: "info",
    transport_inbound: "info",
    transport_outbound: "info",
    loading_unloading: "warning",
  };

  const originalAmounts: Partial<Record<RentalSettlementPartyType, number>> = {
    vendor: vendorBalance,
    transport_inbound: inboundAmount,
    transport_outbound: outboundAmount,
    loading_unloading: loadingAmount,
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Settlement — {order.rental_order_number}</DialogTitle>

      {/* Summary bar */}
      <Box sx={{ px: 2.5, pb: 1 }}>
        <Stack direction="row" spacing={1}>
          <Box sx={{ flex: 1, bgcolor: "success.light", borderRadius: 1, p: 1, textAlign: "center" }}>
            <Typography variant="caption" display="block" sx={{ fontSize: 9 }}>RENTAL</Typography>
            <Typography variant="body2" fontWeight={700}>₹{rentalAmount.toLocaleString("en-IN")}</Typography>
          </Box>
          <Box sx={{ flex: 1, bgcolor: "info.light", borderRadius: 1, p: 1, textAlign: "center" }}>
            <Typography variant="caption" display="block" sx={{ fontSize: 9 }}>INBOUND</Typography>
            <Typography variant="body2" fontWeight={700}>₹{inboundAmount.toLocaleString("en-IN")}</Typography>
          </Box>
          <Box sx={{ flex: 1, bgcolor: "info.light", borderRadius: 1, p: 1, textAlign: "center" }}>
            <Typography variant="caption" display="block" sx={{ fontSize: 9 }}>OUTBOUND</Typography>
            <Typography variant="body2" fontWeight={700}>₹{outboundAmount.toLocaleString("en-IN")}</Typography>
          </Box>
          <Box sx={{ flex: 1, bgcolor: "warning.light", borderRadius: 1, p: 1, textAlign: "center" }}>
            <Typography variant="caption" display="block" sx={{ fontSize: 9 }}>LOADING</Typography>
            <Typography variant="body2" fontWeight={700}>₹{loadingAmount.toLocaleString("en-IN")}</Typography>
          </Box>
        </Stack>

        {/* Gross total + advances context */}
        <Box sx={{ mt: 1, p: 1, bgcolor: "grey.50", borderRadius: 1 }}>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">Gross Total</Typography>
            <Typography variant="caption" fontWeight={600}>₹{grossTotal.toLocaleString("en-IN")}</Typography>
          </Box>
          {totalAdvances > 0 && (
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">Advances Paid</Typography>
              <Typography variant="caption" color="warning.main" fontWeight={600}>− ₹{totalAdvances.toLocaleString("en-IN")}</Typography>
            </Box>
          )}
          <Box display="flex" justifyContent="space-between" sx={{ borderTop: "1px solid", borderColor: "divider", mt: 0.5, pt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Balance to Settle</Typography>
            <Typography variant="caption" fontWeight={700} color="success.main">₹{(grossTotal - totalAdvances).toLocaleString("en-IN")}</Typography>
          </Box>
        </Box>
      </Box>

      {isSiteEngineer && (
        <Box sx={{ px: 2.5, pb: 1 }}>
          <Alert severity="info" icon={<AccountBalanceWalletIcon fontSize="small" />} sx={{ py: 0.5 }}>
            Settlements will be deducted from your engineer wallet
          </Alert>
        </Box>
      )}

      <DialogContent sx={{ pt: 1 }}>
        {activePartyTypes.map((partyType) => {
          const p = parties[partyType];
          const isSettled = alreadySettled.has(partyType);
          const color = partyColors[partyType];
          const original = originalAmounts[partyType] ?? 0;
          const isNegotiated = Math.abs(p.amount - original) > 0.01;

          return (
            <Box
              key={partyType}
              sx={{
                border: "1px solid",
                borderColor: `${color}.main`,
                borderRadius: 2,
                p: 1.5,
                mb: 1.5,
                opacity: p.skipped ? 0.5 : 1,
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Box>
                  <Typography variant="caption" color={`${color}.dark`} fontWeight={700}>
                    {RENTAL_SETTLEMENT_PARTY_LABELS[partyType].toUpperCase()}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {p.party_name || "—"}
                  </Typography>
                </Box>
                {isSettled ? (
                  <Chip icon={<CheckCircleIcon />} label="Settled" size="small" color="success" />
                ) : p.skipped ? (
                  <Chip icon={<SkipNextIcon />} label="Skipped" size="small" color="default" />
                ) : null}
              </Box>

              {!isSettled && !p.skipped && (
                <>
                  {partyType !== "vendor" && (
                    <TextField
                      label="Person name"
                      size="small"
                      fullWidth
                      value={p.party_name}
                      onChange={(e) => updateParty(partyType, { party_name: e.target.value })}
                      sx={{ mb: 1 }}
                    />
                  )}

                  {/* Amount + payer */}
                  <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
                    <Box sx={{ flex: 1 }}>
                      <TextField
                        label="Negotiated Final Amount (₹)"
                        type="number"
                        size="small"
                        fullWidth
                        value={p.amount}
                        onChange={(e) => updateParty(partyType, { amount: parseFloat(e.target.value) || 0 })}
                      />
                    </Box>
                    {!isSiteEngineer ? (
                      <Select
                        size="small"
                        value={p.payer_source}
                        onChange={(e) => updateParty(partyType, { payer_source: e.target.value })}
                        sx={{ flex: 1 }}
                      >
                        {PAYER_SOURCES.map((s) => (
                          <MenuItem key={s} value={s}>{s}</MenuItem>
                        ))}
                      </Select>
                    ) : (
                      <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 0.5, px: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                        <AccountBalanceWalletIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">Engineer Wallet</Typography>
                      </Box>
                    )}
                  </Stack>

                  {/* Bargain context: show original vs negotiated */}
                  {original > 0 && (
                    <Box sx={{ mb: 1 }}>
                      {isNegotiated ? (
                        <Typography variant="caption" color="warning.main">
                          Bargained down from ₹{original.toLocaleString("en-IN")} — saving ₹{(original - p.amount).toLocaleString("en-IN")}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Full amount: ₹{original.toLocaleString("en-IN")}
                          {partyType === "vendor" && totalAdvances > 0 && ` (after ₹${totalAdvances.toLocaleString("en-IN")} advance)`}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* Payment mode */}
                  <Select
                    size="small"
                    fullWidth
                    value={p.payment_mode}
                    onChange={(e) => updateParty(partyType, { payment_mode: e.target.value })}
                    sx={{ mb: 1 }}
                  >
                    {(isSiteEngineer ? ENGINEER_PAYMENT_MODES : PAYMENT_MODES).map((m) => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </Select>

                  {/* Subcontract / Mesthri link */}
                  {subcontracts && subcontracts.length > 0 && (
                    <Autocomplete
                      size="small"
                      options={subcontracts}
                      getOptionLabel={(s) =>
                        `${s.title}${s.laborer_name ? ` — ${s.laborer_name}` : ""}`
                      }
                      value={subcontracts.find((s) => s.id === p.subcontract_id) ?? null}
                      onChange={(_, val) => updateParty(partyType, { subcontract_id: val?.id ?? null })}
                      slotProps={{ popper: { disablePortal: false } }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Link to Subcontract / Mesthri (optional)"
                          placeholder="Search subcontracts…"
                        />
                      )}
                      sx={{ mb: 1 }}
                    />
                  )}

                  {errors[partyType] && (
                    <Alert severity="error" sx={{ mb: 1, py: 0 }}>{errors[partyType]}</Alert>
                  )}

                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      color={color}
                      size="small"
                      onClick={() => handleSettle(partyType)}
                      disabled={settleParty.isPending}
                      sx={{ flex: 1 }}
                    >
                      Settle ₹{p.amount.toLocaleString("en-IN")}
                    </Button>
                    {partyType !== "vendor" && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => updateParty(partyType, { skipped: true })}
                        sx={{ fontSize: 10 }}
                      >
                        {partyType === "loading_unloading" ? "Skip — our laborers" : "Skip — vendor included"}
                      </Button>
                    )}
                  </Stack>
                </>
              )}
            </Box>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}
