"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Snackbar,
  Tab,
  Tabs,
  Tooltip,
} from "@mui/material";
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from "@mui/icons-material";
import { useSelectedSite } from "@/contexts/SiteContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import PageHeader from "@/components/layout/PageHeader";
import ScopeChip from "@/components/common/ScopeChip";
import PendingBanner from "@/components/payments/PendingBanner";
import { SalarySliceHero } from "@/components/payments/SalarySliceHero";
import { SalaryWaterfallList } from "@/components/payments/SalaryWaterfallList";
import { AdvancesList } from "@/components/payments/AdvancesList";
import { DailyMarketLedger } from "@/components/payments/DailyMarketLedger";
import { SubcontractContextStrip } from "@/components/payments/SubcontractContextStrip";
import PaymentsLedger from "@/components/payments/PaymentsLedger";
import { MestriSettleDialog } from "@/components/payments/MestriSettleDialog";
import { usePaymentSummary } from "@/hooks/queries/usePaymentSummary";
import { usePaymentsLedger } from "@/hooks/queries/usePaymentsLedger";
import { useSalarySliceSummary } from "@/hooks/queries/useSalarySliceSummary";
import { useSalaryWaterfall } from "@/hooks/queries/useSalaryWaterfall";
import { useAdvances } from "@/hooks/queries/useAdvances";
import { useSubcontractSpend } from "@/hooks/queries/useSubcontractSpend";
import { useInspectPane } from "@/hooks/useInspectPane";
import { InspectPane } from "@/components/common/InspectPane";
import type { InspectEntity } from "@/components/common/InspectPane";

type ActiveTab = "all" | "contract" | "daily-market";

export default function PaymentsContent() {
  const { selectedSite } = useSelectedSite();
  const { formatForApi, isAllTime } = useDateRange();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { dateFrom, dateTo } = formatForApi();
  const effectiveFrom = isAllTime ? null : dateFrom;
  const effectiveTo = isAllTime ? null : dateTo;

  const highlightRef = searchParams.get("ref");

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("contract");
  const [settleDialog, setSettleDialog] = useState<null | {
    weekStart: string;
    weekEnd: string;
    suggestedAmount: number;
  }>(null);

  const pane = useInspectPane();

  // Subcontract scoping picker is intentionally out of scope for this plan;
  // the page operates against all subcontracts on the site. The
  // SubcontractContextStrip below renders its fallback layout in this mode
  // and the new RPCs treat null as "aggregate across all subcontracts".
  const selectedSubcontractId: string | null = null;
  const selectedSubcontractTitle: string | null = null;

  const subcontractSpendQuery = useSubcontractSpend(selectedSubcontractId);

  const summaryQuery = usePaymentSummary(
    selectedSite?.id,
    effectiveFrom,
    effectiveTo
  );

  const salarySummaryQuery = useSalarySliceSummary({
    siteId: selectedSite?.id,
    subcontractId: selectedSubcontractId,
    dateFrom: effectiveFrom,
    dateTo: effectiveTo,
  });

  const waterfallQuery = useSalaryWaterfall({
    siteId: selectedSite?.id,
    subcontractId: selectedSubcontractId,
    dateFrom: effectiveFrom,
    dateTo: effectiveTo,
  });

  const advancesQuery = useAdvances({
    siteId: selectedSite?.id,
    dateFrom: effectiveFrom,
    dateTo: effectiveTo,
  });

  const dailyMarketLedgerQuery = usePaymentsLedger({
    siteId: selectedSite?.id,
    dateFrom: effectiveFrom,
    dateTo: effectiveTo,
    status: "all",
    type: "daily-market",
  });

  const allLedgerQuery = usePaymentsLedger({
    siteId: selectedSite?.id,
    dateFrom: effectiveFrom,
    dateTo: effectiveTo,
    status: "all",
    type: "all",
  });

  const pendingDailyMarketCount = (dailyMarketLedgerQuery.data ?? []).filter(
    (r) => r.isPending
  ).length;

  const handleSettleClick = useCallback(
    (entity: InspectEntity) => {
      // weekly-aggregate: open the in-page MestriSettleDialog scoped to that week.
      // Other kinds: route to /site/attendance which has the full per-day data
      // shape needed for the older settlement dialogs.
      if (entity.kind === "weekly-aggregate") {
        const week = waterfallQuery.data?.find(
          (w) => w.weekStart === entity.weekStart
        );
        const suggestedAmount = week
          ? Math.max(0, week.wagesDue - week.paid)
          : 0;
        setSettleDialog({
          weekStart: entity.weekStart,
          weekEnd: entity.weekEnd,
          suggestedAmount,
        });
        return;
      }
      const url =
        entity.kind === "daily-date"
          ? `/site/attendance?date=${entity.date}`
          : entity.kind === "weekly-week"
            ? `/site/attendance?weekStart=${entity.weekStart}&laborerId=${entity.laborerId}`
            : "/site/attendance";
      setNotice("Opening attendance to record this settlement…");
      router.push(url);
    },
    [router, waterfallQuery.data]
  );

  const handleOpenInPage = useCallback(
    (entity: InspectEntity) => {
      const url =
        entity.kind === "daily-date"
          ? `/site/attendance?date=${entity.date}`
          : entity.kind === "weekly-week"
            ? `/site/attendance?weekStart=${entity.weekStart}&laborerId=${entity.laborerId}`
            : "/site/attendance";
      router.push(url);
    },
    [router]
  );

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Salary Settlements" titleChip={<ScopeChip />} />
        <Alert severity="info">
          Please select a site from the dropdown to view salary settlements.
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        ...(isFullscreen && {
          position: "fixed",
          inset: 0,
          zIndex: 1300,
          height: "100vh",
          bgcolor: "background.default",
        }),
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title="Salary Settlements"
          titleChip={<ScopeChip />}
          actions={
            <Tooltip title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <IconButton
                onClick={() => setIsFullscreen((v) => !v)}
                size="small"
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
          }
        />

        <SubcontractContextStrip
          subcontractTitle={selectedSubcontractTitle}
          totalValue={subcontractSpendQuery.data?.totalValue ?? null}
          spent={subcontractSpendQuery.data?.spent ?? null}
          onOpenFullBurnDown={() => {
            if (selectedSubcontractId) {
              router.push(`/site/subcontracts?focus=${selectedSubcontractId}`);
            } else {
              router.push("/site/subcontracts");
            }
          }}
        />

        <SalarySliceHero
          summary={salarySummaryQuery.data}
          isLoading={salarySummaryQuery.isLoading}
        />

        <PendingBanner
          pendingAmount={summaryQuery.data?.pendingAmount ?? 0}
          pendingDatesCount={summaryQuery.data?.pendingDatesCount ?? 0}
        />

        {highlightRef && (
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderBottom: 1,
              borderColor: "divider",
              fontSize: 12,
              color: "text.secondary",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            Highlighting: {highlightRef}
          </Box>
        )}
      </Box>

      <Box sx={{ flexShrink: 0, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v as ActiveTab)}
          variant="fullWidth"
          sx={{
            minHeight: 40,
            "& .MuiTab-root": {
              minHeight: 40,
              fontSize: 12.5,
              fontWeight: 600,
              textTransform: "none",
            },
          }}
        >
          <Tab
            value="contract"
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <span>💼</span>
                <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                  Contract Settlement
                </Box>
                <Chip
                  size="small"
                  label={
                    (waterfallQuery.data?.length ?? 0) +
                    (advancesQuery.data?.length ?? 0)
                  }
                  sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                />
              </Box>
            }
          />
          <Tab
            value="daily-market"
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <span>📅</span>
                <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                  Daily + Market
                </Box>
                <Chip
                  size="small"
                  color={pendingDailyMarketCount > 0 ? "warning" : "default"}
                  label={pendingDailyMarketCount}
                  sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                />
              </Box>
            }
          />
          <Tab
            value="all"
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <span>📋</span>
                <Box sx={{ display: { xs: "none", sm: "inline" } }}>All</Box>
                <Chip
                  size="small"
                  label={allLedgerQuery.data?.length ?? 0}
                  sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                />
              </Box>
            }
          />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {(salarySummaryQuery.isError || waterfallQuery.isError || advancesQuery.isError) &&
          activeTab === "contract" && (
            <Alert severity="error" sx={{ m: 1.5 }}>
              Couldn&apos;t load contract settlement data.
            </Alert>
          )}
        {dailyMarketLedgerQuery.isError && activeTab === "daily-market" && (
          <Alert severity="error" sx={{ m: 1.5 }}>
            Couldn&apos;t load daily/market ledger:{" "}
            {(dailyMarketLedgerQuery.error as Error)?.message ?? "Unknown error"}
          </Alert>
        )}
        {allLedgerQuery.isError && activeTab === "all" && (
          <Alert severity="error" sx={{ m: 1.5 }}>
            Couldn&apos;t load unified ledger:{" "}
            {(allLedgerQuery.error as Error)?.message ?? "Unknown error"}
          </Alert>
        )}

        {activeTab === "contract" && (
          <Box>
            <SalaryWaterfallList
              weeks={waterfallQuery.data ?? []}
              futureCredit={salarySummaryQuery.data?.futureCredit ?? 0}
              isLoading={waterfallQuery.isLoading}
              onRowClick={(week) => {
                pane.open({
                  kind: "weekly-aggregate",
                  siteId: selectedSite.id,
                  subcontractId: selectedSubcontractId,
                  weekStart: week.weekStart,
                  weekEnd: week.weekEnd,
                  scopeFrom: effectiveFrom,
                  scopeTo: effectiveTo,
                });
              }}
              onSettleClick={(week) => {
                setSettleDialog({
                  weekStart: week.weekStart,
                  weekEnd: week.weekEnd,
                  suggestedAmount: Math.max(0, week.wagesDue - week.paid),
                });
              }}
            />
            {(advancesQuery.data?.length ?? 0) > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <AdvancesList
                  advances={advancesQuery.data ?? []}
                  isLoading={advancesQuery.isLoading}
                  onRowClick={(adv) => {
                    pane.open({
                      kind: "advance",
                      siteId: selectedSite.id,
                      settlementId: adv.id,
                      settlementRef: adv.settlementRef,
                    });
                  }}
                />
              </Box>
            )}
          </Box>
        )}

        {activeTab === "daily-market" && (
          <DailyMarketLedger
            rows={dailyMarketLedgerQuery.data ?? []}
            isLoading={dailyMarketLedgerQuery.isLoading}
            onRowClick={(row) => {
              pane.open({
                kind: "daily-date",
                siteId: selectedSite.id,
                date: row.date,
                settlementRef: row.settlementRef,
              });
            }}
            onSettleClick={(row) =>
              handleSettleClick({
                kind: "daily-date",
                siteId: selectedSite.id,
                date: row.date,
                settlementRef: row.settlementRef,
              })
            }
          />
        )}

        {activeTab === "all" && (
          <PaymentsLedger
            rows={allLedgerQuery.data ?? []}
            isLoading={allLedgerQuery.isLoading}
            selectedEntity={pane.currentEntity}
            onRowClick={(entity) => pane.open(entity)}
            onSettleClick={(entity) => handleSettleClick(entity)}
          />
        )}
      </Box>

      {settleDialog && (
        <MestriSettleDialog
          open
          onClose={() => setSettleDialog(null)}
          siteId={selectedSite.id}
          weekStart={settleDialog.weekStart}
          weekEnd={settleDialog.weekEnd}
          suggestedAmount={settleDialog.suggestedAmount}
          initialSubcontractId={selectedSubcontractId}
        />
      )}

      <InspectPane
        entity={pane.currentEntity}
        isOpen={pane.isOpen}
        isPinned={pane.isPinned}
        activeTab={pane.activeTab}
        onTabChange={pane.setActiveTab}
        onClose={pane.close}
        onTogglePin={pane.togglePin}
        onOpenInPage={handleOpenInPage}
        onSettleClick={handleSettleClick}
      />

      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        message={notice}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
