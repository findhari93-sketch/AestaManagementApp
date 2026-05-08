"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Stack,
  TextField,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";
import {
  Close as CloseIcon,
  Save as SaveIcon,
  WbSunny as MorningIcon,
  Brightness3 as EveningIcon,
  Groups as PeopleIcon,
} from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useContractHeadcount } from "@/hooks/queries/useContractHeadcount";
import {
  useContractWorkUpdates,
  useSaveContractWorkUpdates,
} from "@/hooks/queries/useContractWorkUpdates";
import type {
  WorkUpdates,
  MorningUpdate,
  EveningUpdate,
} from "@/types/work-updates.types";
import MorningUpdateForm from "@/components/attendance/work-updates/MorningUpdateForm";
import EveningUpdateForm from "@/components/attendance/work-updates/EveningUpdateForm";

interface TradeAttendanceEntryDrawerProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  contractId: string;
  contractTitle: string;
  /** Date to enter / edit (YYYY-MM-DD). */
  date: string;
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Slice E — slide-up drawer that appears when the supervisor taps a day row
 * in the headcount attendance table. Hosts the per-role unit inputs and
 * the morning + evening photo capture in a single tabbed surface.
 *
 * On mobile: bottom-anchored, full-width, ~80vh. On desktop: right-anchored,
 * 540px wide, full-height. Mirrors civil's AttendanceDrawer behavior.
 */
export function TradeAttendanceEntryDrawer({
  open,
  onClose,
  siteId,
  contractId,
  contractTitle,
  date,
}: TradeAttendanceEntryDrawerProps) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  const isMobile = useIsMobile();

  const { data: headcount, isLoading: headcountLoading } = useContractHeadcount(
    open ? contractId : undefined
  );
  const { data: existingWorkUpdates, isLoading: workUpdatesLoading } =
    useContractWorkUpdates(open ? contractId : undefined, open ? date : undefined);
  const saveWorkUpdates = useSaveContractWorkUpdates();

  // Tab state — Headcount | Morning | Evening
  const [tab, setTab] = useState<"headcount" | "morning" | "evening">("headcount");

  // Local form state
  const [units, setUnits] = useState<Record<string, string>>({});
  const [photoCount, setPhotoCount] = useState<number>(3);
  const [morning, setMorning] = useState<MorningUpdate | null>(null);
  const [evening, setEvening] = useState<EveningUpdate | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open / date change / contract change
  useEffect(() => {
    if (!open) return;
    setError(null);
    setNote("");
    setTab("headcount");
  }, [open, date, contractId]);

  // Pre-fill headcount from existing entries for this date
  useEffect(() => {
    if (!headcount) return;
    const next: Record<string, string> = {};
    for (const e of headcount.recent) {
      if (e.attendanceDate === date) next[e.roleId] = String(e.units);
    }
    setUnits(next);
  }, [headcount, date]);

  // Pre-fill work updates
  useEffect(() => {
    if (!existingWorkUpdates) {
      setPhotoCount(3);
      setMorning(null);
      setEvening(null);
      return;
    }
    setPhotoCount(existingWorkUpdates.photoCount ?? 3);
    setMorning(existingWorkUpdates.morning ?? null);
    setEvening(existingWorkUpdates.evening ?? null);
  }, [existingWorkUpdates]);

  const impliedTotal = useMemo(() => {
    if (!headcount) return 0;
    let sum = 0;
    for (const r of headcount.rates) {
      const n = Number(units[r.roleId] || "0");
      if (!Number.isNaN(n)) sum += n * r.dailyRate;
    }
    return sum;
  }, [headcount, units]);

  const scopedSiteId = `${siteId}/contracts/${contractId}`;

  const handleSave = async () => {
    if (!headcount) return;
    setError(null);
    setSaving(true);
    try {
      const sb = supabase as any;

      // 1) Upsert headcount entries (delete role rows that user cleared to 0)
      const upsertRows: Array<{
        subcontract_id: string;
        attendance_date: string;
        role_id: string;
        units: number;
        note: string | null;
      }> = [];
      const deleteRoleIds: string[] = [];
      for (const r of headcount.rates) {
        const raw = units[r.roleId];
        const n = raw === undefined || raw === "" ? 0 : Number(raw);
        if (Number.isNaN(n) || n < 0) {
          throw new Error(`Invalid units for ${r.roleName}: ${raw}`);
        }
        if (n > 0) {
          upsertRows.push({
            subcontract_id: contractId,
            attendance_date: date,
            role_id: r.roleId,
            units: n,
            note: note.trim() || null,
          });
        } else {
          deleteRoleIds.push(r.roleId);
        }
      }
      if (upsertRows.length > 0) {
        const upsertRes = await sb
          .from("subcontract_headcount_attendance")
          .upsert(upsertRows, {
            onConflict: "subcontract_id,attendance_date,role_id",
          });
        if (upsertRes.error) throw upsertRes.error;
      }
      if (deleteRoleIds.length > 0) {
        const delRes = await sb
          .from("subcontract_headcount_attendance")
          .delete()
          .eq("subcontract_id", contractId)
          .eq("attendance_date", date)
          .in("role_id", deleteRoleIds);
        if (delRes.error) throw delRes.error;
      }

      // 2) Save work updates (morning + evening) if any data
      if (morning || evening || (existingWorkUpdates && photoCount !== existingWorkUpdates.photoCount)) {
        const wuPayload: WorkUpdates = { photoCount, morning, evening };
        await saveWorkUpdates.mutateAsync({
          contractId,
          date,
          workUpdates: wuPayload,
          userId: userProfile?.id,
        });
      }

      // 3) Invalidate everything that depends on this contract's daily state
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contract-headcount", contractId] }),
        queryClient.invalidateQueries({ queryKey: ["contract-work-updates", contractId, date] }),
        queryClient.invalidateQueries({ queryKey: ["trade-attendance-summary", contractId] }),
        queryClient.invalidateQueries({ queryKey: ["trade-reconciliations", "site", siteId] }),
        queryClient.invalidateQueries({ queryKey: ["contract-payments", contractId] }),
      ]);
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("subcontracts-changed");
        bc.postMessage({ siteId, contractId, kind: "headcount-day", at: Date.now() });
        bc.close();
      }
      onClose();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const headerTitle = `${dayjs(date).format("dddd, D MMM YYYY")}`;
  const isFutureDate = dayjs(date).isAfter(dayjs(), "day");

  return (
    <Drawer
      anchor={isMobile ? "bottom" : "right"}
      open={open}
      onClose={saving ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", md: 540 },
          height: { xs: "85vh", md: "100%" },
          borderTopLeftRadius: { xs: 12, md: 0 },
          borderTopRightRadius: { xs: 12, md: 0 },
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6">{headerTitle}</Typography>
            <Typography variant="caption" color="text.secondary">
              {contractTitle}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={saving} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Stack>
        {isFutureDate && (
          <Alert severity="info" sx={{ mt: 1 }}>
            This date is in the future. Wait until the day arrives to enter data.
          </Alert>
        )}
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: "divider", flexShrink: 0 }}
      >
        <Tab
          value="headcount"
          icon={<PeopleIcon fontSize="small" />}
          iconPosition="start"
          label="Headcount"
        />
        <Tab
          value="morning"
          icon={<MorningIcon fontSize="small" />}
          iconPosition="start"
          label="Morning"
        />
        <Tab
          value="evening"
          icon={<EveningIcon fontSize="small" />}
          iconPosition="start"
          label="Evening"
        />
      </Tabs>

      {/* Body — scrollable */}
      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {(headcountLoading || workUpdatesLoading) && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!headcountLoading && headcount && tab === "headcount" && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              How many of each role came today?
            </Typography>
            {headcount.rates.map((r) => (
              <Stack
                key={r.roleId}
                direction="row"
                alignItems="center"
                spacing={1.5}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2">{r.roleName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    ₹{formatINR(r.dailyRate)}/day
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  value={units[r.roleId] ?? ""}
                  onChange={(e) =>
                    setUnits((u) => ({
                      ...u,
                      [r.roleId]: e.target.value.replace(/[^0-9.]/g, ""),
                    }))
                  }
                  placeholder="0"
                  sx={{ width: 100 }}
                  inputProps={{ inputMode: "decimal" }}
                  helperText="units"
                />
                <Chip
                  size="small"
                  label={(() => {
                    const n = Number(units[r.roleId] || "0");
                    return Number.isNaN(n) || n === 0
                      ? "—"
                      : `₹${formatINR(n * r.dailyRate)}`;
                  })()}
                  variant="outlined"
                  sx={{ minWidth: 90 }}
                />
              </Stack>
            ))}

            <Divider />

            <TextField
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={2}
            />

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2" color="text.secondary">
                Implied labor today
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                ₹{formatINR(impliedTotal)}
              </Typography>
            </Stack>
          </Stack>
        )}

        {!workUpdatesLoading && tab === "morning" && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              What&apos;s planned for today + photos
            </Typography>
            <MorningUpdateForm
              supabase={supabase}
              siteId={scopedSiteId}
              date={date}
              initialData={morning}
              photoCount={photoCount}
              onPhotoCountChange={setPhotoCount}
              onChange={setMorning}
              disabled={saving}
            />
          </Box>
        )}

        {!workUpdatesLoading && tab === "evening" && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              What got done + completion photos
            </Typography>
            <EveningUpdateForm
              supabase={supabase}
              siteId={scopedSiteId}
              date={date}
              morningData={morning}
              initialData={evening}
              photoCount={photoCount}
              onChange={setEvening}
              disabled={saving}
            />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: "divider",
          flexShrink: 0,
          display: "flex",
          gap: 1,
          justifyContent: "flex-end",
        }}
      >
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || isFutureDate}
        >
          {saving ? "Saving…" : "Save day"}
        </Button>
      </Box>
    </Drawer>
  );
}
