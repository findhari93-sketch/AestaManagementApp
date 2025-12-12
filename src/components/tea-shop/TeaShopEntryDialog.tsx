"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  FormControlLabel,
  Switch,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from "@mui/material";
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  LocalCafe,
  Fastfood,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  EventBusy as EventBusyIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Assignment as AssignmentIcon,
  Speed as SpeedIcon,
  ListAlt as ListAltIcon,
} from "@mui/icons-material";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import type { TeaShopAccount, TeaShopEntry, SnackItem, Laborer, TeaShopEntryMode, LaborGroupPercentageSplit, TeaShopEntryExtended } from "@/types/database.types";
import SimpleEntryModeContent from "./SimpleEntryModeContent";
import dayjs from "dayjs";

interface PreSelectedLaborer {
  id: string;
  name: string;
  laborer_type: string;
}

interface TeaShopEntryDialogProps {
  open: boolean;
  onClose: () => void;
  shop: TeaShopAccount;
  entry?: TeaShopEntry | null;
  onSuccess?: () => void;
  initialDate?: string; // Optional: pre-set the date (YYYY-MM-DD format)
  preSelectedLaborers?: PreSelectedLaborer[]; // Laborers from AttendanceDrawer (in-memory)
  initialMarketCount?: number; // Market laborer count from AttendanceDrawer
}

interface LaborerWithConsumption {
  id: string;
  name: string;
  type: string;
  selected: boolean;
  teaAmount: number;
  snacksAmount: number;
  snackItems: Record<string, number>;
  omitFromTea: boolean;      // If true, skip during tea distribution
  omitFromSnacks: boolean;   // If true, skip during snacks distribution
}

interface NonWorkingLaborer {
  id: string;
  name: string;
  type: string;
  teaAmount: number;
  snacksAmount: number;
  snackItems: Record<string, number>;  // Track snack item distribution
  omitFromTea: boolean;
  omitFromSnacks: boolean;
}

const DEFAULT_SNACK_ITEMS = ["Vada", "Bajji", "Bonda", "Puff", "Biscuit"];

// Helper to convert tea amount to fraction (e.g., 8.33 of 25 = "1/3")
const teaAmountToFraction = (amount: number, ratePerRound: number): string => {
  if (ratePerRound === 0 || amount === 0) return "";
  const ratio = amount / ratePerRound;

  // Check common fractions
  if (Math.abs(ratio - 1) < 0.02) return "1 tea";
  if (Math.abs(ratio - 0.5) < 0.02) return "1/2 tea";
  if (Math.abs(ratio - 0.333) < 0.02) return "1/3 tea";
  if (Math.abs(ratio - 0.25) < 0.02) return "1/4 tea";
  if (Math.abs(ratio - 0.667) < 0.02) return "2/3 tea";
  if (Math.abs(ratio - 0.75) < 0.02) return "3/4 tea";
  if (Math.abs(ratio - 0.2) < 0.02) return "1/5 tea";
  if (Math.abs(ratio - 0.4) < 0.02) return "2/5 tea";
  if (Math.abs(ratio - 0.6) < 0.02) return "3/5 tea";
  if (Math.abs(ratio - 0.8) < 0.02) return "4/5 tea";
  if (Math.abs(ratio - 0.167) < 0.02) return "1/6 tea";
  if (Math.abs(ratio - 0.833) < 0.02) return "5/6 tea";
  if (Math.abs(ratio - 0.143) < 0.02) return "1/7 tea";
  if (Math.abs(ratio - 0.125) < 0.02) return "1/8 tea";

  // For non-standard fractions, show decimal
  return `${ratio.toFixed(2)} tea`;
};

// Helper to calculate snack distribution per person
const calculateSnackDistribution = (
  snackItems: SnackItem[],
  recipientCount: number
): Record<string, number> => {
  if (recipientCount === 0) return {};
  const distribution: Record<string, number> = {};
  snackItems.forEach((item) => {
    const perPerson = Math.round(item.quantity / recipientCount);
    if (perPerson > 0) {
      distribution[item.name] = perPerson;
    }
  });
  return distribution;
};

export default function TeaShopEntryDialog({
  open,
  onClose,
  shop,
  entry,
  onSuccess,
  initialDate,
  preSelectedLaborers,
  initialMarketCount,
}: TeaShopEntryDialogProps) {
  const { userProfile } = useAuth();
  const { selectedSite, sites } = useSite();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entry mode state (simple or detailed)
  const [entryMode, setEntryMode] = useState<TeaShopEntryMode>("simple");

  // Simple mode state
  const [simpleTotalCost, setSimpleTotalCost] = useState(0);
  const [percentageSplit, setPercentageSplit] = useState<LaborGroupPercentageSplit>({
    daily: 40,
    contract: 35,
    market: 25,
  });
  const [enableMultiSite, setEnableMultiSite] = useState(false);
  const [secondarySite, setSecondarySite] = useState<typeof selectedSite>(null);
  const [primarySitePercent, setPrimarySitePercent] = useState(50);
  const [secondarySitePercent, setSecondarySitePercent] = useState(50);

  // Form state
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [teaRounds, setTeaRounds] = useState(2);
  const [teaRatePerRound, setTeaRatePerRound] = useState(25);
  const [snackItems, setSnackItems] = useState<SnackItem[]>([]);
  const [notes, setNotes] = useState("");

  // New snack item form
  const [newSnackName, setNewSnackName] = useState("");
  const [newSnackQty, setNewSnackQty] = useState(1);
  const [newSnackRate, setNewSnackRate] = useState(10);

  // Working laborers (from attendance)
  const [workingLaborers, setWorkingLaborers] = useState<LaborerWithConsumption[]>([]);
  const [loadingLaborers, setLoadingLaborers] = useState(false);

  // Non-working laborers (on leave but consumed)
  const [nonWorkingLaborers, setNonWorkingLaborers] = useState<NonWorkingLaborer[]>([]);
  const [allSiteLaborers, setAllSiteLaborers] = useState<Laborer[]>([]);
  const [selectedNonWorkingLaborer, setSelectedNonWorkingLaborer] = useState<Laborer | null>(null);

  // Market laborers (anonymous group)
  const [marketLaborerCount, setMarketLaborerCount] = useState(0);
  const [marketTeaAmount, setMarketTeaAmount] = useState(0);
  const [marketSnacksAmount, setMarketSnacksAmount] = useState(0);

  // Accordion expansion state
  const [expandedSections, setExpandedSections] = useState<string[]>(["tea", "snacks", "working"]);

  // Smart state: Attendance check
  const [hasAttendance, setHasAttendance] = useState<boolean | null>(null); // null = checking, true/false = result
  const [isQuickEntryMode, setIsQuickEntryMode] = useState(false);

  // Calculate totals
  const teaTotal = useMemo(() => {
    return teaRounds * teaRatePerRound;
  }, [teaRounds, teaRatePerRound]);

  const snacksTotal = useMemo(() => {
    return snackItems.reduce((sum, item) => sum + item.total, 0);
  }, [snackItems]);

  const grandTotal = teaTotal + snacksTotal;

  // Calculate category totals
  const workingTotal = useMemo(() => {
    return workingLaborers
      .filter((l) => l.selected)
      .reduce((sum, l) => sum + l.teaAmount + l.snacksAmount, 0);
  }, [workingLaborers]);

  const nonWorkingTotal = useMemo(() => {
    return nonWorkingLaborers.reduce((sum, l) => sum + l.teaAmount + l.snacksAmount, 0);
  }, [nonWorkingLaborers]);

  const marketTotal = marketTeaAmount + marketSnacksAmount;

  const assignedTotal = Math.round((workingTotal + nonWorkingTotal + marketTotal) * 100) / 100;
  // Round to avoid floating-point precision issues (e.g., 0.01 over-assigned)
  // Use threshold of 0.02 to ignore very small differences from distribution rounding
  const rawDifference = grandTotal - assignedTotal;
  const unassignedAmount = Math.abs(rawDifference) < 0.02 ? 0 : Math.round(rawDifference * 100) / 100;

  // Selected working laborers count
  const selectedWorkingCount = useMemo(() => {
    return workingLaborers.filter((l) => l.selected).length;
  }, [workingLaborers]);

  // Recipient counts for distribution (excludes omitted laborers)
  const teaRecipientCount = useMemo(() => {
    const workingTeaCount = workingLaborers.filter((l) => l.selected && !l.omitFromTea).length;
    const nonWorkingTeaCount = nonWorkingLaborers.filter((l) => !l.omitFromTea).length;
    return workingTeaCount + nonWorkingTeaCount + marketLaborerCount;
  }, [workingLaborers, nonWorkingLaborers, marketLaborerCount]);

  const snacksRecipientCount = useMemo(() => {
    const workingSnacksCount = workingLaborers.filter((l) => l.selected && !l.omitFromSnacks).length;
    const nonWorkingSnacksCount = nonWorkingLaborers.filter((l) => !l.omitFromSnacks).length;
    return workingSnacksCount + nonWorkingSnacksCount + marketLaborerCount;
  }, [workingLaborers, nonWorkingLaborers, marketLaborerCount]);

  // Fetch working laborers when date changes (check attendance first)
  const fetchWorkingLaborers = useCallback(async () => {
    if (!selectedSite || !date) return;

    setLoadingLaborers(true);
    setHasAttendance(null); // Reset to checking state

    try {
      // If we have pre-selected laborers from AttendanceDrawer, use those directly
      // This happens when tea dialog is opened from within attendance entry (before saving)
      if (preSelectedLaborers && preSelectedLaborers.length > 0) {
        setHasAttendance(true);
        const laborers: LaborerWithConsumption[] = preSelectedLaborers.map((l) => ({
          id: l.id,
          name: l.name,
          type: l.laborer_type || "daily",
          selected: false,
          teaAmount: 0,
          snacksAmount: 0,
          snackItems: {},
          omitFromTea: false,
          omitFromSnacks: false,
        }));
        setWorkingLaborers(laborers);

        // Set market laborer count from prop if provided
        if (initialMarketCount !== undefined && initialMarketCount > 0) {
          setMarketLaborerCount(initialMarketCount);
        }
        setLoadingLaborers(false);
        return;
      }

      // Otherwise, query database for attendance (normal flow when opening from tea shop page)
      // First check if attendance exists for this date
      const { data: attendanceData, count } = await (supabase
        .from("daily_attendance") as any)
        .select("laborer_id, laborers:laborer_id (id, name, laborer_type)", { count: "exact" })
        .eq("site_id", selectedSite.id)
        .eq("date", date);

      // Also check for market laborers in attendance
      const { data: marketData } = await (supabase
        .from("market_laborer_attendance") as any)
        .select("count")
        .eq("site_id", selectedSite.id)
        .eq("date", date);

      const hasNamedLaborers = (count || 0) > 0;
      const hasMarketLaborers = (marketData || []).reduce((sum: number, m: any) => sum + (m.count || 0), 0) > 0;
      const attendanceExists = hasNamedLaborers || hasMarketLaborers;

      setHasAttendance(attendanceExists);

      if (attendanceExists && attendanceData) {
        const laborers: LaborerWithConsumption[] = attendanceData
          .filter((att: any) => att.laborers)
          .map((att: any) => ({
            id: att.laborers.id,
            name: att.laborers.name,
            type: att.laborers.laborer_type || "daily",
            selected: false,
            teaAmount: 0,
            snacksAmount: 0,
            snackItems: {},
            omitFromTea: false,
            omitFromSnacks: false,
          }));

        const uniqueLaborers = laborers.filter(
          (l, index, self) => index === self.findIndex((t) => t.id === l.id)
        );

        setWorkingLaborers(uniqueLaborers);

        // Auto-set market laborer count from attendance
        if (marketData && marketData.length > 0) {
          const totalMarketCount = marketData.reduce((sum: number, m: any) => sum + (m.count || 0), 0);
          setMarketLaborerCount(totalMarketCount);
        }
      } else {
        setWorkingLaborers([]);
      }
    } catch (err) {
      console.error("Error fetching working laborers:", err);
      setHasAttendance(false);
    } finally {
      setLoadingLaborers(false);
    }
  }, [selectedSite, date, supabase, preSelectedLaborers, initialMarketCount]);

  // Fetch all site laborers for non-working selection
  const fetchAllSiteLaborers = useCallback(async () => {
    if (!selectedSite) return;

    try {
      const { data } = await (supabase
        .from("laborers") as any)
        .select("id, name, laborer_type")
        .eq("status", "active")
        .order("name");

      setAllSiteLaborers(data || []);
    } catch (err) {
      console.error("Error fetching all laborers:", err);
    }
  }, [selectedSite, supabase]);

  // Handler for site percentage change
  const handleSitePercentChange = (primary: number, secondary: number) => {
    setPrimarySitePercent(primary);
    setSecondarySitePercent(secondary);
  };

  useEffect(() => {
    if (open) {
      // Reset quick entry mode on dialog open
      setIsQuickEntryMode(false);
      setHasAttendance(null);

      if (entry) {
        // Cast entry to extended type to access new fields
        const extEntry = entry as TeaShopEntryExtended;

        // Determine entry mode from existing entry
        const mode = extEntry.entry_mode || "detailed";
        setEntryMode(mode);

        setDate(entry.date);
        setTeaRounds(entry.tea_rounds || 0);
        setTeaRatePerRound(entry.tea_rate_per_round || 0);
        setSnackItems((entry.snacks_items as unknown as SnackItem[]) || []);
        setNotes(entry.notes || "");
        setMarketLaborerCount(entry.market_laborer_count || 0);
        setMarketTeaAmount(entry.market_laborer_tea_amount || 0);
        setMarketSnacksAmount(entry.market_laborer_snacks_amount || 0);

        // Load simple mode fields if available
        if (mode === "simple") {
          setSimpleTotalCost(extEntry.simple_total_cost || entry.total_amount || 0);
          if (extEntry.percentage_split) {
            setPercentageSplit(extEntry.percentage_split);
          }
          if (extEntry.is_split_entry && extEntry.split_percentage) {
            setEnableMultiSite(true);
            setPrimarySitePercent(extEntry.split_percentage);
            setSecondarySitePercent(100 - extEntry.split_percentage);
          }
        }
      } else {
        // Default to simple mode for new entries
        setEntryMode("simple");
        setDate(initialDate || dayjs().format("YYYY-MM-DD"));
        setTeaRounds(2);
        setTeaRatePerRound(25);
        setSnackItems([]);
        setNotes("");
        setMarketLaborerCount(0);
        setMarketTeaAmount(0);
        setMarketSnacksAmount(0);
        setWorkingLaborers([]);
        setNonWorkingLaborers([]);

        // Reset simple mode fields
        setSimpleTotalCost(0);
        setPercentageSplit({ daily: 40, contract: 35, market: 25 });
        setEnableMultiSite(false);
        setSecondarySite(null);
        setPrimarySitePercent(50);
        setSecondarySitePercent(50);
      }
      setNewSnackName("");
      setNewSnackQty(1);
      setNewSnackRate(10);
      setError(null);

      fetchAllSiteLaborers();
    }
  }, [open, entry, initialDate, fetchAllSiteLaborers]);

  useEffect(() => {
    if (open && date) {
      fetchWorkingLaborers();
    }
  }, [open, date, fetchWorkingLaborers]);

  // Toggle omit from distribution
  const handleToggleOmit = (id: string, type: "tea" | "snacks", category: "working" | "nonworking") => {
    if (category === "working") {
      setWorkingLaborers((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                omitFromTea: type === "tea" ? !l.omitFromTea : l.omitFromTea,
                omitFromSnacks: type === "snacks" ? !l.omitFromSnacks : l.omitFromSnacks,
              }
            : l
        )
      );
    } else {
      setNonWorkingLaborers((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                omitFromTea: type === "tea" ? !l.omitFromTea : l.omitFromTea,
                omitFromSnacks: type === "snacks" ? !l.omitFromSnacks : l.omitFromSnacks,
              }
            : l
        )
      );
    }
  };

  // Distribute tea among eligible recipients
  const handleDistributeTea = () => {
    if (teaRecipientCount === 0 || teaTotal === 0) return;

    const perPersonTea = Math.round((teaTotal / teaRecipientCount) * 100) / 100;

    setWorkingLaborers((prev) =>
      prev.map((l) => ({
        ...l,
        teaAmount: l.selected && !l.omitFromTea ? perPersonTea : l.teaAmount,
      }))
    );

    setNonWorkingLaborers((prev) =>
      prev.map((l) => ({
        ...l,
        teaAmount: !l.omitFromTea ? perPersonTea : l.teaAmount,
      }))
    );

    if (marketLaborerCount > 0) {
      setMarketTeaAmount(perPersonTea * marketLaborerCount);
    }
  };

  // Distribute snacks among eligible recipients
  const handleDistributeSnacks = () => {
    if (snacksRecipientCount === 0 || snacksTotal === 0) return;

    const perPersonSnacks = Math.round((snacksTotal / snacksRecipientCount) * 100) / 100;

    // Calculate per-person snack item distribution
    const perPersonSnackItems = calculateSnackDistribution(snackItems, snacksRecipientCount);

    setWorkingLaborers((prev) =>
      prev.map((l) => ({
        ...l,
        snacksAmount: l.selected && !l.omitFromSnacks ? perPersonSnacks : l.snacksAmount,
        snackItems: l.selected && !l.omitFromSnacks ? perPersonSnackItems : l.snackItems,
      }))
    );

    setNonWorkingLaborers((prev) =>
      prev.map((l) => ({
        ...l,
        snacksAmount: !l.omitFromSnacks ? perPersonSnacks : l.snacksAmount,
        snackItems: !l.omitFromSnacks ? perPersonSnackItems : l.snackItems,
      }))
    );

    if (marketLaborerCount > 0) {
      setMarketSnacksAmount(perPersonSnacks * marketLaborerCount);
    }
  };

  const handleToggleWorkingLaborer = (id: string) => {
    setWorkingLaborers((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, selected: !l.selected, teaAmount: 0, snacksAmount: 0 } : l
      )
    );
  };

  const handleSelectAllWorking = () => {
    const allSelected = workingLaborers.every((l) => l.selected);
    setWorkingLaborers((prev) =>
      prev.map((l) => ({ ...l, selected: !allSelected }))
    );
  };

  const handleAddNonWorkingLaborer = () => {
    if (!selectedNonWorkingLaborer) return;

    if (nonWorkingLaborers.some((l) => l.id === selectedNonWorkingLaborer.id)) {
      setError("This laborer is already added");
      return;
    }

    if (workingLaborers.some((l) => l.id === selectedNonWorkingLaborer.id)) {
      setError("This laborer is already in working list for this date");
      return;
    }

    setNonWorkingLaborers((prev) => [
      ...prev,
      {
        id: selectedNonWorkingLaborer.id,
        name: selectedNonWorkingLaborer.name,
        type: selectedNonWorkingLaborer.laborer_type || selectedNonWorkingLaborer.employment_type || "daily",
        teaAmount: 0,
        snacksAmount: 0,
        snackItems: {},
        omitFromTea: false,
        omitFromSnacks: false,
      },
    ]);
    setSelectedNonWorkingLaborer(null);
    setError(null);
  };

  const handleRemoveNonWorkingLaborer = (id: string) => {
    setNonWorkingLaborers((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddSnackItem = () => {
    if (!newSnackName.trim()) return;

    const newItem: SnackItem = {
      name: newSnackName.trim(),
      quantity: newSnackQty,
      rate: newSnackRate,
      total: newSnackQty * newSnackRate,
    };

    setSnackItems([...snackItems, newItem]);
    setNewSnackName("");
    setNewSnackQty(1);
    setNewSnackRate(10);
  };

  const handleRemoveSnackItem = (index: number) => {
    setSnackItems(snackItems.filter((_, i) => i !== index));
  };

  const handleUpdateSnackItem = (index: number, field: keyof SnackItem, value: number) => {
    const updated = [...snackItems];
    updated[index] = {
      ...updated[index],
      [field]: value,
      total:
        field === "quantity"
          ? value * updated[index].rate
          : field === "rate"
          ? updated[index].quantity * value
          : updated[index].total,
    };
    setSnackItems(updated);
  };

  const handleToggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  // Simple mode save handler
  const handleSimpleSave = async () => {
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
        // Set default detailed fields to 0/null for simple mode
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

        // Delete existing consumption details since simple mode doesn't use them
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
      console.error("Error saving simple entry:", err);
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

  const handleSave = async () => {
    // Route to appropriate save handler based on entry mode
    if (entryMode === "simple") {
      return handleSimpleSave();
    }

    // Detailed mode save (existing logic)
    if (grandTotal <= 0) {
      setError("Please enter tea or snack items");
      return;
    }

    if (unassignedAmount !== 0 && assignedTotal > 0) {
      const proceed = window.confirm(
        `₹${Math.abs(unassignedAmount).toLocaleString()} is ${unassignedAmount > 0 ? "unassigned" : "over-assigned"}. Continue anyway?`
      );
      if (!proceed) return;
    }

    setLoading(true);
    setError(null);

    try {
      const totalPeopleCount = selectedWorkingCount + nonWorkingLaborers.length + marketLaborerCount;

      const entryData: Record<string, unknown> = {
        tea_shop_id: shop.id,
        site_id: shop.site_id,
        date,
        amount: grandTotal,
        tea_rounds: teaRounds,
        tea_people_count: totalPeopleCount,
        tea_rate_per_round: teaRatePerRound,
        tea_total: teaTotal,
        snacks_items: snackItems,
        snacks_total: snacksTotal,
        total_amount: grandTotal,
        num_rounds: teaRounds,
        num_people: totalPeopleCount,
        market_laborer_count: marketLaborerCount,
        market_laborer_tea_amount: marketTeaAmount,
        market_laborer_snacks_amount: marketSnacksAmount,
        market_laborer_total: marketTotal,
        nonworking_laborer_count: nonWorkingLaborers.length,
        nonworking_laborer_total: nonWorkingTotal,
        working_laborer_count: selectedWorkingCount,
        working_laborer_total: workingTotal,
        notes: notes.trim() || null,
        entered_by: userProfile?.name || null,
        entered_by_user_id: userProfile?.id || null,
      };

      let entryId: string;

      if (entry) {
        // Update existing entry - add updated_by fields
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
        entryId = entry.id;

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
        entryId = insertData.id;
      }

      const workingDetails = workingLaborers
        .filter((l) => l.selected)
        .map((l) => ({
          entry_id: entryId,
          laborer_id: l.id,
          laborer_name: l.name,
          laborer_type: l.type,
          tea_rounds: teaRounds,
          tea_amount: l.teaAmount,
          snacks_items: l.snackItems,
          snacks_amount: l.snacksAmount,
          total_amount: l.teaAmount + l.snacksAmount,
          is_working: true,
        }));

      const nonWorkingDetails = nonWorkingLaborers.map((l) => ({
        entry_id: entryId,
        laborer_id: l.id,
        laborer_name: l.name,
        laborer_type: l.type,
        tea_rounds: 0,
        tea_amount: l.teaAmount,
        snacks_items: l.snackItems,
        snacks_amount: l.snacksAmount,
        total_amount: l.teaAmount + l.snacksAmount,
        is_working: false,
      }));

      const allDetails = [...workingDetails, ...nonWorkingDetails];

      if (allDetails.length > 0) {
        const { error: detailsError } = await (supabase
          .from("tea_shop_consumption_details") as any)
          .insert(allDetails);

        if (detailsError) throw detailsError;
      }

      for (const detail of workingDetails) {
        if (detail.total_amount > 0) {
          const { data: workLog } = await ((supabase as any)
            .from("work_logs"))
            .select("id, snacks_amount")
            .eq("laborer_id", detail.laborer_id)
            .eq("work_date", date)
            .eq("is_deleted", false)
            .single();

          if (workLog) {
            const newSnacksAmount = (workLog.snacks_amount || 0) + detail.total_amount;
            await ((supabase as any)
              .from("work_logs"))
              .update({ snacks_amount: newSnacksAmount })
              .eq("id", workLog.id);
          }
        }
      }

      onSuccess?.();
    } catch (err: any) {
      console.error("Error saving entry:", err);

      // Provide user-friendly error messages
      let errorMessage = "Failed to save entry";
      if (err.message) {
        if (err.code === "23505") {
          errorMessage = "An entry already exists for this date. Please edit the existing entry instead.";
        } else if (err.code === "23503") {
          errorMessage = "Cannot save: Invalid shop or site reference";
        } else if (err.message.includes("permission") || err.code === "42501") {
          errorMessage = "Permission denied. Please contact administrator";
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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

        {/* Mode Toggle */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <ToggleButtonGroup
            value={entryMode}
            exclusive
            onChange={(_, mode) => mode && setEntryMode(mode)}
            size="small"
          >
            <ToggleButton value="simple" sx={{ px: 2 }}>
              <SpeedIcon sx={{ mr: 0.5 }} fontSize="small" />
              Simple
            </ToggleButton>
            <ToggleButton value="detailed" sx={{ px: 2 }}>
              <ListAltIcon sx={{ mr: 0.5 }} fontSize="small" />
              Detailed
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Simple Mode Content */}
        {entryMode === "simple" && selectedSite && (
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
        )}

        {/* Detailed Mode Content */}
        {entryMode === "detailed" && (
          <>
            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ mb: 3 }}
            />

        {/* No Attendance Warning - Show guidance when no attendance exists */}
        {hasAttendance === false && !isQuickEntryMode && !entry && (
          <Paper
            sx={{
              p: 3,
              mb: 3,
              bgcolor: "warning.light",
              border: "1px solid",
              borderColor: "warning.main",
              borderRadius: 2
            }}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
              <WarningIcon color="warning" sx={{ mt: 0.5 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  No Attendance Found for {dayjs(date).format("DD MMM YYYY")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  To track tea/snacks consumption per laborer, attendance must be entered first.
                </Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AssignmentIcon />}
                    onClick={onClose}
                    sx={{ textTransform: "none" }}
                  >
                    Enter Attendance First
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<SpeedIcon />}
                    onClick={() => {
                      setIsQuickEntryMode(true);
                      setExpandedSections(["tea", "snacks", "market"]);
                    }}
                    sx={{ textTransform: "none" }}
                  >
                    Quick Entry (Market Only)
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                  Quick entry records tea/snacks as market laborer group total without individual tracking.
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Quick Entry Mode Banner */}
        {isQuickEntryMode && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setIsQuickEntryMode(false)}
              >
                Cancel
              </Button>
            }
          >
            <Typography variant="body2" fontWeight={500}>
              Quick Entry Mode - Recording as market laborers only
            </Typography>
          </Alert>
        )}

        {/* Tea Section */}
        <Accordion
          expanded={expandedSections.includes("tea")}
          onChange={() => handleToggleSection("tea")}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
              <LocalCafe color="primary" />
              <Typography fontWeight={600}>Tea</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Chip label={`₹${teaTotal.toLocaleString()}`} color="primary" size="small" />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
              <TextField
                label="Rounds"
                type="number"
                value={teaRounds}
                onChange={(e) => setTeaRounds(Math.max(0, parseInt(e.target.value) || 0))}
                size="small"
                sx={{ width: 100 }}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <TextField
                label="Rate/Round"
                type="number"
                value={teaRatePerRound}
                onChange={(e) => setTeaRatePerRound(Math.max(0, parseFloat(e.target.value) || 0))}
                size="small"
                sx={{ width: 120 }}
                slotProps={{
                  htmlInput: { min: 0 },
                  input: { startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> },
                }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {teaRounds} rounds × ₹{teaRatePerRound}/round = <strong>₹{teaTotal.toLocaleString()}</strong>
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* Snacks Section */}
        <Accordion
          expanded={expandedSections.includes("snacks")}
          onChange={() => handleToggleSection("snacks")}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
              <Fastfood color="secondary" />
              <Typography fontWeight={600}>Snacks</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Chip label={`₹${snacksTotal.toLocaleString()}`} color="secondary" size="small" />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {snackItems.length > 0 && (
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Item</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Qty</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Rate</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Total</TableCell>
                    <TableCell width={40}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {snackItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateSnackItem(index, "quantity", parseInt(e.target.value) || 0)
                          }
                          size="small"
                          sx={{ width: 60 }}
                          slotProps={{ htmlInput: { min: 0, style: { textAlign: "center" } } }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          value={item.rate}
                          onChange={(e) =>
                            handleUpdateSnackItem(index, "rate", parseFloat(e.target.value) || 0)
                          }
                          size="small"
                          sx={{ width: 70 }}
                          slotProps={{ htmlInput: { min: 0, style: { textAlign: "center" } } }}
                        />
                      </TableCell>
                      <TableCell align="right">₹{item.total}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleRemoveSnackItem(index)}>
                          <DeleteIcon fontSize="small" color="error" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", flexWrap: "wrap" }}>
              <TextField
                label="Item"
                value={newSnackName}
                onChange={(e) => setNewSnackName(e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 100 }}
                placeholder="Vada, Bajji..."
              />
              <TextField
                label="Qty"
                type="number"
                value={newSnackQty}
                onChange={(e) => setNewSnackQty(Math.max(1, parseInt(e.target.value) || 1))}
                size="small"
                sx={{ width: 60 }}
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <TextField
                label="Rate"
                type="number"
                value={newSnackRate}
                onChange={(e) => setNewSnackRate(Math.max(0, parseFloat(e.target.value) || 0))}
                size="small"
                sx={{ width: 80 }}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddSnackItem}
                disabled={!newSnackName.trim()}
              >
                Add
              </Button>
            </Box>

            <Box sx={{ mt: 2, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {DEFAULT_SNACK_ITEMS.map((item) => (
                <Button
                  key={item}
                  size="small"
                  variant="text"
                  onClick={() => setNewSnackName(item)}
                  sx={{ textTransform: "none" }}
                >
                  {item}
                </Button>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Grand Total */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: "primary.main", color: "white" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle1">GRAND TOTAL</Typography>
            <Typography variant="h5" fontWeight={700}>
              ₹{grandTotal.toLocaleString()}
            </Typography>
          </Box>
        </Paper>

        {/* WHO CONSUMED section - only show when attendance exists or in quick entry mode */}
        {(hasAttendance || isQuickEntryMode) && (
          <>
            <Divider sx={{ my: 3 }}>
              <Chip label="WHO CONSUMED?" size="small" />
            </Divider>

            {/* Working Laborers Section - Hide in quick entry mode */}
            {!isQuickEntryMode && (
              <Accordion
                expanded={expandedSections.includes("working")}
                onChange={() => handleToggleSection("working")}
                sx={{ mb: 2 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                    <PersonIcon color="success" />
                    <Typography fontWeight={600}>Working Laborers</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      (from attendance)
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Chip
                      label={`${selectedWorkingCount} • ₹${workingTotal.toLocaleString()}`}
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {loadingLaborers ? (
                    <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : workingLaborers.length === 0 ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      No laborers found in attendance for {dayjs(date).format("DD MMM YYYY")}
                    </Alert>
                  ) : (
                    <>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                        <Button size="small" onClick={handleSelectAllWorking}>
                          {workingLaborers.every((l) => l.selected) ? "Deselect All" : "Select All"}
                        </Button>
                      </Box>
                      {/* Distribution Controls */}
                      <Box sx={{ display: "flex", gap: 1, p: 1.5, bgcolor: "grey.50", borderRadius: 1, mb: 2 }}>
                        <Box sx={{ flex: 1, textAlign: "center" }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Tea: ₹{teaTotal} → {teaRecipientCount} people
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<LocalCafe />}
                            onClick={handleDistributeTea}
                            disabled={teaRecipientCount === 0 || teaTotal === 0}
                            sx={{ mt: 0.5 }}
                          >
                            Distribute Tea
                          </Button>
                        </Box>
                        <Divider orientation="vertical" flexItem />
                        <Box sx={{ flex: 1, textAlign: "center" }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Snacks: ₹{snacksTotal} → {snacksRecipientCount} people
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            startIcon={<Fastfood />}
                            onClick={handleDistributeSnacks}
                            disabled={snacksRecipientCount === 0 || snacksTotal === 0}
                            sx={{ mt: 0.5 }}
                          >
                            Distribute Snacks
                          </Button>
                        </Box>
                      </Box>
                      <Box sx={{ maxHeight: 200, overflow: "auto" }}>
                        {workingLaborers.map((laborer) => (
                          <Box
                            key={laborer.id}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              py: 0.5,
                              borderBottom: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Checkbox
                              checked={laborer.selected}
                              onChange={() => handleToggleWorkingLaborer(laborer.id)}
                              size="small"
                            />
                            <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
                              <Typography variant="body2">{laborer.name}</Typography>
                              <Chip
                                label={laborer.type}
                                size="small"
                                sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
                              />
                            </Box>
                            {laborer.selected && (
                              <>
                                <Tooltip title={teaAmountToFraction(laborer.teaAmount, teaRatePerRound) || "Tea amount"}>
                                  <TextField
                                    label={teaAmountToFraction(laborer.teaAmount, teaRatePerRound) || "Tea"}
                                    type="number"
                                    value={laborer.teaAmount}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      setWorkingLaborers((prev) =>
                                        prev.map((l) =>
                                          l.id === laborer.id ? { ...l, teaAmount: value } : l
                                        )
                                      );
                                    }}
                                    size="small"
                                    sx={{ width: 80 }}
                                    slotProps={{ htmlInput: { min: 0 } }}
                                  />
                                </Tooltip>
                                <Tooltip title={Object.entries(laborer.snackItems).map(([name, qty]) => `${name}: ${qty}`).join(", ") || "Snacks amount"}>
                                  <TextField
                                    label={Object.keys(laborer.snackItems).length > 0 ? Object.entries(laborer.snackItems).map(([n, q]) => `${n}:${q}`).join(" ") : "Snacks"}
                                    type="number"
                                    value={laborer.snacksAmount}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      setWorkingLaborers((prev) =>
                                        prev.map((l) =>
                                          l.id === laborer.id ? { ...l, snacksAmount: value } : l
                                        )
                                      );
                                    }}
                                    size="small"
                                    sx={{ width: 100 }}
                                    slotProps={{ htmlInput: { min: 0 } }}
                                  />
                                </Tooltip>
                                {/* Omit toggles */}
                                <Box sx={{ display: "flex", gap: 0.25 }}>
                                  <Tooltip title={laborer.omitFromTea ? "Include in tea distribution" : "Omit from tea distribution"}>
                                    <IconButton
                                      size="small"
                                      color={laborer.omitFromTea ? "default" : "warning"}
                                      onClick={() => handleToggleOmit(laborer.id, "tea", "working")}
                                      sx={{ p: 0.25 }}
                                    >
                                      <LocalCafe fontSize="small" sx={{ opacity: laborer.omitFromTea ? 0.3 : 1 }} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={laborer.omitFromSnacks ? "Include in snacks distribution" : "Omit from snacks distribution"}>
                                    <IconButton
                                      size="small"
                                      color={laborer.omitFromSnacks ? "default" : "secondary"}
                                      onClick={() => handleToggleOmit(laborer.id, "snacks", "working")}
                                      sx={{ p: 0.25 }}
                                    >
                                      <Fastfood fontSize="small" sx={{ opacity: laborer.omitFromSnacks ? 0.3 : 1 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}
              </AccordionDetails>
            </Accordion>
            )}

            {/* Non-Working Laborers Section - Hide in quick entry mode */}
            {!isQuickEntryMode && (
              <Accordion
                expanded={expandedSections.includes("nonworking")}
                onChange={() => handleToggleSection("nonworking")}
                sx={{ mb: 2 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                    <EventBusyIcon color="warning" />
                    <Typography fontWeight={600}>Non-Working Laborers</Typography>
                    <Tooltip title="Laborers on leave who still consumed tea/snacks">
                      <InfoIcon fontSize="small" color="action" sx={{ ml: 0.5 }} />
                    </Tooltip>
                    <Box sx={{ flexGrow: 1 }} />
                    <Chip
                      label={`${nonWorkingLaborers.length} • ₹${nonWorkingTotal.toLocaleString()}`}
                      color="warning"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                    <Autocomplete
                      value={selectedNonWorkingLaborer}
                      onChange={(_, newValue) => setSelectedNonWorkingLaborer(newValue)}
                      options={allSiteLaborers.filter(
                        (l) =>
                          !workingLaborers.some((wl) => wl.id === l.id) &&
                          !nonWorkingLaborers.some((nl) => nl.id === l.id)
                      )}
                      getOptionLabel={(option) => `${option.name} (${option.laborer_type || option.employment_type || "daily"})`}
                      renderInput={(params) => (
                        <TextField {...params} label="Select Laborer" size="small" />
                      )}
                      sx={{ flex: 1 }}
                      size="small"
                    />
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleAddNonWorkingLaborer}
                      disabled={!selectedNonWorkingLaborer}
                    >
                      Add
                    </Button>
                  </Box>

                  {nonWorkingLaborers.length > 0 && (
                    <Box>
                      {nonWorkingLaborers.map((laborer) => (
                        <Box
                          key={laborer.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            py: 0.5,
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
                            <Typography variant="body2">{laborer.name}</Typography>
                            <Chip
                              label={laborer.type}
                              size="small"
                              sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
                            />
                          </Box>
                          <Tooltip title={teaAmountToFraction(laborer.teaAmount, teaRatePerRound) || "Tea amount"}>
                            <TextField
                              label={teaAmountToFraction(laborer.teaAmount, teaRatePerRound) || "Tea"}
                              type="number"
                              value={laborer.teaAmount}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setNonWorkingLaborers((prev) =>
                                  prev.map((l) =>
                                    l.id === laborer.id ? { ...l, teaAmount: value } : l
                                  )
                                );
                              }}
                              size="small"
                              sx={{ width: 80 }}
                              slotProps={{ htmlInput: { min: 0 } }}
                            />
                          </Tooltip>
                          <Tooltip title={Object.entries(laborer.snackItems).map(([name, qty]) => `${name}: ${qty}`).join(", ") || "Snacks amount"}>
                            <TextField
                              label={Object.keys(laborer.snackItems).length > 0 ? Object.entries(laborer.snackItems).map(([n, q]) => `${n}:${q}`).join(" ") : "Snacks"}
                              type="number"
                              value={laborer.snacksAmount}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setNonWorkingLaborers((prev) =>
                                  prev.map((l) =>
                                    l.id === laborer.id ? { ...l, snacksAmount: value } : l
                                  )
                                );
                              }}
                              size="small"
                              sx={{ width: 100 }}
                              slotProps={{ htmlInput: { min: 0 } }}
                            />
                          </Tooltip>
                          {/* Omit toggles */}
                          <Box sx={{ display: "flex", gap: 0.25 }}>
                            <Tooltip title={laborer.omitFromTea ? "Include in tea distribution" : "Omit from tea distribution"}>
                              <IconButton
                                size="small"
                                color={laborer.omitFromTea ? "default" : "warning"}
                                onClick={() => handleToggleOmit(laborer.id, "tea", "nonworking")}
                                sx={{ p: 0.25 }}
                              >
                                <LocalCafe fontSize="small" sx={{ opacity: laborer.omitFromTea ? 0.3 : 1 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={laborer.omitFromSnacks ? "Include in snacks distribution" : "Omit from snacks distribution"}>
                              <IconButton
                                size="small"
                                color={laborer.omitFromSnacks ? "default" : "secondary"}
                                onClick={() => handleToggleOmit(laborer.id, "snacks", "nonworking")}
                                sx={{ p: 0.25 }}
                              >
                                <Fastfood fontSize="small" sx={{ opacity: laborer.omitFromSnacks ? 0.3 : 1 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveNonWorkingLaborer(laborer.id)}
                          >
                            <DeleteIcon fontSize="small" color="error" />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            )}

            {/* Market Laborers Section - Always visible when WHO CONSUMED section shows */}
            <Accordion
              expanded={expandedSections.includes("market")}
              onChange={() => handleToggleSection("market")}
              sx={{ mb: 2 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                  <GroupIcon color="info" />
                  <Typography fontWeight={600}>Market Laborers</Typography>
                  <Tooltip title="Anonymous group - tracked as total only">
                    <InfoIcon fontSize="small" color="action" sx={{ ml: 0.5 }} />
                  </Tooltip>
                  <Box sx={{ flexGrow: 1 }} />
                  <Chip
                    label={`${marketLaborerCount} • ₹${marketTotal.toLocaleString()}`}
                    color="info"
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  <TextField
                    label="Count"
                    type="number"
                    value={marketLaborerCount}
                    onChange={(e) => setMarketLaborerCount(Math.max(0, parseInt(e.target.value) || 0))}
                    size="small"
                    sx={{ width: 100 }}
                    slotProps={{ htmlInput: { min: 0 } }}
                  />
                  <TextField
                    label="Tea Amount"
                    type="number"
                    value={marketTeaAmount}
                    onChange={(e) => setMarketTeaAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    size="small"
                    sx={{ width: 120 }}
                    slotProps={{
                      htmlInput: { min: 0 },
                      input: { startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> },
                    }}
                  />
                  <TextField
                    label="Snacks Amount"
                    type="number"
                    value={marketSnacksAmount}
                    onChange={(e) => setMarketSnacksAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    size="small"
                    sx={{ width: 120 }}
                    slotProps={{
                      htmlInput: { min: 0 },
                      input: { startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> },
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Total: ₹{marketTotal.toLocaleString()} for {marketLaborerCount} market laborers
                </Typography>
              </AccordionDetails>
            </Accordion>

            {/* Assignment Summary */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                ASSIGNMENT SUMMARY
              </Typography>
              {!isQuickEntryMode && (
                <>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="body2">Working Laborers ({selectedWorkingCount}):</Typography>
                    <Typography variant="body2">₹{workingTotal.toLocaleString()}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="body2">Non-Working Laborers ({nonWorkingLaborers.length}):</Typography>
                    <Typography variant="body2">₹{nonWorkingTotal.toLocaleString()}</Typography>
                  </Box>
                </>
              )}
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography variant="body2">Market Laborers ({marketLaborerCount}):</Typography>
                <Typography variant="body2">₹{marketTotal.toLocaleString()}</Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" fontWeight={600}>
                  Total Assigned:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  ₹{assignedTotal.toLocaleString()}
                </Typography>
              </Box>
              {unassignedAmount !== 0 && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mt: 1,
                    p: 1,
                    bgcolor: unassignedAmount > 0 ? "warning.light" : "error.light",
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {unassignedAmount > 0 ? "Unassigned:" : "Over-assigned:"}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    ₹{Math.abs(unassignedAmount).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Paper>
          </>
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
          placeholder="Any additional notes..."
        />
        </>
        )} {/* End of detailed mode conditional */}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || (entryMode === "simple" ? simpleTotalCost <= 0 : grandTotal <= 0)}
        >
          {loading ? <CircularProgress size={24} /> : entry ? "Update" : "Save Entry"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
