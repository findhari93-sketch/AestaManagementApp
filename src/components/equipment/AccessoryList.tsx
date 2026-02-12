"use client";

import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Paper,
  Skeleton,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Extension as ExtensionIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { useEquipmentAccessories } from "@/hooks/queries/useEquipment";
import {
  Equipment,
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUS_COLORS,
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_CONDITION_COLORS,
} from "@/types/equipment.types";

interface AccessoryListProps {
  parentEquipmentId: string;
  onViewAccessory?: (accessory: Equipment) => void;
}

export default function AccessoryList({ parentEquipmentId, onViewAccessory }: AccessoryListProps) {
  const { data: accessories, isLoading } = useEquipmentAccessories(parentEquipmentId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[1, 2].map((i) => (
          <Skeleton key={i} variant="rectangular" height={60} />
        ))}
      </Box>
    );
  }

  if (!accessories || accessories.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
        <ExtensionIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.secondary">No accessories linked</Typography>
        <Typography variant="caption" color="text.secondary">
          Create equipment with this as the parent to link accessories
        </Typography>
      </Paper>
    );
  }

  return (
    <List disablePadding>
      {accessories.map((accessory) => (
        <AccessoryItem
          key={accessory.id}
          accessory={accessory}
          onView={onViewAccessory}
        />
      ))}
    </List>
  );
}

interface AccessoryItemProps {
  accessory: Equipment;
  onView?: (accessory: Equipment) => void;
}

function AccessoryItem({ accessory, onView }: AccessoryItemProps) {
  return (
    <ListItem
      sx={{
        bgcolor: "grey.50",
        borderRadius: 1,
        mb: 1,
        "&:last-child": { mb: 0 },
      }}
      secondaryAction={
        onView ? (
          <Tooltip title="View Details">
            <IconButton
              edge="end"
              size="small"
              onClick={() => onView(accessory)}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null
      }
    >
      <ListItemAvatar>
        <Avatar
          src={accessory.primary_photo_url || undefined}
          sx={{ bgcolor: "primary.light" }}
        >
          <ExtensionIcon />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primaryTypographyProps={{ component: "div" }}
        secondaryTypographyProps={{ component: "div" }}
        primary={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle2">{accessory.equipment_code}</Typography>
            <Typography variant="body2" color="text.secondary">
              {accessory.name}
            </Typography>
          </Box>
        }
        secondary={
          <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
            <Chip
              label={EQUIPMENT_STATUS_LABELS[accessory.status]}
              color={EQUIPMENT_STATUS_COLORS[accessory.status]}
              size="small"
              sx={{ height: 20, fontSize: "0.7rem" }}
            />
            {accessory.condition && (
              <Chip
                label={EQUIPMENT_CONDITION_LABELS[accessory.condition]}
                color={EQUIPMENT_CONDITION_COLORS[accessory.condition]}
                size="small"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
            )}
          </Box>
        }
      />
    </ListItem>
  );
}
