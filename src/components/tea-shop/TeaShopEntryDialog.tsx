"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  Close as CloseIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import type { TeaShopAccount, TeaShopEntry, LaborGroupPercentageSplit, TeaShopEntryExtended } from "@/types/database.types";
import SimpleEntryModeContent from "./SimpleEntryModeContent";
import dayjs from "dayjs";

interface TeaShopEntryDialogProps {
  open: boolean;
  onClose: () => void;
  shop: TeaShopAccount;
  entry?: TeaShopEntry | null;
  onSuccess?: () => void;
  initialDate?: string; // Optional: pre-set the date (YYYY-MM-DD format)
}

export default function TeaShopEntryDialog({
  open,
  onClose,
  shop,
  entry,
  onSuccess,
  initialDate,
}: TeaShopEntryDialogProps) {
  const { userProfile } = useAuth();
  const { selectedSite, sites } = useSite();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple mode state
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [simpleTotalCost, setSimpleTotalCost] = useState(0);
  const [percentageSplit, setPercentageSplit] = useState<LaborGroupPercentageSplit>({
    daily: 40,
    contract: 35,
    market: 25,
  });
  const [notes, setNotes] = useState("");

  // Multi-site split state
  const [enableMultiSite, setEnableMultiSite] = useState(false);
  const [secondarySite, setSecondarySite] = useState<typeof selectedSite>(null);
  const [primarySitePercent, setPrimarySitePercent] = useState(50);
  const [secondarySitePercent, setSecondarySitePercent] = useState(50);

  // Handler for site percentage change
  const handleSitePercentChange = (primary: number, secondary: number) => {
    setPrimarySitePercent(primary);
    setSecondarySitePercent(secondary);
  };

  useEffect(() => {
    if (open) {
      if (entry) {
        // Cast entry to extended type to access new fields
        const extEntry = entry as TeaShopEntryExtended;

        setDate(entry.date);
        setNotes(entry.notes || "");

        // Load simple mode fields
        setSimpleTotalCost(extEntry.simple_total_cost || entry.total_amount || 0);
        if (extEntry.percentage_split) {
          setPercentageSplit(extEntry.percentage_split as unknown as LaborGroupPercentageSplit);
        } else {
          setPercentageSplit({ daily: 40, contract: 35, market: 25 });
        }

        // Load multi-site split state
        if (extEntry.is_split_entry && extEntry.split_percentage) {
          setEnableMultiSite(true);
          setPrimarySitePercent(extEntry.split_percentage);
          setSecondarySitePercent(100 - extEntry.split_percentage);
        } else {
          setEnableMultiSite(false);
          setSecondarySite(null);
          setPrimarySitePercent(50);
          setSecondarySitePercent(50);
        }
      } else {
        // New entry - reset form
        setDate(initialDate || dayjs().format("YYYY-MM-DD"));
        setSimpleTotalCost(0);
        setPercentageSplit({ daily: 40, contract: 35, market: 25 });
        setNotes("");
        setEnableMultiSite(false);
        setSecondarySite(null);
        setPrimarySitePercent(50);
        setSecondarySitePercent(50);
      }
      setError(null);
    }
  }, [open, entry, initialDate]);

  const handleSave = async () => {
    // Validate percentage sum
    const percentSum = percentageSplit.daily + percentageSplit.contract + percentageSplit.market;
    if (percentSum !== 100) {
      setError(`Labor group percentages must sum to 100% (currently ${percentSum}%)`);
      return;
    }

    if (simpleTotalCost <= 0) {
      setError("Please enter a total cost");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate the amount for this site (after multi-site split)
      const thisSiteAmount = enableMultiSite && secondarySite
        ? Math.round((primarySitePercent / 100) * simpleTotalCost)
        : simpleTotalCost;

      const entryData: Record<string, unknown> = {
        tea_shop_id: shop.id,
        site_id: shop.site_id,
        date,
        amount: thisSiteAmount,
        total_amount: thisSiteAmount,
        entry_mode: "simple",
        simple_total_cost: simpleTotalCost,
        percentage_split: percentageSplit,
        is_split_entry: enableMultiSite && secondarySite ? true : false,
        split_percentage: enableMultiSite && secondarySite ? primarySitePercent : null,
        split_target_site_id: enableMultiSite && secondarySite ? secondarySite.id : null,
        // Set default detailed fields to 0/null (no longer used)
        tea_rounds: 0,
        tea_rate_per_round: 0,
        tea_total: 0,
        snacks_items: null,
        snacks_total: 0,
        tea_people_count: 0,
        num_rounds: 0,
        num_people: 0,
        market_laborer_count: 0,
        market_laborer_tea_amount: 0,
        market_laborer_snacks_amount: 0,
        market_laborer_total: 0,
        nonworking_laborer_count: 0,
        nonworking_laborer_total: 0,
        working_laborer_count: 0,
        working_laborer_total: 0,
        notes: notes.trim() || null,
        entered_by: userProfile?.name || null,
        entered_by_user_id: userProfile?.id || null,
      };

      if (entry) {
        // Update existing entry
        const updateData = {
          ...entryData,
          updated_by: userProfile?.name || null,
          updated_by_user_id: userProfile?.id || null,
        };

        const { error: updateError } = await (supabase
          .from("tea_shop_entries") as any)
          .update(updateData)
          .eq("id", entry.id);

        if (updateError) throw updateError;

        // Delete existing consumption details (no longer used)
        await (supabase
          .from("tea_shop_consumption_details") as any)
          .delete()
          .eq("entry_id", entry.id);
      } else {
        // New entry
        const { data: insertData, error: insertError } = await (supabase
          .from("tea_shop_entries") as any)
          .insert(entryData)
          .select()
          .single();

        if (insertError) throw insertError;

        // If multi-site split, create entry for secondary site
        if (enableMultiSite && secondarySite) {
          const secondaryAmount = Math.round((secondarySitePercent / 100) * simpleTotalCost);

          // Get or create tea shop for secondary site
          let secondaryShopId = null;

          // Check if secondary site has a tea shop
          const { data: existingShop } = await (supabase
            .from("tea_shop_accounts") as any)
            .select("id")
            .eq("site_id", secondarySite.id)
            .eq("is_active", true)
            .single();

          if (existingShop) {
            secondaryShopId = existingShop.id;
          } else {
            // Create a tea shop for secondary site
            const { data: newShop, error: shopError } = await (supabase
              .from("tea_shop_accounts") as any)
              .insert({
                site_id: secondarySite.id,
                shop_name: "Tea Shop",
                is_active: true,
              })
              .select()
              .single();

            if (shopError) {
              console.error("Error creating tea shop for secondary site:", shopError);
            } else {
              secondaryShopId = newShop.id;
            }
          }

          if (secondaryShopId) {
            const secondaryEntryData = {
              ...entryData,
              tea_shop_id: secondaryShopId,
              site_id: secondarySite.id,
              amount: secondaryAmount,
              total_amount: secondaryAmount,
              split_source_entry_id: insertData.id,
              split_percentage: secondarySitePercent,
              split_target_site_id: shop.site_id, // Primary site is the "target" from secondary's perspective
            };

            await (supabase
              .from("tea_shop_entries") as any)
              .insert(secondaryEntryData);
          }
        }
      }

      onSuccess?.();
    } catch (err: any) {
      console.error("Error saving entry:", err);
      let errorMessage = "Failed to save entry";
      if (err.message) {
        if (err.code === "23505") {
          errorMessage = "An entry already exists for this date. Please edit the existing entry instead.";
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedSite) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              {entry ? "Edit Entry" : "Add Tea/Snacks Entry"}
            </Typography>
            {entry && (
              <Tooltip
                title={
                  <Box>
                    <Typography variant="caption" display="block">
                      <strong>Created by:</strong> {entry.entered_by || "Unknown"}
                    </Typography>
                    <Typography variant="caption" display="block">
                      <strong>Created at:</strong> {dayjs(entry.created_at).format("DD MMM YYYY, hh:mm A")}
                    </Typography>
                    {entry.updated_at && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                        <strong>Last updated:</strong> {dayjs(entry.updated_at).format("DD MMM YYYY, hh:mm A")}
                      </Typography>
                    )}
                  </Box>
                }
              >
                <InfoIcon fontSize="small" color="action" sx={{ cursor: "pointer" }} />
              </Tooltip>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ maxHeight: "70vh" }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <SimpleEntryModeContent
          date={date}
          onDateChange={setDate}
          totalCost={simpleTotalCost}
          onTotalCostChange={setSimpleTotalCost}
          percentageSplit={percentageSplit}
          onPercentageSplitChange={setPercentageSplit}
          notes={notes}
          onNotesChange={setNotes}
          enableMultiSite={enableMultiSite}
          onEnableMultiSiteChange={setEnableMultiSite}
          primarySite={selectedSite}
          secondarySite={secondarySite}
          onSecondarySiteChange={setSecondarySite}
          primarySitePercent={primarySitePercent}
          secondarySitePercent={secondarySitePercent}
          onSitePercentChange={handleSitePercentChange}
          availableSites={sites}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || simpleTotalCost <= 0}
        >
          {loading ? <CircularProgress size={24} /> : entry ? "Update" : "Save Entry"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
