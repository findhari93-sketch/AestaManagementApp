"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider,
  Autocomplete,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Close as CloseIcon,
  Link as LinkIcon,
  Groups as GroupsIcon,
  Business as SiteIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useTeaShopAssignments,
  useAssignTeaShopToSite,
  useAssignTeaShopToGroup,
  useUnassignTeaShop,
  type CompanyTeaShopWithAssignments,
  type TeaShopSiteAssignment,
} from "@/hooks/queries/useCompanyTeaShops";
import { useSite } from "@/contexts/SiteContext";
import { useSiteGroups } from "@/hooks/queries/useSiteGroups";

interface TeaShopAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  teaShop: CompanyTeaShopWithAssignments | null;
}

type AssignmentType = "site" | "group";

export default function TeaShopAssignmentDialog({
  open,
  onClose,
  teaShop,
}: TeaShopAssignmentDialogProps) {
  const isMobile = useIsMobile();

  const { data: assignments = [], isLoading: loadingAssignments } = useTeaShopAssignments(teaShop?.id);
  const { sites } = useSite();
  const { data: siteGroups = [] } = useSiteGroups();

  const assignToSite = useAssignTeaShopToSite();
  const assignToGroup = useAssignTeaShopToGroup();
  const unassign = useUnassignTeaShop();

  const [error, setError] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("group");
  const [selectedSite, setSelectedSite] = useState<{ id: string; name: string } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string } | null>(null);

  // Filter out already assigned sites/groups
  const activeAssignments = assignments.filter((a) => a.is_active);
  const assignedSiteIds = activeAssignments.filter((a) => a.site_id).map((a) => a.site_id);
  const assignedGroupIds = activeAssignments.filter((a) => a.site_group_id).map((a) => a.site_group_id);

  const availableSites = (sites || []).filter((s) => !assignedSiteIds.includes(s.id) && s.status === "active");
  const availableGroups = siteGroups.filter((g) => !assignedGroupIds.includes(g.id));

  const handleAssign = async () => {
    if (!teaShop) return;

    try {
      setError("");
      if (assignmentType === "site" && selectedSite) {
        await assignToSite.mutateAsync({
          teaShopId: teaShop.id,
          siteId: selectedSite.id,
        });
        setSelectedSite(null);
      } else if (assignmentType === "group" && selectedGroup) {
        await assignToGroup.mutateAsync({
          teaShopId: teaShop.id,
          siteGroupId: selectedGroup.id,
        });
        setSelectedGroup(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to assign tea shop");
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    if (!confirm("Remove this assignment?")) return;

    try {
      setError("");
      await unassign.mutateAsync(assignmentId);
    } catch (err: any) {
      setError(err.message || "Failed to remove assignment");
    }
  };

  const isLoading = assignToSite.isPending || assignToGroup.isPending || unassign.isPending;

  if (!teaShop) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LinkIcon color="primary" />
            <Typography variant="h6">
              Assign Tea Shop
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {teaShop.name}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Current Assignments */}
        <Typography variant="subtitle2" gutterBottom>
          Current Assignments
        </Typography>

        {loadingAssignments ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : activeAssignments.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            This tea shop is not assigned to any site or group yet.
          </Alert>
        ) : (
          <List dense sx={{ mb: 2 }}>
            {activeAssignments.map((assignment) => (
              <ListItem key={assignment.id}>
                <ListItemIcon>
                  {assignment.site_group_id ? (
                    <GroupsIcon color="secondary" />
                  ) : (
                    <SiteIcon color="primary" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={assignment.site_group?.name || assignment.site?.name || "Unknown"}
                  secondary={assignment.site_group_id ? "Site Group" : "Individual Site"}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleUnassign(assignment.id)}
                    disabled={isLoading}
                    color="error"
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Add New Assignment */}
        <Typography variant="subtitle2" gutterBottom>
          Add New Assignment
        </Typography>

        <Box sx={{ mb: 2 }}>
          <ToggleButtonGroup
            value={assignmentType}
            exclusive
            onChange={(_, value) => value && setAssignmentType(value)}
            size="small"
            fullWidth
          >
            <ToggleButton value="group">
              <GroupsIcon sx={{ mr: 1 }} fontSize="small" />
              Site Group
            </ToggleButton>
            <ToggleButton value="site">
              <SiteIcon sx={{ mr: 1 }} fontSize="small" />
              Individual Site
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {assignmentType === "group" ? (
          <Box>
            <Autocomplete
              options={availableGroups}
              getOptionLabel={(option) => option.name}
              value={selectedGroup}
              onChange={(_, value) => setSelectedGroup(value)}
              renderInput={(params) => (
                <TextField {...params} label="Select Site Group" size="small" />
              )}
              renderOption={(props, option) => {
                const { key, ...rest } = props;
                return (
                  <li key={option.id} {...rest}>
                    <GroupsIcon fontSize="small" sx={{ mr: 1 }} color="secondary" />
                    {option.name}
                  </li>
                );
              }}
            />
            {availableGroups.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                All site groups already have tea shop assignments.
              </Typography>
            )}
            <Alert severity="info" sx={{ mt: 1 }} icon={<GroupsIcon />}>
              Assigning to a site group will make this tea shop available to ALL sites in that group.
            </Alert>
          </Box>
        ) : (
          <Box>
            <Autocomplete
              options={availableSites}
              getOptionLabel={(option) => option.name}
              value={selectedSite}
              onChange={(_, value) => setSelectedSite(value)}
              renderInput={(params) => (
                <TextField {...params} label="Select Site" size="small" />
              )}
              renderOption={(props, option) => {
                const { key, ...rest } = props;
                return (
                  <li key={option.id} {...rest}>
                    <SiteIcon fontSize="small" sx={{ mr: 1 }} color="primary" />
                    {option.name}
                  </li>
                );
              }}
            />
            {availableSites.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                All sites already have tea shop assignments.
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            size="small"
            startIcon={isLoading ? <CircularProgress size={16} /> : <AddIcon />}
            onClick={handleAssign}
            disabled={
              isLoading ||
              (assignmentType === "site" && !selectedSite) ||
              (assignmentType === "group" && !selectedGroup)
            }
          >
            Assign
          </Button>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
