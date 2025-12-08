"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  InputAdornment,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  Store as StoreIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccessTime as TimeIcon,
  Description as WorkIcon,
  ContentCopy as CopyIcon,
  LocalCafe as TeaIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  KeyboardArrowUp as CollapseIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import dayjs from "dayjs";
import LaborerSelectionDialog from "./LaborerSelectionDialog";
import TeaShopEntryDialog from "../tea-shop/TeaShopEntryDialog";
import type { TeaShopEntry, TeaShopAccount as TeaShopAccountType } from "@/types/database.types";

interface AttendanceDrawerProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  date?: string;
  onSuccess?: () => void;
}

interface LaborerWithCategory {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  daily_rate: number;
  team_id: string | null;
  team_name: string | null;
  laborer_type: string;
}

// Extended to include time tracking
interface SelectedLaborer {
  laborerId: string;
  workDays: number;
  dailyRate: number;
  // Time tracking
  inTime: string;
  lunchOut: string;
  lunchIn: string;
  outTime: string;
  workHours: number;
  breakHours: number;
  totalHours: number;
  dayUnits: number;
}

// Extended to include time tracking
interface MarketLaborerEntry {
  id: string;
  roleId: string;
  roleName: string;
  count: number;
  workDays: number;
  ratePerPerson: number;
  // Time tracking (group-level)
  inTime: string;
  lunchOut: string;
  lunchIn: string;
  outTime: string;
  workHours: number;
  breakHours: number;
  totalHours: number;
  dayUnits: number;
}

interface LaborRole {
  id: string;
  name: string;
  default_daily_rate: number;
}

// Work Unit Presets - User selects work unit FIRST, times auto-populate
interface WorkUnitPreset {
  value: number;
  label: string;
  shortLabel: string;
  inTime: string;
  outTime: string;
  lunchOut: string | null;
  lunchIn: string | null;
  minHours: number;
  maxHours: number;
  description: string;
}

const WORK_UNIT_PRESETS: WorkUnitPreset[] = [
  {
    value: 0.5,
    label: "Half Day",
    shortLabel: "0.5",
    inTime: "09:00",
    outTime: "13:00",
    lunchOut: null,
    lunchIn: null,
    minHours: 3,
    maxHours: 5,
    description: "Morning shift, no lunch break",
  },
  {
    value: 1,
    label: "Full Day",
    shortLabel: "1.0",
    inTime: "09:00",
    outTime: "18:00",
    lunchOut: "13:00",
    lunchIn: "14:00",
    minHours: 7,
    maxHours: 9,
    description: "Standard 9 AM - 6 PM with lunch",
  },
  {
    value: 1.5,
    label: "Extended",
    shortLabel: "1.5",
    inTime: "06:00",
    outTime: "18:00",
    lunchOut: "13:00",
    lunchIn: "14:00",
    minHours: 10,
    maxHours: 12,
    description: "Early start or late finish",
  },
  {
    value: 2,
    label: "Double",
    shortLabel: "2.0",
    inTime: "06:00",
    outTime: "19:30",
    lunchOut: "13:00",
    lunchIn: "14:00",
    minHours: 12,
    maxHours: 16,
    description: "Full day + overtime",
  },
];

// Get preset by value
const getPresetByValue = (value: number): WorkUnitPreset => {
  return WORK_UNIT_PRESETS.find((p) => p.value === value) || WORK_UNIT_PRESETS[1];
};

// Hour Alignment Status
type AlignmentStatus = "aligned" | "underwork" | "overwork" | "no-times";

const getAlignmentStatus = (workHours: number, preset: WorkUnitPreset, hasTimeEntries: boolean): AlignmentStatus => {
  if (!hasTimeEntries || workHours === 0) return "no-times";
  if (workHours >= preset.minHours && workHours <= preset.maxHours) return "aligned";
  if (workHours < preset.minHours) return "underwork";
  return "overwork";
};

// Helper function to calculate hours from time strings
// NOTE: dayUnits is NO LONGER auto-calculated - it comes from user selection
function calculateTimeHours(
  inTime: string,
  outTime: string,
  lunchOut: string,
  lunchIn: string
): { workHours: number; breakHours: number; totalHours: number } {
  if (!inTime || !outTime) {
    return { workHours: 0, breakHours: 0, totalHours: 0 };
  }

  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const inMinutes = parseTime(inTime);
  const outMinutes = parseTime(outTime);
  let totalMinutes = outMinutes - inMinutes;

  // Handle overnight work
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  let breakMinutes = 0;
  if (lunchOut && lunchIn) {
    const lunchOutMinutes = parseTime(lunchOut);
    const lunchInMinutes = parseTime(lunchIn);
    breakMinutes = lunchInMinutes - lunchOutMinutes;
    if (breakMinutes < 0) breakMinutes = 0;
  }

  const workMinutes = totalMinutes - breakMinutes;
  const workHours = Math.round((workMinutes / 60) * 100) / 100;
  const breakHours = Math.round((breakMinutes / 60) * 100) / 100;
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

  return { workHours, breakHours, totalHours };
}

export default function AttendanceDrawer({
  open,
  onClose,
  siteId,
  date: initialDate,
  onSuccess,
}: AttendanceDrawerProps) {
  const { userProfile } = useAuth();
  const supabase = createClient();

  // Form state
  const [selectedDate, setSelectedDate] = useState(
    initialDate || dayjs().format("YYYY-MM-DD")
  );
  const [sectionId, setSectionId] = useState<string>("");
  const [selectedLaborers, setSelectedLaborers] = useState<
    Map<string, SelectedLaborer>
  >(new Map());
  const [marketLaborers, setMarketLaborers] = useState<MarketLaborerEntry[]>([]);

  // Default time tracking values (apply to all) - Updated to user preferences
  const [defaultInTime, setDefaultInTime] = useState("09:00");
  const [defaultLunchOut, setDefaultLunchOut] = useState("13:00");
  const [defaultLunchIn, setDefaultLunchIn] = useState("14:00");
  const [defaultOutTime, setDefaultOutTime] = useState("18:00");

  // Default work unit for bulk assignment
  const [defaultWorkUnit, setDefaultWorkUnit] = useState<number>(1);

  // Work description fields (per day)
  const [workDescription, setWorkDescription] = useState("");
  const [workStatus, setWorkStatus] = useState("");
  const [comments, setComments] = useState("");

  // Data state
  const [laborers, setLaborers] = useState<LaborerWithCategory[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [laborRoles, setLaborRoles] = useState<LaborRole[]>([]);
  const [laborerDialogOpen, setLaborerDialogOpen] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | false>("laborers");

  // New Phase 2 state: Per-laborer expanded time fields
  const [expandedLaborerTimes, setExpandedLaborerTimes] = useState<Set<string>>(new Set());
  const [showGlobalCustomTimes, setShowGlobalCustomTimes] = useState(false);

  // Tea Shop state - dialog-based approach
  const [teaShops, setTeaShops] = useState<TeaShopAccountType[]>([]);
  const [selectedTeaShop, setSelectedTeaShop] = useState<TeaShopAccountType | null>(null);
  const [existingTeaEntry, setExistingTeaEntry] = useState<TeaShopEntry | null>(null);
  const [teaShopDialogOpen, setTeaShopDialogOpen] = useState(false);

  // Calculate tea shop total from existing entry
  const teaShopTotal = existingTeaEntry?.total_amount || 0;

  // Sync selectedDate with initialDate when it changes
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // Fetch data on open
  useEffect(() => {
    if (open && siteId) {
      fetchData();
    }
  }, [open, siteId]);

  // Load existing attendance when drawer opens with a specific date
  useEffect(() => {
    if (open && siteId && initialDate) {
      loadExistingAttendanceForDate(initialDate);
    }
  }, [open, siteId, initialDate]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedLaborers(new Map());
    setMarketLaborers([]);
    setDefaultInTime("09:00");
    setDefaultLunchOut("13:00");
    setDefaultLunchIn("14:00");
    setDefaultOutTime("18:00");
    setDefaultWorkUnit(1);
    setWorkDescription("");
    setWorkStatus("");
    setComments("");
    setError(null);
    setSuccess(null);
    // Reset tea shop state
    setExistingTeaEntry(null);
    setTeaShopDialogOpen(false);
    // Reset Phase 2 state
    setExpandedLaborerTimes(new Set());
    setShowGlobalCustomTimes(false);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch laborers with category info
      const { data: laborersData, error: laborersError } = await supabase
        .from("laborers")
        .select(`
          id, name, category_id, daily_rate, team_id, laborer_type,
          labor_categories(name),
          team:teams!laborers_team_id_fkey(name)
        `)
        .eq("status", "active")
        .order("name");

      if (laborersError) throw laborersError;

      const mappedLaborers: LaborerWithCategory[] = (laborersData || []).map(
        (l: any) => ({
          id: l.id,
          name: l.name,
          category_id: l.category_id,
          category_name: l.labor_categories?.name || "Unknown",
          daily_rate: l.daily_rate,
          team_id: l.team_id,
          team_name: l.team?.name || null,
          laborer_type: l.laborer_type || "daily_market",
        })
      );
      setLaborers(mappedLaborers);

      // Fetch sections for the site
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("building_sections")
        .select("id, name")
        .eq("site_id", siteId)
        .order("name");

      if (sectionsError) throw sectionsError;
      const sectionsArray = (sectionsData || []) as { id: string; name: string }[];
      setSections(sectionsArray);

      // Auto-select first section only when adding new attendance
      if (sectionsArray.length > 0 && !sectionId && !initialDate) {
        setSectionId(sectionsArray[0].id);
      }

      // Fetch labor roles for market laborers
      const { data: rolesData, error: rolesError } = await supabase
        .from("labor_roles")
        .select("id, name, default_daily_rate")
        .order("name");

      if (rolesError) throw rolesError;
      setLaborRoles((rolesData || []) as LaborRole[]);

      // Fetch tea shops for this site
      const { data: teaShopsData } = await (supabase
        .from("tea_shop_accounts") as any)
        .select("*")
        .eq("site_id", siteId)
        .eq("is_active", true)
        .order("shop_name");

      const shops = (teaShopsData || []) as TeaShopAccountType[];
      setTeaShops(shops);
      if (shops.length > 0 && !selectedTeaShop) {
        setSelectedTeaShop(shops[0]);
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAttendanceForDate = async (dateToLoad: string) => {
    try {
      setLoading(true);

      // Load existing daily attendance for this date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("daily_attendance")
        .select("laborer_id, work_days, daily_rate_applied, section_id, in_time, lunch_out, lunch_in, out_time, work_hours, break_hours, total_hours, day_units")
        .eq("site_id", siteId)
        .eq("date", dateToLoad);

      if (attendanceError) throw attendanceError;

      // Populate selected laborers from existing attendance
      const existingSelected = new Map<string, SelectedLaborer>();
      let loadedSectionId: string | null = null;

      (attendanceData || []).forEach((record: any) => {
        existingSelected.set(record.laborer_id, {
          laborerId: record.laborer_id,
          workDays: record.work_days,
          dailyRate: record.daily_rate_applied,
          inTime: record.in_time || "08:00",
          lunchOut: record.lunch_out || "12:30",
          lunchIn: record.lunch_in || "13:30",
          outTime: record.out_time || "18:00",
          workHours: record.work_hours || 0,
          breakHours: record.break_hours || 0,
          totalHours: record.total_hours || 0,
          dayUnits: record.day_units || 1,
        });
        if (!loadedSectionId && record.section_id) {
          loadedSectionId = record.section_id;
        }
      });
      setSelectedLaborers(existingSelected);

      if (loadedSectionId) {
        setSectionId(loadedSectionId);
      }

      // Load existing market laborers for this date
      const { data: marketData, error: marketError } = await (
        supabase.from("market_laborer_attendance") as any
      )
        .select("id, role_id, count, work_days, rate_per_person, in_time, lunch_out, lunch_in, out_time, work_hours, break_hours, total_hours, day_units, labor_roles(name)")
        .eq("site_id", siteId)
        .eq("date", dateToLoad);

      let marketCount = 0;
      if (!marketError && marketData) {
        const existingMarket: MarketLaborerEntry[] = marketData.map((m: any) => ({
          id: m.id,
          roleId: m.role_id,
          roleName: m.labor_roles?.name || "Unknown",
          count: m.count,
          workDays: m.work_days || 1,
          ratePerPerson: m.rate_per_person,
          inTime: m.in_time || "08:00",
          lunchOut: m.lunch_out || "12:30",
          lunchIn: m.lunch_in || "13:30",
          outTime: m.out_time || "18:00",
          workHours: m.work_hours || 0,
          breakHours: m.break_hours || 0,
          totalHours: m.total_hours || 0,
          dayUnits: m.day_units || 1,
        }));
        setMarketLaborers(existingMarket);
        marketCount = existingMarket.reduce((acc, m) => acc + m.count, 0);
      } else {
        setMarketLaborers([]);
      }

      // Load work summary for this date
      const { data: summaryData } = await (
        supabase.from("daily_work_summary") as any
      )
        .select("work_description, work_status, comments")
        .eq("site_id", siteId)
        .eq("date", dateToLoad)
        .single();

      if (summaryData) {
        setWorkDescription(summaryData.work_description || "");
        setWorkStatus(summaryData.work_status || "");
        setComments(summaryData.comments || "");
      }

      // Load existing tea shop entry for this date
      if (teaShops.length > 0) {
        const shopToUse = selectedTeaShop || teaShops[0];
        const { data: teaEntryData } = await (supabase
          .from("tea_shop_entries") as any)
          .select("*")
          .eq("tea_shop_id", shopToUse.id)
          .eq("date", dateToLoad)
          .single();

        if (teaEntryData) {
          setExistingTeaEntry(teaEntryData as TeaShopEntry);
        } else {
          setExistingTeaEntry(null);
        }
      }

      const namedCount = existingSelected.size;
      if (namedCount > 0 || marketCount > 0) {
        setSuccess(
          `Loaded ${namedCount} named laborer${namedCount !== 1 ? "s" : ""} and ${marketCount} market laborer${marketCount !== 1 ? "s" : ""}`
        );
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("Error loading existing attendance:", err);
      setError("Failed to load existing attendance");
    } finally {
      setLoading(false);
    }
  };

  // Apply default times to all laborers (preserves existing dayUnits)
  const applyDefaultTimesToAll = useCallback(() => {
    const timeCalc = calculateTimeHours(defaultInTime, defaultOutTime, defaultLunchOut, defaultLunchIn);

    setSelectedLaborers((prev) => {
      const newMap = new Map(prev);
      newMap.forEach((laborer, key) => {
        newMap.set(key, {
          ...laborer,
          inTime: defaultInTime,
          lunchOut: defaultLunchOut,
          lunchIn: defaultLunchIn,
          outTime: defaultOutTime,
          ...timeCalc,
          // Preserve existing dayUnits - user's selection takes precedence
        });
      });
      return newMap;
    });

    setMarketLaborers((prev) =>
      prev.map((m) => ({
        ...m,
        inTime: defaultInTime,
        lunchOut: defaultLunchOut,
        lunchIn: defaultLunchIn,
        outTime: defaultOutTime,
        ...timeCalc,
        // Preserve existing dayUnits
      }))
    );
  }, [defaultInTime, defaultOutTime, defaultLunchOut, defaultLunchIn]);

  // Apply default work unit to all laborers (also sets corresponding times)
  const applyDefaultWorkUnitToAll = useCallback(() => {
    const preset = getPresetByValue(defaultWorkUnit);
    const inTime = preset.inTime;
    const outTime = preset.outTime;
    const lunchOut = preset.lunchOut || "";
    const lunchIn = preset.lunchIn || "";
    const timeCalc = calculateTimeHours(inTime, outTime, lunchOut, lunchIn);

    setSelectedLaborers((prev) => {
      const newMap = new Map(prev);
      newMap.forEach((laborer, key) => {
        newMap.set(key, {
          ...laborer,
          dayUnits: defaultWorkUnit,
          inTime,
          lunchOut,
          lunchIn,
          outTime,
          ...timeCalc,
        });
      });
      return newMap;
    });

    setMarketLaborers((prev) =>
      prev.map((m) => ({
        ...m,
        dayUnits: defaultWorkUnit,
        inTime,
        lunchOut,
        lunchIn,
        outTime,
        ...timeCalc,
      }))
    );
  }, [defaultWorkUnit]);

  // Calculate summary
  const summary = useMemo(() => {
    let namedCount = 0;
    let namedSalary = 0;
    let marketCount = 0;
    let marketSalary = 0;
    let dailyCount = 0;
    let contractCount = 0;

    selectedLaborers.forEach((s) => {
      namedCount++;
      const laborer = laborers.find((l) => l.id === s.laborerId);
      const salary = s.dayUnits * s.dailyRate;
      namedSalary += salary;

      if (laborer?.laborer_type === "contract") {
        contractCount++;
      } else {
        dailyCount++;
      }
    });

    marketLaborers.forEach((m) => {
      marketCount += m.count;
      marketSalary += m.count * m.ratePerPerson * m.dayUnits;
    });

    const totalSalary = namedSalary + marketSalary;
    const totalExpense = totalSalary;

    return {
      namedCount,
      namedSalary,
      marketCount,
      marketSalary,
      dailyCount,
      contractCount,
      totalCount: namedCount + marketCount,
      totalSalary,
      totalExpense,
    };
  }, [selectedLaborers, marketLaborers, laborers]);

  const handleLaborerToggle = (laborer: LaborerWithCategory) => {
    const timeCalc = calculateTimeHours(defaultInTime, defaultOutTime, defaultLunchOut, defaultLunchIn);

    setSelectedLaborers((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(laborer.id)) {
        newMap.delete(laborer.id);
      } else {
        newMap.set(laborer.id, {
          laborerId: laborer.id,
          workDays: 1,
          dailyRate: laborer.daily_rate,
          inTime: defaultInTime,
          lunchOut: defaultLunchOut,
          lunchIn: defaultLunchIn,
          outTime: defaultOutTime,
          ...timeCalc,
          dayUnits: 1, // Default to Full Day
        });
      }
      return newMap;
    });
  };

  const handleAddMarketLaborer = () => {
    if (laborRoles.length === 0) return;

    const unusedRole = laborRoles.find(
      (role) => !marketLaborers.some((m) => m.roleId === role.id)
    );
    const role = unusedRole || laborRoles[0];
    const timeCalc = calculateTimeHours(defaultInTime, defaultOutTime, defaultLunchOut, defaultLunchIn);

    setMarketLaborers((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        roleId: role.id,
        roleName: role.name,
        count: 1,
        workDays: 1,
        ratePerPerson: role.default_daily_rate,
        inTime: defaultInTime,
        lunchOut: defaultLunchOut,
        lunchIn: defaultLunchIn,
        outTime: defaultOutTime,
        ...timeCalc,
        dayUnits: 1, // Default to Full Day
      },
    ]);
  };

  const handleRemoveMarketLaborer = (id: string) => {
    setMarketLaborers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleMarketLaborerChange = (
    id: string,
    field: string,
    value: string | number
  ) => {
    setMarketLaborers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;

        let updated = { ...m };

        if (field === "roleId") {
          const role = laborRoles.find((r) => r.id === value);
          updated = {
            ...updated,
            roleId: value as string,
            roleName: role?.name || "Unknown",
            ratePerPerson: role?.default_daily_rate || 500,
          };
        } else if (field === "count") {
          const count = Math.max(1, value as number);
          updated = {
            ...updated,
            count,
          };
        } else if (field === "dayUnits") {
          // When work unit changes, auto-populate times from preset
          const newDayUnits = value as number;
          const preset = getPresetByValue(newDayUnits);
          const inTime = preset.inTime;
          const outTime = preset.outTime;
          const lunchOut = preset.lunchOut || "";
          const lunchIn = preset.lunchIn || "";
          const timeCalc = calculateTimeHours(inTime, outTime, lunchOut, lunchIn);
          updated = {
            ...updated,
            dayUnits: newDayUnits,
            inTime,
            outTime,
            lunchOut,
            lunchIn,
            ...timeCalc,
          };
        } else if (["inTime", "lunchOut", "lunchIn", "outTime"].includes(field)) {
          // When times change, recalculate hours but preserve dayUnits
          updated = { ...updated, [field]: value };
          const timeCalc = calculateTimeHours(
            field === "inTime" ? (value as string) : updated.inTime,
            field === "outTime" ? (value as string) : updated.outTime,
            field === "lunchOut" ? (value as string) : updated.lunchOut,
            field === "lunchIn" ? (value as string) : updated.lunchIn
          );
          updated = { ...updated, ...timeCalc }; // dayUnits NOT overwritten
        } else {
          updated = { ...updated, [field]: value };
        }

        return updated;
      })
    );
  };

  const handleLaborerFieldChange = (
    laborerId: string,
    field: string,
    value: string | number
  ) => {
    setSelectedLaborers((prev) => {
      const newMap = new Map(prev);
      const laborer = newMap.get(laborerId);
      if (!laborer) return prev;

      let updated = { ...laborer };

      if (field === "dayUnits") {
        // When work unit changes, auto-populate times from preset
        const newDayUnits = value as number;
        const preset = getPresetByValue(newDayUnits);
        const inTime = preset.inTime;
        const outTime = preset.outTime;
        const lunchOut = preset.lunchOut || "";
        const lunchIn = preset.lunchIn || "";
        const timeCalc = calculateTimeHours(inTime, outTime, lunchOut, lunchIn);
        updated = {
          ...updated,
          dayUnits: newDayUnits,
          inTime,
          outTime,
          lunchOut,
          lunchIn,
          ...timeCalc,
        };
      } else if (["inTime", "lunchOut", "lunchIn", "outTime"].includes(field)) {
        // When times change, recalculate hours but preserve dayUnits
        updated = { ...updated, [field]: value };
        const timeCalc = calculateTimeHours(
          field === "inTime" ? (value as string) : updated.inTime,
          field === "outTime" ? (value as string) : updated.outTime,
          field === "lunchOut" ? (value as string) : updated.lunchOut,
          field === "lunchIn" ? (value as string) : updated.lunchIn
        );
        updated = { ...updated, ...timeCalc }; // dayUnits NOT overwritten
      } else {
        updated = { ...updated, [field]: value };
      }

      newMap.set(laborerId, updated);
      return newMap;
    });
  };

  // Tea Shop dialog handler
  const handleTeaShopDialogSuccess = async () => {
    setTeaShopDialogOpen(false);
    // Refresh tea shop entry
    if (selectedTeaShop && selectedDate) {
      const { data: teaEntryData } = await (supabase
        .from("tea_shop_entries") as any)
        .select("*")
        .eq("tea_shop_id", selectedTeaShop.id)
        .eq("date", selectedDate)
        .single();

      if (teaEntryData) {
        setExistingTeaEntry(teaEntryData as TeaShopEntry);
      }
    }
  };

  const handleSave = async () => {
    if (selectedLaborers.size === 0 && marketLaborers.length === 0) {
      setError("Please select at least one laborer or add market laborers");
      return;
    }

    if (!sectionId) {
      setError("Please select a section");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Save named laborers to daily_attendance
      const namedRecords = Array.from(selectedLaborers.values()).map((s) => ({
        date: selectedDate,
        laborer_id: s.laborerId,
        site_id: siteId,
        section_id: sectionId,
        work_days: s.dayUnits, // Use calculated day units
        hours_worked: s.workHours,
        daily_rate_applied: s.dailyRate,
        daily_earnings: s.dayUnits * s.dailyRate,
        entered_by: userProfile?.id || null,
        recorded_by: userProfile?.name || "Unknown",
        recorded_by_user_id: userProfile?.id || null,
        is_paid: false,
        synced_to_expense: true,
        // Time tracking fields
        in_time: s.inTime,
        lunch_out: s.lunchOut,
        lunch_in: s.lunchIn,
        out_time: s.outTime,
        work_hours: s.workHours,
        break_hours: s.breakHours,
        total_hours: s.totalHours,
        day_units: s.dayUnits,
      }));

      // Delete existing records for this date/site first
      await (supabase.from("daily_attendance") as any)
        .delete()
        .eq("site_id", siteId)
        .eq("date", selectedDate);

      if (namedRecords.length > 0) {
        const { error: attendanceError } = await (
          supabase.from("daily_attendance") as any
        ).insert(namedRecords);
        if (attendanceError) throw attendanceError;
      }

      // 2. Save market laborers
      await (supabase.from("market_laborer_attendance") as any)
        .delete()
        .eq("site_id", siteId)
        .eq("date", selectedDate);

      if (marketLaborers.length > 0) {
        const marketRecords = marketLaborers.map((m) => ({
          site_id: siteId,
          section_id: sectionId,
          date: selectedDate,
          role_id: m.roleId,
          count: m.count,
          work_days: m.dayUnits,
          rate_per_person: m.ratePerPerson,
          total_cost: m.count * m.ratePerPerson * m.dayUnits,
          entered_by: userProfile?.name || "Unknown",
          entered_by_user_id: userProfile?.id || null,
          // Time tracking fields
          in_time: m.inTime,
          lunch_out: m.lunchOut,
          lunch_in: m.lunchIn,
          out_time: m.outTime,
          work_hours: m.workHours,
          break_hours: m.breakHours,
          total_hours: m.totalHours,
          day_units: m.dayUnits,
        }));

        const { error: marketError } = await (
          supabase.from("market_laborer_attendance") as any
        ).insert(marketRecords);
        if (marketError) throw marketError;
      }

      // 3. Save/Update daily work summary
      const { error: summaryError } = await (
        supabase.from("daily_work_summary") as any
      ).upsert(
        {
          site_id: siteId,
          date: selectedDate,
          work_description: workDescription,
          work_status: workStatus,
          comments: comments,
          first_in_time: defaultInTime,
          last_out_time: defaultOutTime,
          daily_laborer_count: summary.dailyCount,
          contract_laborer_count: summary.contractCount,
          market_laborer_count: summary.marketCount,
          total_laborer_count: summary.totalCount,
          total_salary: summary.totalSalary,
          total_snacks: 0, // Snacks now managed via Tea Shop
          total_expense: summary.totalExpense,
          default_snacks_per_person: 0, // Snacks now managed via Tea Shop
          entered_by: userProfile?.name || "Unknown",
          entered_by_user_id: userProfile?.id || null,
        },
        { onConflict: "site_id,date" }
      );

      if (summaryError) {
        console.error("Error saving work summary:", summaryError);
        // Don't throw - this is non-critical
      }

      // 4. AUTO-SYNC: Create expense record for labor
      const totalAmount = summary.totalExpense;
      if (totalAmount > 0) {
        // First try to get existing labor category
        let categoryId: string | null = null;
        const { data: laborCategory } = await (
          supabase.from("expense_categories") as any
        )
          .select("id")
          .eq("module", "labor")
          .single();

        if (laborCategory) {
          categoryId = (laborCategory as { id: string }).id;
        } else {
          // Create labor category if it doesn't exist
          const { data: newCategory, error: createCategoryError } = await (
            supabase.from("expense_categories") as any
          )
            .insert({
              name: "Labor",
              module: "labor",
              description: "Labor and attendance expenses",
            })
            .select()
            .single();

          if (!createCategoryError && newCategory) {
            categoryId = (newCategory as { id: string }).id;
          }
        }

        // Only create expense if we have a valid category
        if (categoryId) {
          await (supabase.from("expenses") as any)
            .delete()
            .eq("site_id", siteId)
            .eq("date", selectedDate)
            .eq("module", "labor")
            .like("description", "Daily labor%");

          const { data: expenseData, error: expenseError } = await (
            supabase.from("expenses") as any
          )
            .insert({
              module: "labor",
              category_id: categoryId,
              date: selectedDate,
              amount: totalAmount,
              site_id: siteId,
              section_id: sectionId,
              description: `Daily labor - ${summary.totalCount} laborers (Salary: ₹${summary.totalSalary.toLocaleString()})`,
              payment_mode: "cash",
              is_recurring: false,
              is_cleared: false,
              entered_by: userProfile?.name || "Unknown",
              entered_by_user_id: userProfile?.id || null,
            })
            .select()
            .single();

          if (expenseError) {
            console.error("Error creating expense:", expenseError);
            // Don't throw - attendance was saved successfully
          } else {
            await (supabase.from("attendance_expense_sync") as any).upsert(
              {
                attendance_date: selectedDate,
                site_id: siteId,
                expense_id: expenseData?.id || null,
                total_laborers: summary.totalCount,
                total_work_days: summary.totalCount,
                total_amount: totalAmount,
                synced_by: userProfile?.name || "Unknown",
                synced_by_user_id: userProfile?.id || null,
              },
              { onConflict: "attendance_date,site_id" }
            );
          }
        } else {
          console.warn("Could not create expense - no category found or created");
        }
      }

      // Note: Tea shop entries are now managed via TeaShopEntryDialog

      setSuccess("Attendance saved successfully!");
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error("Error saving attendance:", err);
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      disableScrollLock={false}
      hideBackdrop={false}
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 700, md: 900 },
          maxWidth: "95vw",
          overflowY: "auto",
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "primary.main",
            color: "white",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {initialDate
                  ? `Edit Attendance - ${dayjs(initialDate).format("DD MMM YYYY (ddd)")}`
                  : "Add Attendance"}
              </Typography>
              {initialDate && (
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Manage laborers and time tracking for this date
                </Typography>
              )}
            </Box>
            <IconButton onClick={handleClose} size="small" sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Date and Section Row */}
              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <TextField
                  label="Date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  size="small"
                  disabled={!!initialDate}
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Section</InputLabel>
                  <Select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    label="Section"
                  >
                    {sections.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Unified Laborers Section */}
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {/* Section Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <PeopleIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Laborers
                  </Typography>
                  {(selectedLaborers.size > 0 || marketLaborers.length > 0) && (
                    <Chip
                      label={`${selectedLaborers.size + marketLaborers.reduce((acc, m) => acc + m.count, 0)} total`}
                      size="small"
                      color="primary"
                    />
                  )}
                </Box>

                {/* Work Unit Row */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 70 }}>
                    Work Day:
                  </Typography>
                  <ToggleButtonGroup
                    value={defaultWorkUnit}
                    exclusive
                    onChange={(_, value) => {
                      if (value !== null) {
                        setDefaultWorkUnit(value);
                        const preset = getPresetByValue(value);
                        setDefaultInTime(preset.inTime);
                        setDefaultOutTime(preset.outTime);
                        setDefaultLunchOut(preset.lunchOut || "13:00");
                        setDefaultLunchIn(preset.lunchIn || "14:00");
                      }
                    }}
                    size="small"
                    sx={{
                      "& .MuiToggleButton-root": {
                        px: 1.5,
                        py: 0.5,
                        "&.Mui-selected": {
                          bgcolor: "primary.main",
                          color: "white",
                          "&:hover": { bgcolor: "primary.dark" },
                        },
                      },
                    }}
                  >
                    {WORK_UNIT_PRESETS.map((p) => (
                      <ToggleButton key={p.value} value={p.value}>
                        <Typography variant="body2" fontWeight={600}>{p.shortLabel}</Typography>
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <Button
                    size="small"
                    variant="text"
                    onClick={applyDefaultWorkUnitToAll}
                    disabled={selectedLaborers.size === 0 && marketLaborers.length === 0}
                    sx={{ ml: "auto" }}
                  >
                    Apply All
                  </Button>
                </Box>

                {/* Action Buttons Row */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showGlobalCustomTimes}
                        onChange={(e) => setShowGlobalCustomTimes(e.target.checked)}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">Custom times</Typography>}
                  />
                  <Box sx={{ flex: 1 }} />
                  {/* Tea Button */}
                  {teaShops.length > 0 && (
                    <Button
                      variant={existingTeaEntry ? "contained" : "outlined"}
                      size="small"
                      color="warning"
                      startIcon={<TeaIcon />}
                      onClick={() => setTeaShopDialogOpen(true)}
                      disabled={!selectedTeaShop}
                    >
                      {existingTeaEntry ? `Tea ₹${teaShopTotal.toLocaleString()}` : "Tea"}
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setLaborerDialogOpen(true)}
                  >
                    Select
                  </Button>
                </Box>

                {/* Custom Times - Collapsible */}
                <Collapse in={showGlobalCustomTimes}>
                  <Box sx={{ bgcolor: "grey.50", p: 1.5, borderRadius: 1, mb: 2 }}>
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid size={2.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="In"
                          type="time"
                          value={defaultInTime}
                          onChange={(e) => setDefaultInTime(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                      </Grid>
                      <Grid size={2.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="L-Out"
                          type="time"
                          value={defaultLunchOut}
                          onChange={(e) => setDefaultLunchOut(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                      </Grid>
                      <Grid size={2.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="L-In"
                          type="time"
                          value={defaultLunchIn}
                          onChange={(e) => setDefaultLunchIn(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                      </Grid>
                      <Grid size={2.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Out"
                          type="time"
                          value={defaultOutTime}
                          onChange={(e) => setDefaultOutTime(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                      </Grid>
                      <Grid size={2}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={applyDefaultTimesToAll}
                          disabled={selectedLaborers.size === 0 && marketLaborers.length === 0}
                          fullWidth
                        >
                          Apply
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Collapse>

                <Divider sx={{ mb: 2 }} />

                {/* Named Laborers Subsection */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1 }}>
                    Named Laborers ({selectedLaborers.size})
                  </Typography>

                {selectedLaborers.size > 0 ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {Array.from(selectedLaborers.values()).map((selection) => {
                      const laborer = laborers.find((l) => l.id === selection.laborerId);
                      if (!laborer) return null;

                      const isHalfDay = selection.dayUnits === 0.5;
                      const preset = getPresetByValue(selection.dayUnits);
                      const alignmentStatus = getAlignmentStatus(
                        selection.workHours,
                        preset,
                        !!(selection.inTime && selection.outTime)
                      );

                      return (
                        <Box
                          key={selection.laborerId}
                          sx={{
                            p: 2,
                            border: 1,
                            borderColor: "divider",
                            borderRadius: 2,
                            borderLeft: 4,
                            borderLeftColor: laborer.laborer_type === "contract" ? "info.main" : "warning.main",
                            bgcolor: "background.paper",
                          }}
                        >
                          {/* Header Row */}
                          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}>
                            <Box>
                              <Typography variant="subtitle2" fontWeight={600}>
                                {laborer.name}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                                <Typography variant="caption" color="text.secondary">
                                  {laborer.category_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">•</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {laborer.team_name || "No Team"}
                                </Typography>
                                <Chip
                                  label={laborer.laborer_type === "contract" ? "Contract" : "Daily"}
                                  size="small"
                                  color={laborer.laborer_type === "contract" ? "info" : "warning"}
                                  sx={{ height: 18, fontSize: "0.6rem", ml: 0.5 }}
                                />
                              </Box>
                            </Box>
                            <IconButton size="small" onClick={() => handleLaborerToggle(laborer)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          {/* Work Unit Selection - PRIMARY */}
                          <Box sx={{ mb: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                              WORK DAY UNIT
                            </Typography>
                            <ToggleButtonGroup
                              value={selection.dayUnits}
                              exclusive
                              onChange={(_, value) => {
                                if (value !== null) {
                                  handleLaborerFieldChange(selection.laborerId, "dayUnits", value);
                                }
                              }}
                              size="small"
                              fullWidth
                              sx={{
                                "& .MuiToggleButton-root": {
                                  flex: 1,
                                  py: 0.75,
                                  flexDirection: "column",
                                  "&.Mui-selected": {
                                    bgcolor: "primary.main",
                                    color: "white",
                                    "&:hover": { bgcolor: "primary.dark" },
                                  },
                                },
                              }}
                            >
                              {WORK_UNIT_PRESETS.map((p) => (
                                <ToggleButton key={p.value} value={p.value}>
                                  <Typography variant="body2" fontWeight={700}>{p.shortLabel}</Typography>
                                  <Typography variant="caption" sx={{ fontSize: "0.6rem", lineHeight: 1 }}>{p.label}</Typography>
                                </ToggleButton>
                              ))}
                            </ToggleButtonGroup>
                          </Box>

                          {/* Earnings Row with Settings Button */}
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1, px: 1.5, bgcolor: "grey.50", borderRadius: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Rate: <strong>₹{selection.dailyRate.toLocaleString()}</strong>
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Typography variant="body2" fontWeight={700} color="success.main">
                                ₹{(selection.dayUnits * selection.dailyRate).toLocaleString()}
                              </Typography>
                              {/* Settings button to expand time fields */}
                              <Tooltip title={expandedLaborerTimes.has(selection.laborerId) ? "Hide custom times" : "Set custom times"}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setExpandedLaborerTimes((prev) => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(selection.laborerId)) {
                                        newSet.delete(selection.laborerId);
                                      } else {
                                        newSet.add(selection.laborerId);
                                      }
                                      return newSet;
                                    });
                                  }}
                                  sx={{
                                    bgcolor: expandedLaborerTimes.has(selection.laborerId) ? "primary.100" : "transparent",
                                  }}
                                >
                                  {expandedLaborerTimes.has(selection.laborerId) ? (
                                    <CollapseIcon fontSize="small" />
                                  ) : (
                                    <SettingsIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>

                          {/* Collapsible Time Fields */}
                          <Collapse in={expandedLaborerTimes.has(selection.laborerId)}>
                            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "grey.50", borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                                Custom Time (this laborer only)
                              </Typography>
                              <Grid container spacing={1}>
                                <Grid size={isHalfDay ? 6 : 3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="time"
                                    label="In"
                                    value={selection.inTime}
                                    onChange={(e) =>
                                      handleLaborerFieldChange(selection.laborerId, "inTime", e.target.value)
                                    }
                                    slotProps={{ inputLabel: { shrink: true } }}
                                  />
                                </Grid>
                                {/* Only show lunch fields for non-half-day */}
                                {!isHalfDay && (
                                  <>
                                    <Grid size={3}>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        type="time"
                                        label="L-Out"
                                        value={selection.lunchOut}
                                        onChange={(e) =>
                                          handleLaborerFieldChange(selection.laborerId, "lunchOut", e.target.value)
                                        }
                                        slotProps={{ inputLabel: { shrink: true } }}
                                      />
                                    </Grid>
                                    <Grid size={3}>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        type="time"
                                        label="L-In"
                                        value={selection.lunchIn}
                                        onChange={(e) =>
                                          handleLaborerFieldChange(selection.laborerId, "lunchIn", e.target.value)
                                        }
                                        slotProps={{ inputLabel: { shrink: true } }}
                                      />
                                    </Grid>
                                  </>
                                )}
                                <Grid size={isHalfDay ? 6 : 3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="time"
                                    label="Out"
                                    value={selection.outTime}
                                    onChange={(e) =>
                                      handleLaborerFieldChange(selection.laborerId, "outTime", e.target.value)
                                    }
                                    slotProps={{ inputLabel: { shrink: true } }}
                                  />
                                </Grid>
                              </Grid>
                            </Box>
                          </Collapse>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Alert severity="info">
                    Click &quot;Select Laborers&quot; to add workers for this day
                  </Alert>
                )}
              </Box>

              {/* Laborer Selection Dialog */}
              <LaborerSelectionDialog
                open={laborerDialogOpen}
                onClose={() => setLaborerDialogOpen(false)}
                siteId={siteId}
                selectedLaborers={selectedLaborers}
                onConfirm={(selected) => {
                  // Merge new selections with existing time data
                  const merged = new Map<string, SelectedLaborer>();
                  const timeCalc = calculateTimeHours(defaultInTime, defaultOutTime, defaultLunchOut, defaultLunchIn);

                  selected.forEach((sel, key) => {
                    const existing = selectedLaborers.get(key);
                    if (existing) {
                      merged.set(key, { ...existing, ...sel });
                    } else {
                      merged.set(key, {
                        ...sel,
                        inTime: defaultInTime,
                        lunchOut: defaultLunchOut,
                        lunchIn: defaultLunchIn,
                        outTime: defaultOutTime,
                        ...timeCalc,
                        dayUnits: 1, // Default to Full Day for new selections
                      });
                    }
                  });
                  setSelectedLaborers(merged);
                  setLaborerDialogOpen(false);
                }}
              />

                <Divider sx={{ my: 2 }} />

                {/* Market Laborers Subsection */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Market Laborers ({marketLaborers.reduce((acc, m) => acc + m.count, 0)})
                  </Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={handleAddMarketLaborer}>
                    Add Group
                  </Button>
                </Box>

                {marketLaborers.map((entry) => {
                  const isHalfDay = entry.dayUnits === 0.5;
                  const preset = getPresetByValue(entry.dayUnits);
                  const alignmentStatus = getAlignmentStatus(
                    entry.workHours,
                    preset,
                    !!(entry.inTime && entry.outTime)
                  );

                  return (
                    <Box
                      key={entry.id}
                      sx={{
                        mb: 2,
                        p: 2,
                        bgcolor: "warning.50",
                        borderRadius: 2,
                        border: 1,
                        borderColor: "warning.200",
                      }}
                    >
                      {/* Header Row with Role, Count, Rate */}
                      <Grid container spacing={2} alignItems="flex-start">
                        <Grid size={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Role</InputLabel>
                            <Select
                              value={entry.roleId}
                              onChange={(e) => handleMarketLaborerChange(entry.id, "roleId", e.target.value)}
                              label="Role"
                            >
                              {laborRoles.map((role) => (
                                <MenuItem key={role.id} value={role.id}>
                                  {role.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid size={2}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Count"
                            type="number"
                            value={entry.count}
                            onChange={(e) => handleMarketLaborerChange(entry.id, "count", Number(e.target.value))}
                            slotProps={{ htmlInput: { min: 1 } }}
                          />
                        </Grid>
                        <Grid size={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Rate/Person"
                            type="number"
                            value={entry.ratePerPerson}
                            onChange={(e) => handleMarketLaborerChange(entry.id, "ratePerPerson", Number(e.target.value))}
                            slotProps={{
                              input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                            }}
                          />
                        </Grid>
                        <Grid size={2}>
                          <Box sx={{ textAlign: "center" }}>
                            <Typography variant="caption" color="text.secondary">
                              Total
                            </Typography>
                            <Typography variant="body2" fontWeight={700} color="success.main">
                              ₹{(entry.count * entry.ratePerPerson * entry.dayUnits).toLocaleString()}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid size={1} sx={{ display: "flex", justifyContent: "center" }}>
                          <IconButton size="small" color="error" onClick={() => handleRemoveMarketLaborer(entry.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>

                      {/* Work Unit Selection */}
                      <Box sx={{ mt: 2, mb: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                          WORK DAY UNIT
                        </Typography>
                        <ToggleButtonGroup
                          value={entry.dayUnits}
                          exclusive
                          onChange={(_, value) => {
                            if (value !== null) {
                              handleMarketLaborerChange(entry.id, "dayUnits", value);
                            }
                          }}
                          size="small"
                          fullWidth
                          sx={{
                            "& .MuiToggleButton-root": {
                              flex: 1,
                              py: 0.5,
                              flexDirection: "column",
                              "&.Mui-selected": {
                                bgcolor: "warning.main",
                                color: "white",
                                "&:hover": { bgcolor: "warning.dark" },
                              },
                            },
                          }}
                        >
                          {WORK_UNIT_PRESETS.map((p) => (
                            <ToggleButton key={p.value} value={p.value}>
                              <Typography variant="body2" fontWeight={700}>{p.shortLabel}</Typography>
                              <Typography variant="caption" sx={{ fontSize: "0.6rem", lineHeight: 1 }}>{p.label}</Typography>
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                      </Box>

                      {/* Settings button for custom times */}
                      <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
                        <Tooltip title={expandedLaborerTimes.has(entry.id) ? "Hide custom times" : "Set custom times"}>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={expandedLaborerTimes.has(entry.id) ? <CollapseIcon /> : <SettingsIcon />}
                            onClick={() => {
                              setExpandedLaborerTimes((prev) => {
                                const newSet = new Set(prev);
                                if (newSet.has(entry.id)) {
                                  newSet.delete(entry.id);
                                } else {
                                  newSet.add(entry.id);
                                }
                                return newSet;
                              });
                            }}
                            sx={{ color: "text.secondary" }}
                          >
                            {expandedLaborerTimes.has(entry.id) ? "Hide" : "Custom Time"}
                          </Button>
                        </Tooltip>
                      </Box>

                      {/* Collapsible Time row */}
                      <Collapse in={expandedLaborerTimes.has(entry.id)}>
                        <Box sx={{ mt: 1, p: 1.5, bgcolor: "background.paper", borderRadius: 1 }}>
                          <Grid container spacing={1}>
                            <Grid size={isHalfDay ? 6 : 3}>
                              <TextField
                                fullWidth
                                size="small"
                                type="time"
                                label="In"
                                value={entry.inTime}
                                onChange={(e) => handleMarketLaborerChange(entry.id, "inTime", e.target.value)}
                                slotProps={{ inputLabel: { shrink: true } }}
                              />
                            </Grid>
                            {!isHalfDay && (
                              <>
                                <Grid size={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="time"
                                    label="L-Out"
                                    value={entry.lunchOut}
                                    onChange={(e) => handleMarketLaborerChange(entry.id, "lunchOut", e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                  />
                                </Grid>
                                <Grid size={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="time"
                                    label="L-In"
                                    value={entry.lunchIn}
                                    onChange={(e) => handleMarketLaborerChange(entry.id, "lunchIn", e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                  />
                                </Grid>
                              </>
                            )}
                            <Grid size={isHalfDay ? 6 : 3}>
                              <TextField
                                fullWidth
                                size="small"
                                type="time"
                                label="Out"
                                value={entry.outTime}
                                onChange={(e) => handleMarketLaborerChange(entry.id, "outTime", e.target.value)}
                                slotProps={{ inputLabel: { shrink: true } }}
                              />
                            </Grid>
                          </Grid>
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })}

                {marketLaborers.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
                    No market laborers added
                  </Typography>
                )}
              </Box>{/* End Laborers Section wrapper */}

              {/* Work Description Section - Light Gray Background */}
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  bgcolor: "grey.50",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "grey.200",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedSection(expandedSection === "work" ? false : "work")}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <WorkIcon color="action" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Work Description
                    </Typography>
                    {workDescription && (
                      <Chip label="Filled" size="small" color="success" variant="outlined" />
                    )}
                  </Box>
                  <IconButton size="small">
                    {expandedSection === "work" ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>

                <Collapse in={expandedSection === "work"}>
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      label="Work Planned for Today"
                      placeholder="e.g., Plastering 2nd floor, Electrical wiring..."
                      value={workDescription}
                      onChange={(e) => setWorkDescription(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      label="Work Status / Completion"
                      placeholder="e.g., 80% completed, pending electrical..."
                      value={workStatus}
                      onChange={(e) => setWorkStatus(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      label="Comments / Notes"
                      placeholder="Any additional notes..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </Box>
                </Collapse>
              </Box>
            </>
          )}
        </Box>

        {/* Summary & Save */}
        <Box sx={{ borderTop: 1, borderColor: "divider", p: 2, bgcolor: "grey.50" }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            SUMMARY
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={4}>
              <Box sx={{ textAlign: "center", p: 1, bgcolor: "primary.50", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Laborers
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {summary.totalCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  D: {summary.dailyCount} | C: {summary.contractCount} | M: {summary.marketCount}
                </Typography>
              </Box>
            </Grid>
            <Grid size={4}>
              <Box sx={{ textAlign: "center", p: 1, bgcolor: "success.50", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Salary
                </Typography>
                <Typography variant="h6" fontWeight={700} color="success.main">
                  ₹{summary.totalSalary.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={4}>
              <Box sx={{ textAlign: "center", p: 1, bgcolor: "warning.50", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Tea Shop
                </Typography>
                <Typography variant="h6" fontWeight={700} color="warning.main">
                  ₹{teaShopTotal.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              TOTAL EXPENSE:
            </Typography>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              ₹{(summary.totalExpense + teaShopTotal).toLocaleString()}
            </Typography>
          </Box>

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleSave}
            disabled={saving || (selectedLaborers.size === 0 && marketLaborers.length === 0)}
          >
            {saving ? <CircularProgress size={24} color="inherit" /> : "Save Attendance"}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1 }}>
            Auto-synced to Daily Expenses
          </Typography>
        </Box>
      </Box>

      {/* Tea Shop Entry Dialog */}
      {selectedTeaShop && (
        <TeaShopEntryDialog
          open={teaShopDialogOpen}
          onClose={() => setTeaShopDialogOpen(false)}
          shop={selectedTeaShop}
          entry={existingTeaEntry}
          onSuccess={handleTeaShopDialogSuccess}
          initialDate={selectedDate}
          preSelectedLaborers={Array.from(selectedLaborers.values())
            .map((sel) => {
              const lab = laborers.find((l) => l.id === sel.laborerId);
              return lab ? { id: lab.id, name: lab.name, laborer_type: lab.laborer_type || "daily" } : null;
            })
            .filter((l): l is { id: string; name: string; laborer_type: string } => l !== null)}
          initialMarketCount={marketLaborers.reduce((sum, m) => sum + m.count, 0)}
        />
      )}
    </Drawer>
  );
}
