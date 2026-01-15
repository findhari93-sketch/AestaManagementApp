"use client";

/**
 * Refactored Attendance Content
 *
 * This component demonstrates how to use the extracted components.
 * It can be used as a template for gradually migrating from the original
 * attendance-content.tsx (6779 lines) to a cleaner architecture.
 *
 * Integration Strategy:
 * 1. Import extracted components from ./components
 * 2. Use useAttendanceState hook for centralized state
 * 3. Pass props to child components instead of inline rendering
 * 4. Memoize callbacks to prevent unnecessary re-renders
 *
 * To enable this refactored version:
 * 1. Add NEXT_PUBLIC_FF_ATTENDANCE_REFACTOR=true to .env
 * 2. Update attendance/page.tsx to conditionally import this file
 */

import React, { useCallback, useMemo } from "react";
import { Box, Alert } from "@mui/material";
import { useSite } from "@/contexts/SiteContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useAuth } from "@/contexts/AuthContext";
import { hasEditPermission } from "@/lib/permissions";
import PageHeader from "@/components/layout/PageHeader";
import AttendanceSkeleton from "@/app/(main)/site/attendance/attendance-skeleton";

// Import extracted components
import {
  PeriodSummary,
  AttendanceSpeedDial,
  TeaShopPopover,
  EditAttendanceDialog,
  EditMarketLaborerDialog,
  DeleteConfirmDialog,
} from "./components";

// Import types
import type { PeriodTotals } from "./components";

// Import state management
import { useAttendanceState } from "./hooks/useAttendanceState";

interface AttendanceContentRefactoredProps {
  initialData?: unknown;
}

/**
 * Refactored Attendance Content Component
 *
 * This is a demonstration of how the extracted components integrate together.
 * The actual implementation would need to:
 * 1. Fetch attendance data
 * 2. Calculate date summaries
 * 3. Handle all user interactions
 */
export default function AttendanceContentRefactored({
  initialData,
}: AttendanceContentRefactoredProps) {
  // Context hooks
  const { selectedSite, loading: siteLoading } = useSite();
  const { startDate, endDate } = useDateRange();
  const { userProfile, loading: authLoading } = useAuth();

  // Derive edit permission from user role
  const canEdit = hasEditPermission(userProfile?.role);

  // Use the centralized state management hook
  const { state, actions } = useAttendanceState();

  // Memoized period totals calculation
  const periodTotals = useMemo<PeriodTotals>(() => {
    // This would be calculated from actual data
    // For now, return default values
    return {
      totalExpense: 0,
      totalSalary: 0,
      totalTeaShop: 0,
      totalDailyAmount: 0,
      totalContractAmount: 0,
      totalMarketAmount: 0,
      totalPaidAmount: 0,
      totalPaidCount: 0,
      totalPendingAmount: 0,
      totalPendingCount: 0,
      avgPerDay: 0,
    };
  }, []);

  // Memoized callbacks for SpeedDial
  const handleSpeedDialToggle = useCallback(() => {
    actions.setSpeedDialOpen(!state.speedDialOpen);
  }, [actions, state.speedDialOpen]);

  const handleSpeedDialClose = useCallback(() => {
    actions.setSpeedDialOpen(false);
  }, [actions]);

  const handleMorningEntry = useCallback(() => {
    actions.setSpeedDialOpen(false);
    actions.openDrawer("morning");
  }, [actions]);

  const handleFullDayEntry = useCallback(() => {
    actions.setSpeedDialOpen(false);
    actions.openDrawer("full");
  }, [actions]);

  const handleHolidayClick = useCallback(() => {
    actions.setSpeedDialOpen(false);
    actions.openHolidayDialog("add");
  }, [actions]);

  // Memoized callbacks for dialogs
  const handleEditSubmit = useCallback(
    async (recordId: string, form: { work_days: number; daily_rate_applied: number }) => {
      // Implementation would update the record
      console.log("Edit submitted:", recordId, form);
      actions.closeEditDialog();
    },
    [actions]
  );

  const handleDeleteConfirm = useCallback(async () => {
    // Implementation would delete all records for the date
    console.log("Delete confirmed");
    actions.closeDeleteDialog();
  }, [actions]);

  const handleTeaShopEdit = useCallback(
    (date: string, isGroupEntry: boolean, entryId?: string) => {
      console.log("Edit tea shop:", date, isGroupEntry, entryId);
      actions.closeTeaShopPopover();
    },
    [actions]
  );

  // Show loading state
  if (siteLoading || authLoading) {
    return <AttendanceSkeleton />;
  }

  // Show site selection message
  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Attendance" />
        <Alert severity="warning">Please select a site to view attendance</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        height: { xs: "calc(100vh - 56px)", sm: "calc(100vh - 64px)" },
        minHeight: 0,
      }}
    >
      {/* Header */}
      <PageHeader title="Attendance" subtitle={selectedSite?.name} />

      {/* Period Summary - Extracted Component */}
      <PeriodSummary periodTotals={periodTotals} />

      {/* Main content area would go here */}
      <Box sx={{ flex: 1, p: 2 }}>
        <Alert severity="info">
          This is the refactored attendance component. The main table and date
          entries would be rendered here using the extracted row components:
          <ul>
            <li>HolidayGroupRow - for holiday entries</li>
            <li>UnfilledGroupRow - for unfilled date ranges</li>
            <li>WeeklySeparatorRow - for weekly summaries</li>
          </ul>
        </Alert>
      </Box>

      {/* Speed Dial - Extracted Component */}
      <AttendanceSpeedDial
        open={state.speedDialOpen}
        onToggle={handleSpeedDialToggle}
        onClose={handleSpeedDialClose}
        onMorningEntry={handleMorningEntry}
        onFullDayEntry={handleFullDayEntry}
        onHolidayClick={handleHolidayClick}
        todayIsHoliday={!!state.holiday.todayHoliday}
        canEdit={canEdit}
      />

      {/* Edit Attendance Dialog - Extracted Component */}
      <EditAttendanceDialog
        open={state.editDialog.open}
        onClose={actions.closeEditDialog}
        record={state.editDialog.record}
        loading={state.loading}
        onSubmit={handleEditSubmit}
      />

      {/* Edit Market Laborer Dialog - Extracted Component */}
      <EditMarketLaborerDialog
        open={state.marketLaborerEdit.open}
        onClose={actions.closeMarketLaborerEdit}
        record={state.marketLaborerEdit.record}
        loading={state.loading}
        onSubmit={async (recordId, form) => {
          console.log("Market laborer edit:", recordId, form);
          actions.closeMarketLaborerEdit();
        }}
      />

      {/* Delete Confirmation Dialog - Extracted Component */}
      <DeleteConfirmDialog
        open={state.deleteDialog.open}
        onClose={actions.closeDeleteDialog}
        data={state.deleteDialog.data}
        loading={state.loading}
        onConfirm={handleDeleteConfirm}
      />

      {/* Tea Shop Popover - Extracted Component */}
      <TeaShopPopover
        anchorEl={state.teaShop.popoverAnchor}
        onClose={actions.closeTeaShopPopover}
        date={state.teaShop.popoverData?.date || null}
        data={state.teaShop.popoverData?.data || null}
        groupAllocations={state.teaShop.popoverGroupAllocations}
        onEdit={handleTeaShopEdit}
      />
    </Box>
  );
}
