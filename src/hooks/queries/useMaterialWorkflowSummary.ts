"use client";

import { useMemo } from "react";
import { useRequestSummary } from "./useMaterialRequests";
import { usePOSummary } from "./usePurchaseOrders";
import { usePendingVerificationCount } from "./useDeliveryVerification";
import { useSiteSettlementSummary } from "./useInterSiteSettlements";
import { useSiteMaterialExpenses } from "./useMaterialPurchases";

export interface WorkflowNextAction {
  stage: string;
  label: string;
  description: string;
  count: number;
  path: string;
  priority: "high" | "medium" | "low";
  icon: string; // MUI icon name
}

export interface MaterialWorkflowSummary {
  requests: {
    pending: number;
    approved: number;
    ordered: number;
    fulfilled: number;
    total: number;
  };
  purchaseOrders: {
    draft: number;
    pendingApproval: number;
    ordered: number;
    partialDelivered: number;
    delivered: number;
    total: number;
  };
  deliveries: {
    pendingVerification: number;
  };
  settlements: {
    pending: number;
    settled: number;
    total: number;
  };
  interSite: {
    pendingCount: number;
    unsettledCount: number;
  };
  expenses: {
    total: number;
  };
  nextActions: WorkflowNextAction[];
  isLoading: boolean;
}

export function useMaterialWorkflowSummary(
  siteId: string | undefined
): MaterialWorkflowSummary {
  const { data: requestSummary, isLoading: loadingRequests } =
    useRequestSummary(siteId);
  const { data: poSummary, isLoading: loadingPOs } = usePOSummary(siteId);
  const { data: pendingVerificationCount, isLoading: loadingDeliveries } =
    usePendingVerificationCount(siteId);
  const { data: settlementSummary, isLoading: loadingSettlements } =
    useSiteSettlementSummary(siteId);
  const { data: expensesData, isLoading: loadingExpenses } =
    useSiteMaterialExpenses(siteId);

  const isLoading =
    loadingRequests ||
    loadingPOs ||
    loadingDeliveries ||
    loadingSettlements ||
    loadingExpenses;

  const summary = useMemo(() => {
    const requests = {
      pending: requestSummary?.pending ?? 0,
      approved: requestSummary?.approved ?? 0,
      ordered: requestSummary?.ordered ?? 0,
      fulfilled: requestSummary?.fulfilled ?? 0,
      total: requestSummary?.total ?? 0,
    };

    const purchaseOrders = {
      draft: poSummary?.draft ?? 0,
      pendingApproval: poSummary?.pending_approval ?? 0,
      ordered: poSummary?.ordered ?? 0,
      partialDelivered: poSummary?.partial_delivered ?? 0,
      delivered: poSummary?.delivered ?? 0,
      total: poSummary?.total ?? 0,
    };

    const deliveries = {
      pendingVerification: pendingVerificationCount ?? 0,
    };

    // Material settlements (vendor payments) - pending = no settlement_reference
    // Exclude group_stock batches — they're settled via inter-site settlement, not vendor settlement
    const ownSiteExpenses = expensesData?.expenses?.filter(
      (e) => e.purchase_type !== "group_stock"
    ) ?? [];
    const settlements = {
      pending: ownSiteExpenses.filter(
        (e) => !e.settlement_reference
      ).length,
      settled: ownSiteExpenses.filter(
        (e) => !!e.settlement_reference
      ).length,
      total: ownSiteExpenses.length,
    };

    const interSite = {
      pendingCount: settlementSummary?.pending_settlements_count ?? 0,
      unsettledCount: settlementSummary?.unsettled_count ?? 0,
    };

    const expenses = {
      total: expensesData?.total ?? 0,
    };

    // Compute next actions - what needs attention
    const nextActions: WorkflowNextAction[] = [];

    if (requests.pending > 0) {
      nextActions.push({
        stage: "requests",
        label: `${requests.pending} request${requests.pending > 1 ? "s" : ""} pending approval`,
        description:
          "Material requests waiting for review and approval before purchase orders can be created.",
        count: requests.pending,
        path: "/site/material-requests",
        priority: "high",
        icon: "Assignment",
      });
    }

    if (requests.approved > 0) {
      nextActions.push({
        stage: "requests",
        label: `${requests.approved} approved request${requests.approved > 1 ? "s" : ""} need PO`,
        description:
          "Approved requests that need purchase orders to be created for procurement.",
        count: requests.approved,
        path: "/site/material-requests",
        priority: "medium",
        icon: "Assignment",
      });
    }

    if (purchaseOrders.draft > 0) {
      nextActions.push({
        stage: "purchaseOrders",
        label: `${purchaseOrders.draft} draft PO${purchaseOrders.draft > 1 ? "s" : ""} to submit`,
        description:
          "Draft purchase orders that need to be finalized and submitted for approval.",
        count: purchaseOrders.draft,
        path: "/site/purchase-orders",
        priority: "medium",
        icon: "ShoppingCart",
      });
    }

    if (purchaseOrders.ordered + purchaseOrders.partialDelivered > 0) {
      const activeCount =
        purchaseOrders.ordered + purchaseOrders.partialDelivered;
      nextActions.push({
        stage: "purchaseOrders",
        label: `${activeCount} PO${activeCount > 1 ? "s" : ""} awaiting delivery`,
        description:
          "Purchase orders that have been placed with vendors and are awaiting material delivery.",
        count: activeCount,
        path: "/site/purchase-orders",
        priority: "low",
        icon: "ShoppingCart",
      });
    }

    if (deliveries.pendingVerification > 0) {
      nextActions.push({
        stage: "deliveries",
        label: `${deliveries.pendingVerification} deliver${deliveries.pendingVerification > 1 ? "ies" : "y"} to verify`,
        description:
          "Materials have been delivered and need site engineer verification before settlement.",
        count: deliveries.pendingVerification,
        path: "/site/delivery-verification",
        priority: "high",
        icon: "LocalShipping",
      });
    }

    if (settlements.pending > 0) {
      nextActions.push({
        stage: "settlements",
        label: `${settlements.pending} purchase${settlements.pending > 1 ? "s" : ""} to settle`,
        description:
          "Verified deliveries that need vendor payment settlement.",
        count: settlements.pending,
        path: "/site/material-settlements",
        priority: "medium",
        icon: "Payment",
      });
    }

    if (interSite.unsettledCount > 0) {
      nextActions.push({
        stage: "interSite",
        label: `${interSite.unsettledCount} inter-site record${interSite.unsettledCount > 1 ? "s" : ""} unsettled`,
        description:
          "Group purchase usage records that need inter-site settlement between sites.",
        count: interSite.unsettledCount,
        path: "/site/inter-site-settlement",
        priority: "medium",
        icon: "AccountBalance",
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    nextActions.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    return {
      requests,
      purchaseOrders,
      deliveries,
      settlements,
      interSite,
      expenses,
      nextActions,
      isLoading,
    };
  }, [
    requestSummary,
    poSummary,
    pendingVerificationCount,
    settlementSummary,
    expensesData,
    isLoading,
  ]);

  return summary;
}

/** Badge counts for sidebar - lightweight subset */
export interface MaterialBadgeCounts {
  requests: number;
  purchaseOrders: number;
  deliveries: number;
  settlements: number;
  interSite: number;
}

/** Extract badge counts from full summary */
export function getBadgeCounts(
  summary: MaterialWorkflowSummary
): MaterialBadgeCounts {
  return {
    requests: summary.requests.pending,
    purchaseOrders: summary.purchaseOrders.draft + summary.purchaseOrders.ordered + summary.purchaseOrders.partialDelivered,
    deliveries: summary.deliveries.pendingVerification,
    settlements: summary.settlements.pending,
    interSite: summary.interSite.unsettledCount,
  };
}
