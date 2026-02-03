"use client";

import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  Skeleton,
} from "@mui/material";
import {
  Build as BuildIcon,
  Receipt as ReceiptIcon,
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import { useEquipmentMaintenance } from "@/hooks/queries/useEquipment";
import {
  EquipmentMaintenanceWithDetails,
  MAINTENANCE_TYPE_LABELS,
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_CONDITION_COLORS,
} from "@/types/equipment.types";
import { format } from "date-fns";

interface MaintenanceHistoryProps {
  equipmentId: string;
}

export default function MaintenanceHistory({ equipmentId }: MaintenanceHistoryProps) {
  const { data: maintenanceRecords, isLoading } = useEquipmentMaintenance(equipmentId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={80} />
        ))}
      </Box>
    );
  }

  if (!maintenanceRecords || maintenanceRecords.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
        <BuildIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.secondary">No maintenance records yet</Typography>
      </Paper>
    );
  }

  return (
    <List disablePadding>
      {maintenanceRecords.map((record, index) => (
        <Box key={record.id}>
          <MaintenanceRecordItem record={record} />
          {index < maintenanceRecords.length - 1 && <Divider />}
        </Box>
      ))}
    </List>
  );
}

interface MaintenanceRecordItemProps {
  record: EquipmentMaintenanceWithDetails;
}

function MaintenanceRecordItem({ record }: MaintenanceRecordItemProps) {
  const formattedDate = format(new Date(record.maintenance_date), "MMM d, yyyy");

  return (
    <ListItem
      alignItems="flex-start"
      sx={{ px: 0 }}
      secondaryAction={
        record.receipt_url ? (
          <Tooltip title="View Receipt">
            <IconButton
              edge="end"
              size="small"
              onClick={() => window.open(record.receipt_url!, "_blank")}
            >
              <ReceiptIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null
      }
    >
      <ListItemText
        primaryTypographyProps={{ component: "div" }}
        secondaryTypographyProps={{ component: "div" }}
        primary={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle2">{formattedDate}</Typography>
            <Chip
              label={MAINTENANCE_TYPE_LABELS[record.maintenance_type]}
              size="small"
              variant="outlined"
              color={
                record.maintenance_type === "repair"
                  ? "error"
                  : record.maintenance_type === "overhaul"
                  ? "warning"
                  : "default"
              }
            />
          </Box>
        }
        secondary={
          <Box sx={{ mt: 1 }}>
            {record.description && (
              <Typography variant="body2" color="text.primary" sx={{ mb: 1 }}>
                {record.description}
              </Typography>
            )}

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 1 }}>
              {record.condition_before && record.condition_after && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Condition:
                  </Typography>
                  <Chip
                    label={EQUIPMENT_CONDITION_LABELS[record.condition_before]}
                    size="small"
                    color={EQUIPMENT_CONDITION_COLORS[record.condition_before]}
                    sx={{ height: 20, fontSize: "0.7rem" }}
                  />
                  <Typography variant="caption" color="text.secondary">→</Typography>
                  <Chip
                    label={EQUIPMENT_CONDITION_LABELS[record.condition_after]}
                    size="small"
                    color={EQUIPMENT_CONDITION_COLORS[record.condition_after]}
                    sx={{ height: 20, fontSize: "0.7rem" }}
                  />
                </Box>
              )}

              {record.cost != null && record.cost > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Cost: ₹{record.cost.toLocaleString()}
                </Typography>
              )}

              {record.vendor && (
                <Typography variant="caption" color="text.secondary">
                  Vendor: {record.vendor.name}
                </Typography>
              )}
            </Box>

            {record.notes && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                {record.notes}
              </Typography>
            )}

            {record.next_maintenance_date && (
              <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5 }}>
                Next maintenance: {format(new Date(record.next_maintenance_date), "MMM d, yyyy")}
              </Typography>
            )}
          </Box>
        }
      />
    </ListItem>
  );
}
