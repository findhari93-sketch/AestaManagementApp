"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Assignment as RequestIcon,
  ShoppingCart as POIcon,
  LocalShipping as DeliveryIcon,
  PaymentOutlined as SettlementIcon,
  AccountBalanceWallet as ExpensesIcon,
  AccountBalance as InterSiteIcon,
  Inventory2 as InventoryIcon,
  ExpandMore,
  ExpandLess,
  Check as CheckIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useSite } from "@/contexts/SiteContext";
import {
  useMaterialWorkflowSummary,
  type MaterialWorkflowSummary,
} from "@/hooks/queries/useMaterialWorkflowSummary";

export type WorkflowStep =
  | "requests"
  | "purchaseOrders"
  | "deliveries"
  | "settlements"
  | "expenses"
  | "interSite"
  | "inventory";

interface WorkflowStepConfig {
  key: WorkflowStep;
  label: string;
  shortLabel: string;
  path: string;
  icon: React.ReactElement;
  getBadge: (summary: MaterialWorkflowSummary) => number;
}

// Main linear flow: Request → PO → Delivery → Settlement → Expenses
const mainFlowSteps: WorkflowStepConfig[] = [
  {
    key: "requests",
    label: "Requests",
    shortLabel: "Req",
    path: "/site/material-requests",
    icon: <RequestIcon sx={{ fontSize: 16 }} />,
    getBadge: (s) => s.requests.pending,
  },
  {
    key: "purchaseOrders",
    label: "Purchase Orders",
    shortLabel: "PO",
    path: "/site/purchase-orders",
    icon: <POIcon sx={{ fontSize: 16 }} />,
    getBadge: (s) =>
      s.purchaseOrders.draft +
      s.purchaseOrders.ordered +
      s.purchaseOrders.partialDelivered,
  },
  {
    key: "deliveries",
    label: "Delivery",
    shortLabel: "Del",
    path: "/site/delivery-verification",
    icon: <DeliveryIcon sx={{ fontSize: 16 }} />,
    getBadge: (s) => s.deliveries.pendingVerification,
  },
  {
    key: "settlements",
    label: "Settlement",
    shortLabel: "Set",
    path: "/site/material-settlements",
    icon: <SettlementIcon sx={{ fontSize: 16 }} />,
    getBadge: (s) => s.settlements.pending,
  },
  {
    key: "expenses",
    label: "Expenses",
    shortLabel: "Exp",
    path: "/site/material-expenses",
    icon: <ExpensesIcon sx={{ fontSize: 16 }} />,
    getBadge: () => 0,
  },
];

// Branch flow: Inter-Site Settlement → Inventory → Expenses
const branchFlowSteps: WorkflowStepConfig[] = [
  {
    key: "interSite",
    label: "Inter-Site",
    shortLabel: "I-S",
    path: "/site/inter-site-settlement",
    icon: <InterSiteIcon sx={{ fontSize: 16 }} />,
    getBadge: (s) => s.interSite.unsettledCount,
  },
  {
    key: "inventory",
    label: "Inventory",
    shortLabel: "Inv",
    path: "/site/inventory",
    icon: <InventoryIcon sx={{ fontSize: 16 }} />,
    getBadge: () => 0,
  },
];

interface MaterialWorkflowBarProps {
  currentStep: WorkflowStep;
  /** Show in expanded mode (for hub page) */
  expanded?: boolean;
}

export default function MaterialWorkflowBar({
  currentStep,
  expanded: forceExpanded,
}: MaterialWorkflowBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { selectedSite } = useSite();
  const summary = useMaterialWorkflowSummary(selectedSite?.id);

  const storageKey = "material_workflow_bar";
  const [isExpanded, setIsExpanded] = useState(forceExpanded ?? true);

  useEffect(() => {
    if (forceExpanded !== undefined) return;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        setIsExpanded(saved === "true");
      }
    }
  }, [forceExpanded]);

  const handleToggle = () => {
    if (forceExpanded !== undefined) return;
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, String(newState));
    }
  };

  const currentMainIndex = mainFlowSteps.findIndex(
    (s) => s.key === currentStep
  );
  const isBranchStep =
    currentStep === "interSite" || currentStep === "inventory";

  // Find current step label for collapsed header
  const allSteps = [...mainFlowSteps, ...branchFlowSteps];
  const currentStepConfig = allSteps.find((s) => s.key === currentStep);

  const CIRCLE_SIZE = isMobile ? 28 : 32;
  const CIRCLE_SIZE_ACTIVE = isMobile ? 32 : 36;

  const renderStep = (
    step: WorkflowStepConfig,
    index: number,
    isCurrent: boolean,
    isPast: boolean
  ) => {
    const badgeCount = step.getBadge(summary);
    const size = isCurrent ? CIRCLE_SIZE_ACTIVE : CIRCLE_SIZE;

    return (
      <Box
        key={step.key}
        onClick={() => router.push(step.path)}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
          position: "relative",
          zIndex: 1,
          minWidth: isMobile ? 48 : 72,
          "&:hover .step-circle": {
            transform: "scale(1.1)",
            boxShadow: `0 0 0 3px ${theme.palette.primary.main}22`,
          },
          "&:hover .step-label": {
            color: theme.palette.primary.main,
          },
        }}
      >
        {/* Circle */}
        <Box
          className="step-circle"
          sx={{
            width: size,
            height: size,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            ...(isCurrent && {
              bgcolor: "primary.main",
              color: "white",
              boxShadow: `0 0 0 3px ${theme.palette.primary.main}33`,
            }),
            ...(isPast && {
              bgcolor: "primary.main",
              color: "white",
              opacity: 0.7,
            }),
            ...(!isCurrent &&
              !isPast && {
                bgcolor: "grey.100",
                color: "grey.500",
                border: `2px solid`,
                borderColor: badgeCount > 0 ? "warning.main" : "grey.300",
              }),
          }}
        >
          {isPast ? (
            <CheckIcon sx={{ fontSize: isMobile ? 14 : 16 }} />
          ) : (
            <Box sx={{ "& > svg": { fontSize: isMobile ? 14 : 16 } }}>
              {step.icon}
            </Box>
          )}
        </Box>

        {/* Label */}
        <Typography
          className="step-label"
          sx={{
            fontSize: isMobile ? "0.6rem" : "0.7rem",
            fontWeight: isCurrent ? 700 : 500,
            color: isCurrent ? "primary.main" : "text.secondary",
            mt: 0.5,
            textAlign: "center",
            lineHeight: 1.2,
            transition: "color 0.2s ease",
            whiteSpace: isMobile ? "nowrap" : "normal",
            maxWidth: isMobile ? 56 : 80,
          }}
        >
          {isMobile ? step.shortLabel : step.label}
        </Typography>

        {/* Badge count */}
        {badgeCount > 0 && (
          <Typography
            sx={{
              fontSize: "0.6rem",
              fontWeight: 700,
              color: "warning.dark",
              mt: 0.25,
              lineHeight: 1,
            }}
          >
            {badgeCount}
          </Typography>
        )}
      </Box>
    );
  };

  // Collapsed header
  const collapsedHeader = (
    <Box
      onClick={handleToggle}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        cursor: forceExpanded !== undefined ? "default" : "pointer",
        py: 1,
        px: 2,
        "&:hover":
          forceExpanded === undefined ? { bgcolor: "action.hover" } : {},
      }}
    >
      {currentStepConfig && (
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            bgcolor: "primary.main",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "& > svg": { fontSize: 14 },
          }}
        >
          {currentStepConfig.icon}
        </Box>
      )}
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, color: "text.primary" }}
      >
        {currentStepConfig?.label || "Materials"}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {`Step ${currentMainIndex >= 0 ? currentMainIndex + 1 : "—"} of ${mainFlowSteps.length}`}
      </Typography>
      {forceExpanded === undefined && (
        <IconButton size="small" sx={{ p: 0.25, ml: "auto" }}>
          {isExpanded ? (
            <ExpandLess sx={{ fontSize: 18 }} />
          ) : (
            <ExpandMore sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      )}
    </Box>
  );

  // Expanded stepper
  const expandedContent = (
    <Box sx={{ px: isMobile ? 1 : 2, pb: 1.5, pt: forceExpanded ? 1.5 : 0.5 }}>
      {/* Main flow stepper */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          position: "relative",
          justifyContent: "space-between",
          overflowX: "auto",
          "&::-webkit-scrollbar": { height: 0 },
        }}
      >
        {/* Connector line behind circles */}
        <Box
          sx={{
            position: "absolute",
            top: isMobile ? 14 : 16,
            left: isMobile ? 24 : 36,
            right: isMobile ? 24 : 36,
            height: 2,
            bgcolor: "grey.200",
            zIndex: 0,
          }}
        />
        {/* Filled portion of connector (up to current step) */}
        {currentMainIndex >= 0 && (
          <Box
            sx={{
              position: "absolute",
              top: isMobile ? 14 : 16,
              left: isMobile ? 24 : 36,
              width: `${(currentMainIndex / (mainFlowSteps.length - 1)) * 100}%`,
              maxWidth: `calc(100% - ${isMobile ? 48 : 72}px)`,
              height: 2,
              bgcolor: "primary.main",
              opacity: 0.5,
              zIndex: 0,
              transition: "width 0.3s ease",
            }}
          />
        )}

        {mainFlowSteps.map((step, index) =>
          renderStep(
            step,
            index,
            step.key === currentStep,
            currentMainIndex >= 0 && index < currentMainIndex && !isBranchStep
          )
        )}
      </Box>

      {/* Branch flow - subtle secondary row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          mt: 1.5,
          pt: 1,
          borderTop: `1px dashed ${theme.palette.divider}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontSize: "0.65rem",
            color: "text.disabled",
            fontStyle: "italic",
            mr: 0.5,
          }}
        >
          Group:
        </Typography>
        {branchFlowSteps.map((step, index) => {
          const isCurrent = step.key === currentStep;
          const badgeCount = step.getBadge(summary);
          return (
            <Box
              key={step.key}
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              {index > 0 && (
                <Typography
                  component="span"
                  sx={{ color: "text.disabled", fontSize: "0.6rem" }}
                >
                  ·
                </Typography>
              )}
              <Typography
                component="span"
                onClick={() => router.push(step.path)}
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? "primary.main" : "text.secondary",
                  cursor: "pointer",
                  textDecoration: isCurrent ? "underline" : "none",
                  textUnderlineOffset: 2,
                  "&:hover": {
                    color: "primary.main",
                    textDecoration: "underline",
                  },
                }}
              >
                {step.label}
                {badgeCount > 0 && (
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      color: "warning.dark",
                      ml: 0.25,
                    }}
                  >
                    ({badgeCount})
                  </Typography>
                )}
              </Typography>
            </Box>
          );
        })}
        <Typography
          component="span"
          sx={{ color: "text.disabled", fontSize: "0.6rem" }}
        >
          ·
        </Typography>
        <Typography
          component="span"
          onClick={() => router.push("/site/material-expenses")}
          sx={{
            fontSize: "0.7rem",
            fontWeight: currentStep === "expenses" ? 700 : 500,
            color:
              currentStep === "expenses" ? "primary.main" : "text.secondary",
            cursor: "pointer",
            "&:hover": {
              color: "primary.main",
              textDecoration: "underline",
            },
          }}
        >
          Expenses
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        mb: 2,
        overflow: "hidden",
      }}
    >
      {forceExpanded ? (
        expandedContent
      ) : (
        <>
          {collapsedHeader}
          <Collapse in={isExpanded}>
            <Box sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
              {expandedContent}
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
}
