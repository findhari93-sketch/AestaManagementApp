"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

interface LaborRole {
  id: string;
  name: string;
  default_daily_rate: number;
  is_market_role: boolean;
}

interface MarketLaborerGroup {
  id: string;
  roleId: string;
  roleName: string;
  count: number;
  rate: number;
  dayUnits: number;
}

interface MarketLaborerDialogProps {
  open: boolean;
  onClose: () => void;
  laborRoles: LaborRole[];
  onConfirm: (groups: MarketLaborerGroup[]) => void;
  defaultTimes: {
    inTime: string;
    outTime: string;
    lunchOut: string;
    lunchIn: string;
  };
}

const DAY_UNIT_OPTIONS = [
  { value: 0.5, label: "½" },
  { value: 1, label: "1" },
  { value: 1.5, label: "1½" },
  { value: 2, label: "2" },
  { value: 2.5, label: "2½" },
];

export default function MarketLaborerDialog({
  open,
  onClose,
  laborRoles,
  onConfirm,
}: MarketLaborerDialogProps) {
  const [groups, setGroups] = useState<MarketLaborerGroup[]>([]);
  const [globalDayUnits, setGlobalDayUnits] = useState<number>(1);

  // Initialize with one empty group when dialog opens
  useEffect(() => {
    if (open && laborRoles.length > 0) {
      // Create initial group with first available role
      const role = laborRoles[0];
      setGroups([{
        id: `group-${Date.now()}-${Math.random()}`,
        roleId: role.id,
        roleName: role.name,
        count: 1,
        rate: role.default_daily_rate,
        dayUnits: 1,
      }]);
      setGlobalDayUnits(1);
    }
  }, [open, laborRoles]);

  const createNewGroup = (): MarketLaborerGroup => {
    // Find first unused role
    const usedRoles = groups.map((g) => g.roleId);
    const unusedRole = laborRoles.find((r) => !usedRoles.includes(r.id));
    const role = unusedRole || laborRoles[0];

    return {
      id: `group-${Date.now()}-${Math.random()}`,
      roleId: role.id,
      roleName: role.name,
      count: 1,
      rate: role.default_daily_rate,
      dayUnits: globalDayUnits,
    };
  };

  const handleAddGroup = () => {
    setGroups((prev) => [...prev, createNewGroup()]);
  };

  const handleRemoveGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const handleGroupChange = (
    groupId: string,
    field: keyof MarketLaborerGroup,
    value: string | number
  ) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;

        if (field === "roleId") {
          const role = laborRoles.find((r) => r.id === value);
          return {
            ...g,
            roleId: value as string,
            roleName: role?.name || "",
            rate: role?.default_daily_rate || g.rate,
          };
        }

        return { ...g, [field]: value };
      })
    );
  };

  const handleGlobalDayUnitsChange = (value: number) => {
    setGlobalDayUnits(value);
    // Apply to all groups
    setGroups((prev) => prev.map((g) => ({ ...g, dayUnits: value })));
  };

  const getTotalCount = () => groups.reduce((acc, g) => acc + g.count, 0);

  // Calculate total cost for a group
  const getGroupTotal = (group: MarketLaborerGroup) =>
    group.rate * group.count * group.dayUnits;

  // Calculate grand total for all groups
  const getGrandTotal = () =>
    groups.reduce((acc, g) => acc + getGroupTotal(g), 0);

  const handleConfirm = () => {
    // Filter out groups with 0 count
    const validGroups = groups.filter((g) => g.count > 0);
    if (validGroups.length > 0) {
      onConfirm(validGroups);
    }
    onClose();
  };

  const totalCount = getTotalCount();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { maxHeight: "80vh" },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
        }}
      >
        <Typography variant="h6" component="span" fontWeight={600}>
          Add Market Laborers
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Global Work Day Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Work Day (for all groups)
          </Typography>
          <ToggleButtonGroup
            value={globalDayUnits}
            exclusive
            onChange={(_, value) => value !== null && handleGlobalDayUnitsChange(value)}
            size="small"
            fullWidth
          >
            {DAY_UNIT_OPTIONS.map((opt) => (
              <ToggleButton key={opt.value} value={opt.value}>
                {opt.label} Day
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Groups */}
        {groups.map((group, index) => (
          <Box
            key={group.id}
            sx={{
              mb: 2,
              p: 2,
              bgcolor: "warning.50",
              borderRadius: 2,
              border: 1,
              borderColor: "warning.200",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1.5,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Group {index + 1}
              </Typography>
              {groups.length > 1 && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleRemoveGroup(group.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>

            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              {/* Role Select */}
              <FormControl sx={{ flex: 2 }} size="small">
                <InputLabel>Role</InputLabel>
                <Select
                  value={group.roleId}
                  label="Role"
                  onChange={(e) =>
                    handleGroupChange(group.id, "roleId", e.target.value)
                  }
                >
                  {laborRoles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Count */}
              <TextField
                sx={{ flex: 1 }}
                size="small"
                label="Count"
                type="number"
                value={group.count}
                onChange={(e) =>
                  handleGroupChange(
                    group.id,
                    "count",
                    Math.max(0, parseInt(e.target.value) || 0)
                  )
                }
                slotProps={{
                  htmlInput: { min: 0, max: 50 },
                }}
              />

              {/* Rate per day */}
              <TextField
                sx={{ flex: 1 }}
                size="small"
                label="Rate/Day"
                type="number"
                value={group.rate}
                onChange={(e) =>
                  handleGroupChange(
                    group.id,
                    "rate",
                    Math.max(0, parseInt(e.target.value) || 0)
                  )
                }
                slotProps={{
                  htmlInput: { min: 0 },
                  input: { startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>₹</Typography> },
                }}
              />
            </Box>

            {/* Total cost display for this group */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                mt: 1.5,
                pt: 1,
                borderTop: "1px dashed",
                borderColor: "warning.300",
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                {group.count} × ₹{group.rate.toLocaleString()} × {group.dayUnits} day{group.dayUnits !== 1 ? "s" : ""} =
              </Typography>
              <Typography variant="subtitle2" color="warning.dark" fontWeight={600}>
                ₹{getGroupTotal(group).toLocaleString()}
              </Typography>
            </Box>
          </Box>
        ))}

        {/* Add Another Group Button */}
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddGroup}
          sx={{ mt: 1 }}
        >
          Add Another Group
        </Button>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Box>
          {totalCount > 0 && (
            <Typography variant="subtitle1" fontWeight={600} color="warning.dark">
              Total: ₹{getGrandTotal().toLocaleString()}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirm}
            disabled={totalCount === 0}
          >
            Add {totalCount} Laborer{totalCount !== 1 ? "s" : ""}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
