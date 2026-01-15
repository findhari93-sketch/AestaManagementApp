"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  FormControl,
  Select,
  MenuItem,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  SelectChangeEvent,
} from "@mui/material";
import {
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import type { SubcontractOption } from "@/types/payment.types";
import { supabaseQueryWithTimeout } from "@/lib/utils/supabaseQuery";

interface SubcontractLinkSelectorProps {
  selectedSubcontractId: string | null;
  onSelect: (subcontractId: string | null) => void;
  paymentAmount?: number; // To show balance after this payment
  disabled?: boolean;
  showBalanceAfterPayment?: boolean;
}

export default function SubcontractLinkSelector({
  selectedSubcontractId,
  onSelect,
  paymentAmount = 0,
  disabled = false,
  showBalanceAfterPayment = true,
}: SubcontractLinkSelectorProps) {
  const { selectedSite } = useSite();
  const supabase = createClient();

  const [subcontracts, setSubcontracts] = useState<SubcontractOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track component mount state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch active subcontracts for the site
  useEffect(() => {
    const fetchSubcontracts = async () => {
      if (!selectedSite?.id) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch teams (optional - used only for display)
        // Note: teams table is global, not site-specific
        // Use shorter timeout since this is non-critical
        const teamsMap = new Map<string, string>();
        try {
          const { data: teamsData } = await supabaseQueryWithTimeout(
            supabase.from("teams").select("id, name"),
            10000 // 10 second timeout for non-critical teams lookup
          );
          if (teamsData) {
            teamsData.forEach((t: any) => teamsMap.set(t.id, t.name));
          }
        } catch {
          // Teams lookup is optional, continue without it
          console.log("Teams lookup skipped - will show without team names");
        }

        if (!isMountedRef.current) return;

        const { data: subcontractsData, error: fetchError } = await supabaseQueryWithTimeout(
          supabase
            .from("subcontracts")
            .select(
              `
              id,
              title,
              total_value,
              status,
              team_id
            `
            )
            .eq("site_id", selectedSite.id)
            .in("status", ["active", "on_hold"])
            .order("title")
        );

        if (!isMountedRef.current) return;
        if (fetchError) throw fetchError;

        // For each subcontract, calculate total paid from all sources
        const subcontractsWithPayments: SubcontractOption[] = await Promise.all(
          (subcontractsData || []).map(async (sc: any) => {
            // Get sum of subcontract_payments
            const { data: paymentsData } = await supabaseQueryWithTimeout(
              supabase
                .from("subcontract_payments")
                .select("amount")
                .eq("contract_id", sc.id)
            );

            const totalPaid =
              paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

            // Also get labor_payments linked to this subcontract
            const { data: laborPaymentsData } = await supabaseQueryWithTimeout(
              supabase
                .from("labor_payments")
                .select("amount")
                .eq("subcontract_id", sc.id)
            );

            const laborPaid =
              laborPaymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) ||
              0;

            // Also get expenses linked to this subcontract (via contract_id)
            const { data: expensesData } = await supabaseQueryWithTimeout(
              supabase
                .from("expenses")
                .select("amount")
                .eq("contract_id", sc.id)
            );

            const expensesPaid =
              expensesData?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

            const totalAllPaid = totalPaid + laborPaid + expensesPaid;

            return {
              id: sc.id,
              title: sc.title,
              totalValue: sc.total_value || 0,
              totalPaid: totalAllPaid,
              balanceDue: (sc.total_value || 0) - totalAllPaid,
              status: sc.status,
              teamName: sc.team_id ? teamsMap.get(sc.team_id) : undefined,
            };
          })
        );

        if (!isMountedRef.current) return;
        setSubcontracts(subcontractsWithPayments);
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error("Error fetching subcontracts:", err);
        setError("Failed to load subcontracts");
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchSubcontracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSite?.id]);

  const selectedSubcontract = subcontracts.find(
    (sc) => sc.id === selectedSubcontractId
  );

  const handleUnlink = () => {
    onSelect(null);
  };

  const handleChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    onSelect(value || null);
    setDropdownOpen(false);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `Rs.${(amount / 100000).toFixed(1)}L`;
    }
    return `Rs.${amount.toLocaleString()}`;
  };

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Loading subcontracts...
        </Typography>
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Alert severity="error" sx={{ py: 0.5 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Selected Subcontract Display */}
      {selectedSubcontract ? (
        <Box
          sx={{
            p: 1.5,
            bgcolor: "action.hover",
            borderRadius: 1,
            mb: 1,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                {selectedSubcontract.title}
              </Typography>
              {selectedSubcontract.teamName && (
                <Typography variant="caption" color="text.secondary">
                  Team: {selectedSubcontract.teamName}
                </Typography>
              )}
            </Box>
            <IconButton
              size="small"
              onClick={handleUnlink}
              disabled={disabled}
              title="Unlink from subcontract"
            >
              <UnlinkIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 2,
              mt: 1,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Contract
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {formatCurrency(selectedSubcontract.totalValue)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Paid
              </Typography>
              <Typography variant="body2" fontWeight={500} color="success.main">
                {formatCurrency(selectedSubcontract.totalPaid)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Balance
              </Typography>
              <Typography variant="body2" fontWeight={500} color="warning.main">
                {formatCurrency(selectedSubcontract.balanceDue)}
              </Typography>
            </Box>
          </Box>

          {/* Balance after this payment */}
          {showBalanceAfterPayment && paymentAmount > 0 && (
            <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
              <Typography variant="caption">
                Balance after this payment:{" "}
                <strong>
                  {formatCurrency(
                    selectedSubcontract.balanceDue - paymentAmount
                  )}
                </strong>
              </Typography>
            </Alert>
          )}
        </Box>
      ) : (
        /* Dropdown Select - Opens on click */
        <Box>
          {subcontracts.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              No active subcontracts found for this site
            </Typography>
          ) : (
            <FormControl fullWidth size="small">
              <Select
                value={selectedSubcontractId || ""}
                onChange={handleChange}
                open={dropdownOpen}
                onOpen={() => setDropdownOpen(true)}
                onClose={() => setDropdownOpen(false)}
                disabled={disabled}
                displayEmpty
                renderValue={(selected) => {
                  if (!selected) {
                    return (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LinkIcon fontSize="small" color="action" />
                        <Typography color="text.secondary">
                          Link to Subcontract
                        </Typography>
                      </Box>
                    );
                  }
                  const sc = subcontracts.find((s) => s.id === selected);
                  return sc?.title || selected;
                }}
                sx={{
                  "& .MuiSelect-select": {
                    display: "flex",
                    alignItems: "center",
                  },
                }}
              >
                <MenuItem value="">
                  <em>None (Site Expense)</em>
                </MenuItem>
                {subcontracts.map((sc) => (
                  <MenuItem key={sc.id} value={sc.id}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography variant="body2">{sc.title}</Typography>
                        {sc.teamName && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {sc.teamName}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={`Bal: ${formatCurrency(sc.balanceDue)}`}
                        size="small"
                        color={sc.balanceDue > 0 ? "warning" : "success"}
                        variant="outlined"
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Info text when no subcontract linked */}
          {!selectedSubcontractId && subcontracts.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              Payment will be recorded as site expense
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
