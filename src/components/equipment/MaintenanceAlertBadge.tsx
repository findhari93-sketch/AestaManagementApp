"use client";

import { Chip, Tooltip, Badge, Box } from "@mui/material";
import {
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
} from "@mui/icons-material";
import type { EquipmentWithDetails } from "@/types/equipment.types";

interface MaintenanceAlertBadgeProps {
  equipment: EquipmentWithDetails;
  showLabel?: boolean;
}

export default function MaintenanceAlertBadge({
  equipment,
  showLabel = false,
}: MaintenanceAlertBadgeProps) {
  const { maintenance_status, next_maintenance_date, last_maintenance_date } =
    equipment;

  if (!maintenance_status || maintenance_status === "na") {
    return null;
  }

  const getConfig = () => {
    switch (maintenance_status) {
      case "overdue":
        return {
          color: "error" as const,
          icon: <WarningIcon fontSize="small" />,
          label: "Overdue",
          tooltip: `Maintenance overdue since ${next_maintenance_date}`,
        };
      case "due_soon":
        return {
          color: "warning" as const,
          icon: <ScheduleIcon fontSize="small" />,
          label: "Due Soon",
          tooltip: `Maintenance due on ${next_maintenance_date}`,
        };
      case "ok":
        return {
          color: "success" as const,
          icon: <CheckIcon fontSize="small" />,
          label: "OK",
          tooltip: last_maintenance_date
            ? `Last maintained: ${last_maintenance_date}`
            : "No maintenance recorded yet",
        };
      default:
        return null;
    }
  };

  const config = getConfig();
  if (!config) return null;

  if (showLabel) {
    return (
      <Tooltip title={config.tooltip}>
        <Chip
          icon={config.icon}
          label={config.label}
          color={config.color}
          size="small"
          variant={maintenance_status === "ok" ? "outlined" : "filled"}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={config.tooltip}>
      <Box
        sx={{
          display: "inline-flex",
          color: `${config.color}.main`,
          cursor: "pointer",
        }}
      >
        {config.icon}
      </Box>
    </Tooltip>
  );
}
