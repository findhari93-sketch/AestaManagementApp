"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  TextField,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Fab,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit,
  Delete,
  Payment as PaymentIcon,
  LocalCafe,
  Fastfood,
  Settings,
  Warning as WarningIcon,
  Group as GroupIcon,
  CallSplit as SplitIcon,
  BeachAccess as BeachAccessIcon,
  EventBusy as NoEntryIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import TeaShopDrawer from "@/components/tea-shop/TeaShopDrawer";
import TeaShopEntryDialog from "@/components/tea-shop/TeaShopEntryDialog";
import AuditAvatarGroup from "@/components/common/AuditAvatarGroup";
import TeaShopSettlementDialog from "@/components/tea-shop/TeaShopSettlementDialog";
import type { TeaShopAccount, TeaShopEntry, TeaShopSettlement, TeaShopEntryExtended, SiteHoliday } from "@/types/database.types";

// Types for combined entries view
type CombinedEntryType =
  | { type: "entry"; date: string; entry: TeaShopEntry }
  | { type: "holiday"; date: string; holiday: SiteHoliday }
  | { type: "no_entry"; date: string; attendanceCount: { named: number; market: number } };
import dayjs from "dayjs";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function TeaShopPage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const { formatForApi, isAllTime } = useDateRange();
  const supabase = createClient();

  const { dateFrom, dateTo } = formatForApi();

  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // Data states
  const [shop, setShop] = useState<TeaShopAccount | null>(null);
  const [entries, setEntries] = useState<TeaShopEntry[]>([]);
  const [settlements, setSettlements] = useState<TeaShopSettlement[]>([]);
  const [attendanceByDate, setAttendanceByDate] = useState<Map<string, { named: number; market: number }>>(new Map());
  const [holidays, setHolidays] = useState<SiteHoliday[]>([]);
  const [initialEntryDate, setInitialEntryDate] = useState<string | undefined>(undefined);

  // Dialog states
  const [shopDrawerOpen, setShopDrawerOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TeaShopEntry | null>(null);
  const [editingSettlement, setEditingSettlement] = useState<TeaShopSettlement | null>(null);

  const canEdit = hasEditPermission(userProfile?.role);

  // Calculate summary stats
  const stats = useMemo(() => {
    const filteredEntries = isAllTime
      ? entries
      : entries.filter(
          (e) => dateFrom && dateTo && e.date >= dateFrom && e.date <= dateTo
        );

    const totalEntries = filteredEntries.reduce((sum, e) => sum + (e.total_amount || 0), 0);
    const totalTea = filteredEntries.reduce((sum, e) => sum + (e.tea_total || 0), 0);
    const totalSnacks = filteredEntries.reduce((sum, e) => sum + (e.snacks_total || 0), 0);

    // Calculate pending balance (all entries minus all settlements)
    const allEntriesTotal = entries.reduce((sum, e) => sum + (e.total_amount || 0), 0);
    const allSettledTotal = settlements.reduce((sum, s) => sum + (s.amount_paid || 0), 0);
    const pendingBalance = allEntriesTotal - allSettledTotal;

    // This week
    const weekStart = dayjs().startOf("week").format("YYYY-MM-DD");
    const thisWeekTotal = entries
      .filter((e) => e.date >= weekStart)
      .reduce((sum, e) => sum + (e.total_amount || 0), 0);

    // This month
    const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");
    const thisMonthTotal = entries
      .filter((e) => e.date >= monthStart)
      .reduce((sum, e) => sum + (e.total_amount || 0), 0);

    // Last payment
    const lastSettlement = settlements.length > 0
      ? settlements.reduce((latest, s) =>
          new Date(s.payment_date) > new Date(latest.payment_date) ? s : latest
        )
      : null;

    return {
      totalEntries,
      totalTea,
      totalSnacks,
      pendingBalance,
      thisWeekTotal,
      thisMonthTotal,
      lastSettlement,
    };
  }, [entries, settlements, dateFrom, dateTo, isAllTime]);

  const fetchData = async () => {
    if (!selectedSite) return;

    setLoading(true);
    try {
      // Determine date range for fetching
      const fetchDateFrom = dateFrom || dayjs().subtract(30, "day").format("YYYY-MM-DD");
      const fetchDateTo = dateTo || dayjs().format("YYYY-MM-DD");

      // Fetch shop for this site
      const { data: shopData } = await (supabase
        .from("tea_shop_accounts") as any)
        .select("*")
        .eq("site_id", selectedSite.id)
        .eq("is_active", true)
        .single();

      const typedShopData = shopData as TeaShopAccount | null;
      setShop(typedShopData);

      // Fetch holidays for this site (within date range)
      const { data: holidaysData } = await (supabase
        .from("site_holidays") as any)
        .select("*")
        .eq("site_id", selectedSite.id)
        .gte("holiday_date", fetchDateFrom)
        .lte("holiday_date", fetchDateTo)
        .order("holiday_date", { ascending: false });

      setHolidays((holidaysData || []).map((h: any) => ({
        ...h,
        date: h.holiday_date, // Normalize field name
      })) as SiteHoliday[]);

      // Fetch attendance for all dates in range (to detect missing entries)
      const { data: attendanceData } = await (supabase
        .from("daily_attendance") as any)
        .select("date")
        .eq("site_id", selectedSite.id)
        .gte("date", fetchDateFrom)
        .lte("date", fetchDateTo);

      const { data: marketData } = await (supabase
        .from("market_laborer_attendance") as any)
        .select("date, count")
        .eq("site_id", selectedSite.id)
        .gte("date", fetchDateFrom)
        .lte("date", fetchDateTo);

      // Build attendance map
      const attMap = new Map<string, { named: number; market: number }>();

      // Count named laborers per date
      const namedCounts = new Map<string, number>();
      (attendanceData || []).forEach((a: any) => {
        namedCounts.set(a.date, (namedCounts.get(a.date) || 0) + 1);
      });

      // Count market laborers per date
      const marketCounts = new Map<string, number>();
      (marketData || []).forEach((m: any) => {
        marketCounts.set(m.date, (marketCounts.get(m.date) || 0) + (m.count || 0));
      });

      // All dates that have attendance
      const allAttDates = new Set([...namedCounts.keys(), ...marketCounts.keys()]);
      allAttDates.forEach((date) => {
        attMap.set(date, {
          named: namedCounts.get(date) || 0,
          market: marketCounts.get(date) || 0,
        });
      });

      setAttendanceByDate(attMap);

      if (typedShopData) {
        // Fetch entries
        const { data: entriesData } = await (supabase
          .from("tea_shop_entries") as any)
          .select("*")
          .eq("tea_shop_id", typedShopData.id)
          .order("date", { ascending: false });

        setEntries((entriesData || []) as TeaShopEntry[]);

        // Fetch settlements
        const { data: settlementsData } = await (supabase
          .from("tea_shop_settlements") as any)
          .select("*")
          .eq("tea_shop_id", typedShopData.id)
          .order("payment_date", { ascending: false });

        setSettlements((settlementsData || []) as TeaShopSettlement[]);
      } else {
        setEntries([]);
        setSettlements([]);
      }
    } catch (error: any) {
      console.error("Error fetching tea shop data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSite]);

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      const { error } = await supabase.from("tea_shop_entries").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert("Failed to delete: " + error.message);
    }
  };

  const handleDeleteSettlement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this settlement? This will affect the pending balance.")) return;

    try {
      const { error } = await supabase.from("tea_shop_settlements").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert("Failed to delete settlement: " + error.message);
    }
  };

  const handleEditSettlement = (settlement: TeaShopSettlement) => {
    setEditingSettlement(settlement);
    setSettlementDialogOpen(true);
  };

  const filteredEntries = isAllTime
    ? entries
    : entries.filter(
        (e) => dateFrom && dateTo && e.date >= dateFrom && e.date <= dateTo
      );

  // Create combined entries view with holidays and missing entries
  const combinedEntries = useMemo((): CombinedEntryType[] => {
    const entryDates = new Set(filteredEntries.map((e) => e.date));
    const holidayDates = new Set(holidays.map((h) => (h as any).date));
    const result: CombinedEntryType[] = [];

    // Add actual entries
    filteredEntries.forEach((entry) => {
      result.push({ type: "entry", date: entry.date, entry });
    });

    // Add holidays that don't have entries (within date filter)
    holidays.forEach((holiday) => {
      const hDate = (holiday as any).date;
      const inRange = isAllTime || (dateFrom && dateTo && hDate >= dateFrom && hDate <= dateTo);
      if (inRange && !entryDates.has(hDate)) {
        result.push({ type: "holiday", date: hDate, holiday });
      }
    });

    // Add "no entry" rows for dates with attendance but no T&S entry (and not a holiday)
    attendanceByDate.forEach((att, date) => {
      const inRange = isAllTime || (dateFrom && dateTo && date >= dateFrom && date <= dateTo);
      const hasWorkers = att.named > 0 || att.market > 0;

      if (inRange && hasWorkers && !entryDates.has(date) && !holidayDates.has(date)) {
        result.push({ type: "no_entry", date, attendanceCount: att });
      }
    });

    // Sort by date descending
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredEntries, holidays, attendanceByDate, dateFrom, dateTo, isAllTime]);

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Tea Shop" />
        <Alert severity="warning">Please select a site to view tea shop</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <PageHeader
        title="Tea Shop"
        subtitle={shop ? shop.shop_name : "No shop configured"}
        actions={
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {/* Desktop buttons - hidden on mobile via CSS */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>
              {shop && (
                <>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setEditingEntry(null);
                      setEntryDialogOpen(true);
                    }}
                    disabled={!canEdit}
                    size="small"
                  >
                    Add Entry
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PaymentIcon />}
                    onClick={() => setSettlementDialogOpen(true)}
                    disabled={!canEdit || stats.pendingBalance <= 0}
                    size="small"
                  >
                    Pay Shop
                  </Button>
                </>
              )}
            </Box>
            <IconButton onClick={() => setShopDrawerOpen(true)} disabled={!canEdit} size="small">
              <Settings />
            </IconButton>
          </Box>
        }
      />

      {/* Summary Cards */}
      <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: { xs: 1, sm: 2 }, textAlign: "center", bgcolor: stats.pendingBalance > 0 ? "error.50" : "success.50" }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Pending
            </Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              color={stats.pendingBalance > 0 ? "error.main" : "success.main"}
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
            >
              ₹{stats.pendingBalance.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: { xs: 1, sm: 2 }, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              This Week
            </Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              color="primary.main"
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
            >
              ₹{stats.thisWeekTotal.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: { xs: 1, sm: 2 }, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              This Month
            </Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              color="primary.main"
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
            >
              ₹{stats.thisMonthTotal.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: { xs: 1, sm: 2 }, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Last Pay
            </Typography>
            <Typography
              variant="body1"
              fontWeight={600}
              sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
            >
              {stats.lastSettlement
                ? `₹${stats.lastSettlement.amount_paid.toLocaleString()}`
                : "None"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {stats.lastSettlement
                ? dayjs(stats.lastSettlement.payment_date).format("DD MMM")
                : "-"}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* No Shop Alert */}
      {!shop && !loading && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={() => setShopDrawerOpen(true)}>
              Add Shop
            </Button>
          }
        >
          No tea shop configured for this site. Add a shop to start tracking.
        </Alert>
      )}

      {/* Tabs */}
      {shop && (
        <Paper sx={{ borderRadius: 2 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tab label="Entries" icon={<LocalCafe />} iconPosition="start" />
            <Tab label="Settlements" icon={<PaymentIcon />} iconPosition="start" />
          </Tabs>

          {/* Entries Tab */}
          <TabPanel value={tabValue} index={0}>
            {/* Summary Chips */}
            <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
              <Chip
                label={`${entries.length} records`}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, alignItems: "center" }}>
                <Chip
                  icon={<LocalCafe />}
                  label={`Tea: ₹${stats.totalTea.toLocaleString()}`}
                  variant="outlined"
                  color="primary"
                />
                <Chip
                  icon={<Fastfood />}
                  label={`Snacks: ₹${stats.totalSnacks.toLocaleString()}`}
                  variant="outlined"
                  color="secondary"
                />
                <Chip
                  label={`Total: ₹${stats.totalEntries.toLocaleString()}`}
                  color="primary"
                />
              </Box>
            </Box>

            {/* Entries Table - Simplified columns: Date, Att, T&S, By, Actions */}
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <Table size="small" sx={{ minWidth: 400 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.selected" }}>
                      <TableCell sx={{
                        fontWeight: 700,
                        position: 'sticky',
                        left: 0,
                        bgcolor: 'grey.100',
                        zIndex: 1,
                        fontSize: { xs: '0.7rem', sm: '0.875rem' },
                      }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }} align="center">Att</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }} align="right">T&S</TableCell>
                      <TableCell sx={{ fontWeight: 700, display: { xs: 'none', md: 'table-cell' } }} align="center">By</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }} align="center">Act</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {combinedEntries.map((item, idx) => {
                      // Holiday row
                      if (item.type === "holiday") {
                        return (
                          <TableRow key={`holiday-${item.date}`} sx={{ bgcolor: "warning.50" }}>
                            <TableCell
                              colSpan={5}
                              sx={{
                                py: 1.5,
                                borderLeft: 4,
                                borderLeftColor: "warning.main",
                              }}
                            >
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                                <BeachAccessIcon sx={{ color: "warning.main", fontSize: 24 }} />
                                <Typography variant="body2" fontWeight={600}>
                                  {dayjs(item.date).format("DD MMM")}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {dayjs(item.date).format("dddd")}
                                </Typography>
                                <Chip label="Holiday" size="small" color="warning" sx={{ fontWeight: 600 }} />
                                <Typography variant="body2" color="text.secondary">
                                  {item.holiday.reason || "Holiday"}
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      // No entry row (workers present but no T&S recorded)
                      if (item.type === "no_entry") {
                        const totalWorkers = item.attendanceCount.named + item.attendanceCount.market;
                        return (
                          <TableRow key={`no-entry-${item.date}`} sx={{ bgcolor: "grey.50" }}>
                            <TableCell
                              colSpan={5}
                              sx={{
                                py: 1.5,
                                borderLeft: 4,
                                borderLeftColor: "grey.400",
                              }}
                            >
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                                <NoEntryIcon sx={{ color: "text.disabled", fontSize: 24 }} />
                                <Typography variant="body2" fontWeight={600}>
                                  {dayjs(item.date).format("DD MMM")}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {dayjs(item.date).format("dddd")}
                                </Typography>
                                <Chip
                                  label="No Entry"
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                  sx={{ fontWeight: 600 }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {totalWorkers} worker{totalWorkers !== 1 ? "s" : ""} present
                                </Typography>
                                {canEdit && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<AddIcon />}
                                    onClick={() => {
                                      setEditingEntry(null);
                                      setInitialEntryDate(item.date);
                                      setEntryDialogOpen(true);
                                    }}
                                    sx={{ ml: "auto" }}
                                  >
                                    Add Entry
                                  </Button>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      // Regular entry row
                      const entry = item.entry;
                      const extEntry = entry as TeaShopEntryExtended;
                      const isSplit = extEntry.is_split_entry;

                      return (
                        <TableRow key={entry.id} hover>
                          <TableCell sx={{
                            position: 'sticky',
                            left: 0,
                            bgcolor: 'background.paper',
                            zIndex: 1,
                          }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Box>
                                <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                  {dayjs(entry.date).format("DD MMM")}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: { xs: 'none', sm: 'block' } }}
                                >
                                  {dayjs(entry.date).format("ddd")}
                                </Typography>
                              </Box>
                              {isSplit && (
                                <Tooltip title={`Split entry (${extEntry.split_percentage}% of total)`}>
                                  <Chip
                                    icon={<SplitIcon fontSize="small" />}
                                    label={`${extEntry.split_percentage}%`}
                                    size="small"
                                    color="secondary"
                                    variant="outlined"
                                    sx={{ height: 18, '& .MuiChip-label': { fontSize: '0.6rem', px: 0.25 } }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            {(() => {
                              const att = attendanceByDate.get(entry.date);
                              if (!att || (att.named === 0 && att.market === 0)) {
                                return (
                                  <Tooltip title="No attendance found for this date">
                                    <Chip
                                      icon={<WarningIcon fontSize="small" />}
                                      label="N/A"
                                      size="small"
                                      color="warning"
                                      variant="outlined"
                                    />
                                  </Tooltip>
                                );
                              }
                              return (
                                <Tooltip title={`Named: ${att.named}, Market: ${att.market}`}>
                                  <Chip
                                    icon={<GroupIcon fontSize="small" />}
                                    label={`${att.named}+${att.market}`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
                                </Tooltip>
                              );
                            })()}
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight={600} sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                              ₹{(entry.total_amount || 0).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                            <AuditAvatarGroup
                              createdByName={entry.entered_by}
                              createdAt={entry.created_at}
                              updatedByName={(entry as any).updated_by}
                              updatedAt={entry.updated_at}
                              compact
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingEntry(entry);
                                  setInitialEntryDate(undefined);
                                  setEntryDialogOpen(true);
                                }}
                                disabled={!canEdit}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteEntry(entry.id)}
                                disabled={!canEdit}
                                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {combinedEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            No entries found for the selected date range
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Settlements Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ mb: 2 }}>
              <Chip
                label={`${settlements.length} records`}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            </Box>
            <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table size="small" sx={{ minWidth: 800 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.selected" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Payment Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Period</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }} align="right">Total Due</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }} align="right">Amount Paid</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }} align="right">Balance</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }} align="center">Paid By</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }} align="center">Mode</TableCell>
                    <TableCell sx={{ fontWeight: 700, display: { xs: 'none', md: 'table-cell' } }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.875rem' } }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {settlements.map((settlement) => (
                    <TableRow key={settlement.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                          {dayjs(settlement.payment_date).format("DD MMM YYYY")}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                        {dayjs(settlement.period_start).format("DD MMM")} -{" "}
                        {dayjs(settlement.period_end).format("DD MMM")}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>₹{settlement.total_due.toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600} color="success.main" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                          ₹{(settlement.amount_paid || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {(settlement.balance_remaining || 0) > 0 ? (
                          <Typography color="error.main" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                            ₹{(settlement.balance_remaining || 0).toLocaleString()}
                          </Typography>
                        ) : (
                          <Typography color="success.main" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>₹0</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={settlement.payer_type === "site_engineer" ? "Eng" : "Co"}
                          size="small"
                          color={settlement.payer_type === "site_engineer" ? "info" : "primary"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={settlement.payment_mode}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Tooltip title={settlement.notes || ""}>
                          <Typography
                            variant="caption"
                            sx={{ maxWidth: 150, display: "block" }}
                            noWrap
                          >
                            {settlement.notes || "-"}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditSettlement(settlement)}
                            disabled={!canEdit}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSettlement(settlement.id)}
                            disabled={!canEdit}
                            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {settlements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          No settlements recorded yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </Paper>
      )}

      {/* Dialogs */}
      <TeaShopDrawer
        open={shopDrawerOpen}
        onClose={() => setShopDrawerOpen(false)}
        shop={shop}
        siteId={selectedSite.id}
        onSuccess={() => {
          setShopDrawerOpen(false);
          fetchData();
        }}
      />

      {shop && (
        <>
          <TeaShopEntryDialog
            open={entryDialogOpen}
            onClose={() => {
              setEntryDialogOpen(false);
              setEditingEntry(null);
              setInitialEntryDate(undefined);
            }}
            shop={shop}
            entry={editingEntry}
            initialDate={initialEntryDate}
            onSuccess={() => {
              setEntryDialogOpen(false);
              setEditingEntry(null);
              setInitialEntryDate(undefined);
              fetchData();
            }}
          />

          <TeaShopSettlementDialog
            open={settlementDialogOpen}
            onClose={() => {
              setSettlementDialogOpen(false);
              setEditingSettlement(null);
            }}
            shop={shop}
            pendingBalance={stats.pendingBalance}
            entries={entries}
            settlement={editingSettlement}
            onSuccess={() => {
              setSettlementDialogOpen(false);
              setEditingSettlement(null);
              fetchData();
            }}
          />
        </>
      )}

      {/* Mobile FAB - always rendered, visibility controlled by CSS */}
      <Fab
        color="primary"
        onClick={() => {
          setEditingEntry(null);
          setEntryDialogOpen(true);
        }}
        sx={{
          display: shop && canEdit ? { xs: 'flex', sm: 'none' } : 'none',
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
