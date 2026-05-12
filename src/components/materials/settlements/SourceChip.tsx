"use client";

import { Chip, Tooltip } from "@mui/material";
import {
  Receipt as POIcon,
  AutoAwesome as AIIcon,
  EditNote as DirectIcon,
  Payment as AdvanceIcon,
  SwapHoriz as InterSiteIcon,
} from "@mui/icons-material";
import type {
  MaterialPurchaseExpenseWithDetails,
  PurchaseOrderWithDetails,
} from "@/types/material.types";
import { getSourceKind, type SettlementItem } from "./settlementClassifiers";

interface Props {
  item: SettlementItem;
  size?: "small" | "medium";
}

export default function SourceChip({ item, size = "small" }: Props) {
  const kind = getSourceKind(item);

  if (kind === "po") {
    const purchase = item as MaterialPurchaseExpenseWithDetails;
    const poNumber = purchase.purchase_order?.po_number || "PO";
    return (
      <Tooltip title="Linked to Purchase Order">
        <Chip
          icon={<POIcon sx={{ fontSize: 14 }} />}
          label={poNumber}
          size={size}
          color="primary"
          variant="outlined"
          sx={{ fontFamily: "monospace", fontSize: "0.72rem" }}
        />
      </Tooltip>
    );
  }

  if (kind === "advance") {
    const po = item as PurchaseOrderWithDetails;
    return (
      <Tooltip title="Advance payment for PO (before delivery)">
        <Chip
          icon={<AdvanceIcon sx={{ fontSize: 14 }} />}
          label={`${po.po_number || "PO"} · Advance`}
          size={size}
          color="warning"
          variant="outlined"
          sx={{ fontFamily: "monospace", fontSize: "0.72rem" }}
        />
      </Tooltip>
    );
  }

  if (kind === "intersite") {
    const purchase = item as MaterialPurchaseExpenseWithDetails;
    return (
      <Tooltip title={`Inter-site allocation from batch ${purchase.original_batch_code || ""}`}>
        <Chip
          icon={<InterSiteIcon sx={{ fontSize: 14 }} />}
          label="Inter-Site"
          size={size}
          color="info"
          variant="outlined"
          sx={{ fontSize: "0.72rem" }}
        />
      </Tooltip>
    );
  }

  if (kind === "ai_bill") {
    return (
      <Tooltip title="Bill ingested via AI — no linked PO">
        <Chip
          icon={<AIIcon sx={{ fontSize: 14 }} />}
          label="AI Bill"
          size={size}
          color="secondary"
          variant="outlined"
          sx={{ fontSize: "0.72rem" }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title="Direct purchase entry (no PO)">
      <Chip
        icon={<DirectIcon sx={{ fontSize: 14 }} />}
        label="Direct"
        size={size}
        variant="outlined"
        sx={{ fontSize: "0.72rem" }}
      />
    </Tooltip>
  );
}
