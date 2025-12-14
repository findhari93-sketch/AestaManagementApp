"use client";

import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  LinearProgress,
} from "@mui/material";
import {
  Schedule as PendingIcon,
  Send as SentIcon,
  CheckCircle as PaidIcon,
  AccountBalance as ContractIcon,
  Receipt as ExpenseIcon,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import type { PaymentSummaryData } from "@/types/payment.types";

interface PaymentSummaryCardsProps {
  data: PaymentSummaryData;
  loading?: boolean;
}

export default function PaymentSummaryCards({
  data,
  loading = false,
}: PaymentSummaryCardsProps) {
  const [showSubcontracts, setShowSubcontracts] = useState(false);

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `Rs.${(amount / 100000).toFixed(1)}L`;
    }
    return `Rs.${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <Box sx={{ mb: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        {/* Daily/Market Pending */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              bgcolor: "warning.50",
              borderLeft: 4,
              borderColor: "warning.main",
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PendingIcon color="warning" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Daily/Market Pending
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600} color="warning.dark">
                {formatCurrency(data.dailyMarketPending)}
              </Typography>
              <Chip
                label={`${data.dailyMarketPendingCount} records`}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* In Progress (With Engineer) */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              bgcolor: "warning.50",
              borderLeft: 4,
              borderColor: "warning.dark",
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <SentIcon sx={{ color: "warning.dark" }} fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  In Progress (With Engineer)
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600} sx={{ color: "warning.dark" }}>
                {formatCurrency(data.dailyMarketSentToEngineer)}
              </Typography>
              <Chip
                label={`${data.dailyMarketSentToEngineerCount} records`}
                size="small"
                sx={{
                  mt: 1,
                  borderColor: "warning.dark",
                  color: "warning.dark",
                }}
                variant="outlined"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Contract Weekly Due */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              bgcolor: "error.50",
              borderLeft: 4,
              borderColor: "error.main",
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <ContractIcon color="error" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Contract Weekly Due
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600} color="error.dark">
                {formatCurrency(data.contractWeeklyDue)}
              </Typography>
              <Chip
                label={`${data.contractWeeklyDueLaborerCount} laborers`}
                size="small"
                color="error"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Total Paid */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              bgcolor: "success.50",
              borderLeft: 4,
              borderColor: "success.main",
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PaidIcon color="success" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Total Paid (Period)
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600} color="success.dark">
                {formatCurrency(
                  data.dailyMarketPaid + data.contractWeeklyPaid
                )}
              </Typography>
              <Chip
                label={`${data.dailyMarketPaidCount} records`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* By Subcontract Breakdown */}
      {data.bySubcontract.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
              }}
              onClick={() => setShowSubcontracts(!showSubcontracts)}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ContractIcon fontSize="small" color="action" />
                <Typography variant="subtitle2">By Subcontract</Typography>
                <Chip
                  label={data.bySubcontract.length}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <IconButton size="small">
                {showSubcontracts ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            <Collapse in={showSubcontracts}>
              <List dense sx={{ mt: 1 }}>
                {data.bySubcontract.map((sc, index) => (
                  <React.Fragment key={sc.subcontractId}>
                    {index > 0 && <Divider />}
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={sc.subcontractTitle}
                        secondary={
                          <Box
                            component="span"
                            sx={{
                              display: "flex",
                              gap: 2,
                              mt: 0.5,
                            }}
                          >
                            <Typography component="span" variant="caption" color="success.main">
                              Paid: {formatCurrency(sc.totalPaid)}
                            </Typography>
                            <Typography component="span" variant="caption" color="warning.main">
                              Due: {formatCurrency(sc.totalDue)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </Collapse>
          </CardContent>
        </Card>
      )}

      {/* Unlinked (Site Expenses) */}
      {data.unlinkedTotal > 0 && (
        <Card sx={{ mt: 2, bgcolor: "action.hover" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ExpenseIcon fontSize="small" color="action" />
              <Typography variant="subtitle2">
                Unlinked (Site Expenses)
              </Typography>
              <Chip
                label={`${data.unlinkedCount} records`}
                size="small"
                variant="outlined"
              />
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="subtitle1" fontWeight={600}>
                {formatCurrency(data.unlinkedTotal)}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Payments not linked to any subcontract - counted as project
              spending
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
