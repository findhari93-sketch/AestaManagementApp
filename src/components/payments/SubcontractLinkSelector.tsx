"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Collapse,
  IconButton,
} from "@mui/material";
import {
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import type { SubcontractOption } from "@/types/payment.types";

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
  const [isExpanded, setIsExpanded] = useState(!!selectedSubcontractId);
  const [error, setError] = useState<string | null>(null);

  // Fetch active subcontracts for the site
  useEffect(() => {
    const fetchSubcontracts = async () => {
      if (!selectedSite?.id) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch subcontracts with their payment totals
        const { data: subcontractsData, error: fetchError } = await supabase
          .from("subcontracts")
          .select(
            `
            id,
            title,
            total_value,
            status,
            teams(name)
          `
          )
          .eq("site_id", selectedSite.id)
          .in("status", ["active", "on_hold"])
          .order("title");

        if (fetchError) throw fetchError;

        // For each subcontract, calculate total paid
        const subcontractsWithPayments: SubcontractOption[] = await Promise.all(
          (subcontractsData || []).map(async (sc: any) => {
            // Get sum of subcontract_payments
            const { data: paymentsData } = await supabase
              .from("subcontract_payments")
              .select("amount")
              .eq("contract_id", sc.id);

            const totalPaid =
              paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

            // Also get labor_payments linked to this subcontract
            const { data: laborPaymentsData } = await supabase
              .from("labor_payments")
              .select("amount")
              .eq("subcontract_id", sc.id);

            const laborPaid =
              laborPaymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) ||
              0;

            const totalAllPaid = totalPaid + laborPaid;

            return {
              id: sc.id,
              title: sc.title,
              totalValue: sc.total_value || 0,
              totalPaid: totalAllPaid,
              balanceDue: (sc.total_value || 0) - totalAllPaid,
              status: sc.status,
              teamName: sc.teams?.name,
            };
          })
        );

        setSubcontracts(subcontractsWithPayments);
      } catch (err) {
        console.error("Error fetching subcontracts:", err);
        setError("Failed to load subcontracts");
      } finally {
        setLoading(false);
      }
    };

    fetchSubcontracts();
  }, [selectedSite?.id, supabase]);

  const selectedSubcontract = subcontracts.find(
    (sc) => sc.id === selectedSubcontractId
  );

  const handleToggleLink = () => {
    if (selectedSubcontractId) {
      // Unlink
      onSelect(null);
      setIsExpanded(false);
    } else {
      // Show dropdown
      setIsExpanded(true);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `Rs.${(amount / 100000).toFixed(1)}L`;
    }
    return `Rs.${amount.toLocaleString()}`;
  };

  return (
    <Box>
      {/* Link/Unlink Button */}
      {!isExpanded && !selectedSubcontractId && (
        <Button
          startIcon={<LinkIcon />}
          onClick={() => setIsExpanded(true)}
          disabled={disabled || loading}
          variant="outlined"
          size="small"
          sx={{ mb: 1 }}
        >
          Link to Subcontract
        </Button>
      )}

      {/* Selected Subcontract Display */}
      {selectedSubcontract && (
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
              onClick={handleToggleLink}
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
      )}

      {/* Dropdown */}
      <Collapse in={isExpanded && !selectedSubcontractId}>
        <Box sx={{ mt: 1 }}>
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Loading subcontracts...</Typography>
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          ) : subcontracts.length === 0 ? (
            <Alert severity="info" sx={{ mb: 1 }}>
              No active subcontracts found for this site
            </Alert>
          ) : (
            <>
              <FormControl fullWidth size="small">
                <InputLabel>Select Subcontract</InputLabel>
                <Select
                  value={selectedSubcontractId || ""}
                  onChange={(e) => onSelect(e.target.value || null)}
                  label="Select Subcontract"
                  disabled={disabled}
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

              <Button
                size="small"
                onClick={() => setIsExpanded(false)}
                sx={{ mt: 1 }}
              >
                Cancel
              </Button>
            </>
          )}
        </Box>
      </Collapse>

      {/* Info text when no subcontract linked */}
      {!selectedSubcontractId && !isExpanded && (
        <Typography variant="caption" color="text.secondary">
          Payment will be recorded as site expense (not linked to any
          subcontract)
        </Typography>
      )}
    </Box>
  );
}
