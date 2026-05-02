"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Add as AddIcon,
  ChevronRight as ChevronRightIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  DeleteOutline as DeleteIcon,
} from "@mui/icons-material";
import type {
  ContractActivity,
  ContractReconciliation,
  Trade,
  TradeContract,
} from "@/types/trade.types";

interface TradeCardProps {
  trade: Trade;
  /** Map<subcontractId, ContractReconciliation> from useSiteTradeReconciliations. */
  reconciliations?: Map<string, ContractReconciliation>;
  /** Map<subcontractId, ContractActivity> from useSiteTradeActivity. */
  activity?: Map<string, ContractActivity>;
  onContractClick: (contractId: string) => void;
  onAddClick: (tradeCategoryId: string) => void;
  onContractView?: (contractId: string) => void;
  onContractDelete?: (contractId: string) => void;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    amount
  );
}

function contractLabel(c: TradeContract): string {
  if (c.isInHouse) return "In-house";
  return c.mesthriOrSpecialistName ?? c.title;
}

interface ContractRowProps {
  contract: TradeContract;
  reconciliation?: ContractReconciliation;
  activity?: ContractActivity;
  onClick: () => void;
  onView?: () => void;
  onDelete?: () => void;
}

function ContractRow({
  contract,
  reconciliation,
  activity,
  onClick,
  onView,
  onDelete,
}: ContractRowProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(menuAnchor);

  const quoted = reconciliation?.quotedAmount ?? contract.totalValue ?? 0;
  const paid = reconciliation?.amountPaid ?? 0;
  const balance = quoted - paid;
  const days =
    contract.laborTrackingMode === "mesthri_only"
      ? activity?.paymentDays ?? 0
      : activity?.attendanceDays ?? 0;
  const dayLabel =
    contract.laborTrackingMode === "mesthri_only"
      ? "payment days"
      : "days worked";

  // Variance traffic light: only meaningful when quoted > 0
  const variancePct =
    quoted > 0 ? Math.round(((paid - quoted) / quoted) * 100) : null;
  let varianceColor: "success.main" | "warning.main" | "error.main" =
    "success.main";
  if (variancePct !== null) {
    if (variancePct > 20) varianceColor = "error.main";
    else if (variancePct > 0) varianceColor = "warning.main";
  }

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        p: 1.25,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        position: "relative",
        cursor: "pointer",
        transition: "background-color 120ms",
        "&:hover": { bgcolor: "action.hover" },
      }}
      onClick={onClick}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {contractLabel(contract)}
          </Typography>
          {!contract.isInHouse && contract.title && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {contract.title}
            </Typography>
          )}
        </Box>
        {(onView || onDelete) && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(e.currentTarget);
            }}
            aria-label="contract actions"
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
        <ChevronRightIcon
          sx={{ color: "text.secondary", alignSelf: "center" }}
          fontSize="small"
        />
      </Stack>

      {quoted > 0 && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" component="div">
              Quoted
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              ₹{formatINR(quoted)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" component="div">
              Paid
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              ₹{formatINR(paid)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" component="div">
              Balance
            </Typography>
            <Typography variant="body2" fontWeight={500} sx={{ color: varianceColor }}>
              ₹{formatINR(Math.abs(balance))}
              {balance < 0 ? " over" : ""}
            </Typography>
          </Box>
          {days > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" component="div">
                {dayLabel}
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {days}
              </Typography>
            </Box>
          )}
        </Stack>
      )}

      {quoted === 0 && paid > 0 && (
        <Typography variant="caption" color="text.secondary">
          ₹{formatINR(paid)} paid · {days > 0 ? `${days} ${dayLabel}` : "no quote set"}
        </Typography>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={open}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        {onView && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onView();
            }}
          >
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Open in Subcontracts page</ListItemText>
          </MenuItem>
        )}
        {onDelete && [
          <Divider key="div" />,
          <MenuItem
            key="del"
            onClick={() => {
              setMenuAnchor(null);
              onDelete();
            }}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: "error.main" }} />
            </ListItemIcon>
            <ListItemText>Delete contract</ListItemText>
          </MenuItem>,
        ]}
      </Menu>
    </Box>
  );
}

export function TradeCard({
  trade,
  reconciliations,
  activity,
  onContractClick,
  onAddClick,
  onContractView,
  onContractDelete,
}: TradeCardProps) {
  const { category, contracts } = trade;
  const hasContracts = contracts.length > 0;

  return (
    <Card
      variant="outlined"
      sx={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <CardContent
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            {category.name}
          </Typography>
          {!category.isActive && (
            <Chip
              label="Inactive"
              size="small"
              variant="outlined"
              color="default"
            />
          )}
        </Box>

        {hasContracts ? (
          <Stack spacing={1}>
            {contracts.map((c) => (
              <ContractRow
                key={c.id}
                contract={c}
                reconciliation={reconciliations?.get(c.id)}
                activity={activity?.get(c.id)}
                onClick={() => onContractClick(c.id)}
                onView={onContractView ? () => onContractView(c.id) : undefined}
                onDelete={
                  onContractDelete && !c.isInHouse
                    ? () => onContractDelete(c.id)
                    : undefined
                }
              />
            ))}
          </Stack>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No contracts yet
            </Typography>
          </Box>
        )}

        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={() => onAddClick(category.id)}
          sx={{ alignSelf: "flex-start", mt: "auto" }}
        >
          Add contract
        </Button>
      </CardContent>
    </Card>
  );
}
