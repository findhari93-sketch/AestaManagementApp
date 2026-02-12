"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Collapse,
  useTheme,
  Skeleton,
  Chip,
} from "@mui/material";
import {
  Assignment as RequestIcon,
  ShoppingCart as POIcon,
  LocalShipping as DeliveryIcon,
  PaymentOutlined as SettlementIcon,
  AccountBalanceWallet as ExpensesIcon,
  AccountBalance as InterSiteIcon,
  Inventory2 as InventoryIcon,
  ArrowForward as ArrowIcon,
  ExpandMore,
  ExpandLess,
  HelpOutline as HelpIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import MaterialWorkflowBar from "@/components/materials/MaterialWorkflowBar";
import { useSite } from "@/contexts/SiteContext";
import { useMaterialWorkflowSummary } from "@/hooks/queries/useMaterialWorkflowSummary";

const ICON_MAP: Record<string, React.ReactElement> = {
  Assignment: <RequestIcon />,
  ShoppingCart: <POIcon />,
  LocalShipping: <DeliveryIcon />,
  Payment: <SettlementIcon />,
  AccountBalance: <InterSiteIcon />,
};

const PRIORITY_COLORS: Record<string, "error" | "warning" | "info"> = {
  high: "error",
  medium: "warning",
  low: "info",
};

const GUIDE_STORAGE_KEY = "material_workflow_guide_collapsed";

const workflowGuideSteps = [
  {
    number: 1,
    title: "Create a Material Request",
    description:
      "Site engineer creates a request listing materials needed at the site.",
    icon: <RequestIcon sx={{ fontSize: 20, color: "primary.main" }} />,
    path: "/site/material-requests",
  },
  {
    number: 2,
    title: "Create a Purchase Order",
    description:
      "Office staff creates a PO from approved requests, selecting vendor and prices.",
    icon: <POIcon sx={{ fontSize: 20, color: "primary.main" }} />,
    path: "/site/purchase-orders",
  },
  {
    number: 3,
    title: "Verify Delivery",
    description:
      "When materials arrive, site engineer verifies quantity and quality.",
    icon: <DeliveryIcon sx={{ fontSize: 20, color: "primary.main" }} />,
    path: "/site/delivery-verification",
  },
  {
    number: 4,
    title: "Settle with Vendor",
    description:
      "After verification, record vendor payment to complete the purchase.",
    icon: <SettlementIcon sx={{ fontSize: 20, color: "primary.main" }} />,
    path: "/site/material-settlements",
  },
  {
    number: 5,
    title: "Track in Expenses",
    description:
      "Own-site purchases go directly to expenses. Group purchases go through inter-site settlement first.",
    icon: <ExpensesIcon sx={{ fontSize: 20, color: "primary.main" }} />,
    path: "/site/material-expenses",
  },
];

export default function MaterialsOverviewPage() {
  const theme = useTheme();
  const router = useRouter();
  const { selectedSite } = useSite();
  const summary = useMaterialWorkflowSummary(selectedSite?.id);

  const [guideExpanded, setGuideExpanded] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(GUIDE_STORAGE_KEY);
      if (saved !== null) {
        setGuideExpanded(saved !== "true"); // stored as "collapsed = true"
      }
    }
  }, []);

  const handleGuideToggle = () => {
    const newState = !guideExpanded;
    setGuideExpanded(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(GUIDE_STORAGE_KEY, String(!newState));
    }
  };

  if (!selectedSite) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">
          Please select a site to view materials overview.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Materials Overview"
        subtitle={`Material procurement workflow for ${selectedSite.name}`}
      />

      {/* Workflow Progress Bar - expanded mode */}
      <MaterialWorkflowBar currentStep="requests" expanded />

      {/* Actions Required */}
      {summary.isLoading ? (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[1, 2, 3].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
        </Grid>
      ) : summary.nextActions.length > 0 ? (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{ mb: 1.5, fontWeight: 600 }}
          >
            Actions Required
          </Typography>
          <Grid container spacing={2}>
            {summary.nextActions.map((action) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={action.label}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    borderLeft: `4px solid`,
                    borderLeftColor: `${PRIORITY_COLORS[action.priority]}.main`,
                    "&:hover": {
                      bgcolor: "action.hover",
                      cursor: "pointer",
                    },
                  }}
                  onClick={() => router.push(action.path)}
                >
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          color: `${PRIORITY_COLORS[action.priority]}.main`,
                          mt: 0.25,
                        }}
                      >
                        {ICON_MAP[action.icon] || <RequestIcon />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                          }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ flex: 1 }}
                          >
                            {action.label}
                          </Typography>
                          <Chip
                            label={action.count}
                            size="small"
                            color={PRIORITY_COLORS[action.priority]}
                            sx={{ height: 20, fontSize: "0.7rem" }}
                          />
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ lineHeight: 1.3 }}
                        >
                          {action.description}
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      size="small"
                      endIcon={<ArrowIcon sx={{ fontSize: 14 }} />}
                      sx={{
                        mt: 1,
                        fontSize: "0.7rem",
                        textTransform: "none",
                        p: 0,
                        minWidth: 0,
                      }}
                    >
                      Go to page
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : (
        <Card
          variant="outlined"
          sx={{ mb: 3, bgcolor: "success.50", borderColor: "success.200" }}
        >
          <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="body2" color="success.main" fontWeight={600}>
              All caught up! No pending actions in the material workflow.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Quick Start Guide */}
      <Card variant="outlined">
        <Box
          onClick={handleGuideToggle}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            p: 2,
            cursor: "pointer",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <HelpIcon sx={{ fontSize: 20, color: "info.main" }} />
          <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
            How Material Procurement Works
          </Typography>
          {guideExpanded ? (
            <ExpandLess sx={{ color: "text.secondary" }} />
          ) : (
            <ExpandMore sx={{ color: "text.secondary" }} />
          )}
        </Box>

        <Collapse in={guideExpanded}>
          <Box
            sx={{
              px: 2,
              pb: 2,
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          >
            {workflowGuideSteps.map((step, index) => (
              <Box
                key={step.number}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.5,
                  py: 1.5,
                  borderBottom:
                    index < workflowGuideSteps.length - 1
                      ? `1px solid ${theme.palette.divider}`
                      : "none",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                  borderRadius: 1,
                  px: 1,
                  mx: -1,
                }}
                onClick={() => router.push(step.path)}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                >
                  {step.number}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {step.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ lineHeight: 1.4 }}
                  >
                    {step.description}
                  </Typography>
                </Box>
                {step.icon}
              </Box>
            ))}

            {/* Branch explanation */}
            <Box
              sx={{
                mt: 1.5,
                p: 1.5,
                bgcolor: "info.50",
                borderRadius: 1,
                border: `1px solid`,
                borderColor: "info.200",
              }}
            >
              <Typography
                variant="caption"
                fontWeight={600}
                color="info.main"
                sx={{ display: "block", mb: 0.5 }}
              >
                Group Purchases (Inter-Site)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                When materials are purchased for multiple sites (group stock),
                after vendor settlement the purchase goes to{" "}
                <strong>Inter-Site Settlement</strong> where usage is tracked in{" "}
                <strong>Inventory</strong>. Once the batch is fully used, costs
                are allocated to each site&apos;s <strong>Material Expenses</strong>.
              </Typography>
            </Box>
          </Box>
        </Collapse>
      </Card>
    </Box>
  );
}
