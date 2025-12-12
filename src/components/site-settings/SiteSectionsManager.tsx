"use client";

import React, { memo, useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  Paper,
  Skeleton,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarOutline as StarOutlineIcon,
  CheckCircle as CheckCircleIcon,
  PlayCircleOutline as InProgressIcon,
  RadioButtonUnchecked as NotStartedIcon,
  Construction as ConstructionIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AuditAvatarGroup from "../common/AuditAvatarGroup";

interface ConstructionPhase {
  id: string;
  name: string;
  sequence_order: number;
}

interface BuildingSection {
  id: string;
  name: string;
  description: string | null;
  status: "not_started" | "in_progress" | "completed";
  sequence_order: number;
  created_at: string;
  updated_at: string;
  construction_phase_id: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  // Joined user data for display
  created_by_user?: { name: string; avatar_url: string | null } | null;
  updated_by_user?: { name: string; avatar_url: string | null } | null;
}

interface SiteSectionsManagerProps {
  siteId: string;
  defaultSectionId: string | null;
  onDefaultChange?: () => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />;
    case "in_progress":
      return <InProgressIcon sx={{ fontSize: 18, color: "primary.main" }} />;
    default:
      return <NotStartedIcon sx={{ fontSize: 18, color: "text.disabled" }} />;
  }
};

const getStatusColor = (status: string): "success" | "primary" | "default" => {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
      return "primary";
    default:
      return "default";
  }
};

const SiteSectionsManager = memo(function SiteSectionsManager({
  siteId,
  defaultSectionId,
  onDefaultChange,
}: SiteSectionsManagerProps) {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === "admin";

  const [phases, setPhases] = useState<ConstructionPhase[]>([]);
  const [sections, setSections] = useState<BuildingSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | false>(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingSection, setEditingSection] = useState<BuildingSection | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<"not_started" | "in_progress" | "completed">("not_started");
  const [formPhaseId, setFormPhaseId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSection, setDeletingSection] = useState<BuildingSection | null>(null);

  const fetchData = useCallback(async () => {
    if (!siteId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch construction phases
      const { data: phasesData, error: phasesError } = await supabase
        .from("construction_phases")
        .select("id, name, sequence_order")
        .eq("is_active", true)
        .order("sequence_order");

      if (phasesError) throw phasesError;
      setPhases(phasesData || []);

      // Expand first phase by default
      if (phasesData && phasesData.length > 0 && !expandedPhase) {
        setExpandedPhase(phasesData[0].id);
      }

      // Fetch sections with audit info
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("building_sections")
        .select("id, name, description, status, sequence_order, construction_phase_id, created_at, updated_at, created_by, updated_by")
        .eq("site_id", siteId)
        .order("sequence_order");

      if (sectionsError) throw sectionsError;

      // Fetch user names for audit display
      const userIds = new Set<string>();
      (sectionsData || []).forEach((s: any) => {
        if (s.created_by) userIds.add(s.created_by);
        if (s.updated_by) userIds.add(s.updated_by);
      });

      let usersMap: Record<string, { name: string; avatar_url: string | null }> = {};
      if (userIds.size > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .in("id", Array.from(userIds));

        usersData?.forEach((u: any) => {
          usersMap[u.id] = { name: u.name, avatar_url: u.avatar_url };
        });
      }

      const mappedSections: BuildingSection[] = (sectionsData || []).map((s: any) => ({
        ...s,
        status: s.status as "not_started" | "in_progress" | "completed",
        construction_phase_id: s.construction_phase_id || null,
        created_by_user: s.created_by ? usersMap[s.created_by] || null : null,
        updated_by_user: s.updated_by ? usersMap[s.updated_by] || null : null,
      }));

      setSections(mappedSections);
    } catch (err: any) {
      console.error("Error fetching sections data:", err?.message || err?.code || JSON.stringify(err) || err);
      setError("Failed to load sections");
    } finally {
      setLoading(false);
    }
  }, [siteId, expandedPhase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAccordionChange = (phaseId: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedPhase(isExpanded ? phaseId : false);
  };

  const handleAddSection = (phaseId: string | null) => {
    setDialogMode("add");
    setEditingSection(null);
    setSelectedPhaseId(phaseId);
    setFormName("");
    setFormDescription("");
    setFormStatus("not_started");
    setFormPhaseId(phaseId);
    setDialogOpen(true);
  };

  const handleEditSection = (section: BuildingSection) => {
    setDialogMode("edit");
    setEditingSection(section);
    setFormName(section.name);
    setFormDescription(section.description || "");
    setFormStatus(section.status);
    setFormPhaseId(section.construction_phase_id || null);
    setDialogOpen(true);
  };

  const handleDeleteClick = (section: BuildingSection) => {
    setDeletingSection(section);
    setDeleteDialogOpen(true);
  };

  const handleSaveSection = async () => {
    if (!formName.trim() || !siteId) return;

    setSaving(true);
    try {
      const supabase = createClient();

      const sectionData = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        status: formStatus,
        construction_phase_id: formPhaseId,
        site_id: siteId,
      };

      if (dialogMode === "add") {
        // Get max sequence order
        const maxOrder = sections.length > 0
          ? Math.max(...sections.map((s) => s.sequence_order))
          : 0;

        const { error } = await supabase
          .from("building_sections")
          .insert({
            ...sectionData,
            sequence_order: maxOrder + 1,
            created_by: userProfile?.id || null,
          });

        if (error) throw error;
      } else if (editingSection) {
        const { error } = await supabase
          .from("building_sections")
          .update({
            ...sectionData,
            updated_by: userProfile?.id || null,
          })
          .eq("id", editingSection.id);

        if (error) throw error;
      }

      await fetchData();
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Error saving section:", err?.message || err?.code || JSON.stringify(err) || err);
      setError("Failed to save section");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!deletingSection) return;

    setSaving(true);
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("building_sections")
        .delete()
        .eq("id", deletingSection.id);

      if (error) throw error;

      await fetchData();
      setDeleteDialogOpen(false);
      setDeletingSection(null);
    } catch (err: any) {
      console.error("Error deleting section:", err?.message || err?.code || JSON.stringify(err) || err);
      setError("Failed to delete section");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (sectionId: string) => {
    if (!isAdmin || !siteId) return;

    try {
      const supabase = createClient();

      // Note: Using type assertion until migration is run and types regenerated
      const { error } = await (supabase
        .from("sites")
        .update({ default_section_id: sectionId } as any)
        .eq("id", siteId));

      if (error) throw error;

      onDefaultChange?.();
    } catch (err) {
      console.error("Error setting default section:", err);
      setError("Failed to set default section");
    }
  };

  const getSectionsForPhase = (phaseId: string | null) => {
    return sections.filter((s) => s.construction_phase_id === phaseId);
  };

  const uncategorizedSections = sections.filter((s) => !s.construction_phase_id);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={60} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Phases with sections */}
      {phases.map((phase) => {
        const phaseSections = getSectionsForPhase(phase.id);
        return (
          <Accordion
            key={phase.id}
            expanded={expandedPhase === phase.id}
            onChange={handleAccordionChange(phase.id)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                <ConstructionIcon color="primary" />
                <Typography fontWeight={600} sx={{ flexGrow: 1 }}>
                  {phase.name}
                </Typography>
                <Chip
                  label={`${phaseSections.length} sections`}
                  size="small"
                  color="default"
                  sx={{ mr: 1 }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <List dense disablePadding>
                {phaseSections.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary={
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                          No sections in this phase
                        </Typography>
                      }
                    />
                  </ListItem>
                ) : (
                  phaseSections.map((section) => (
                    <SectionListItem
                      key={section.id}
                      section={section}
                      isDefault={section.id === defaultSectionId}
                      isAdmin={isAdmin}
                      onEdit={() => handleEditSection(section)}
                      onDelete={() => handleDeleteClick(section)}
                      onSetDefault={() => handleSetDefault(section.id)}
                    />
                  ))
                )}
              </List>
              <Box sx={{ p: 1, borderTop: "1px solid", borderColor: "divider" }}>
                <Button
                  startIcon={<AddIcon />}
                  size="small"
                  onClick={() => handleAddSection(phase.id)}
                  sx={{ textTransform: "none" }}
                >
                  Add Section to {phase.name}
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* Uncategorized sections */}
      {(uncategorizedSections.length > 0 || phases.length === 0) && (
        <Paper variant="outlined" sx={{ mt: 2 }}>
          <Box sx={{ p: 2, bgcolor: "action.hover" }}>
            <Typography fontWeight={600} color="text.secondary">
              Uncategorized Sections
            </Typography>
          </Box>
          <List dense disablePadding>
            {uncategorizedSections.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary={
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                      No uncategorized sections
                    </Typography>
                  }
                />
              </ListItem>
            ) : (
              uncategorizedSections.map((section) => (
                <SectionListItem
                  key={section.id}
                  section={section}
                  isDefault={section.id === defaultSectionId}
                  isAdmin={isAdmin}
                  onEdit={() => handleEditSection(section)}
                  onDelete={() => handleDeleteClick(section)}
                  onSetDefault={() => handleSetDefault(section.id)}
                />
              ))
            )}
          </List>
          <Box sx={{ p: 1, borderTop: "1px solid", borderColor: "divider" }}>
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => handleAddSection(null)}
              sx={{ textTransform: "none" }}
            >
              Add Uncategorized Section
            </Button>
          </Box>
        </Paper>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === "add" ? "Add New Section" : "Edit Section"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Section Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as typeof formStatus)}
                label="Status"
              >
                <MenuItem value="not_started">Not Started</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Construction Phase</InputLabel>
              <Select
                value={formPhaseId || ""}
                onChange={(e) => setFormPhaseId(e.target.value || null)}
                label="Construction Phase"
              >
                <MenuItem value="">
                  <em>Uncategorized</em>
                </MenuItem>
                {phases.map((phase) => (
                  <MenuItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveSection}
            variant="contained"
            disabled={!formName.trim() || saving}
          >
            {saving ? <CircularProgress size={20} /> : dialogMode === "add" ? "Add" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Section?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingSection?.name}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteSection}
            color="error"
            variant="contained"
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

// Section List Item Component
interface SectionListItemProps {
  section: BuildingSection;
  isDefault: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

const SectionListItem = memo(function SectionListItem({
  section,
  isDefault,
  isAdmin,
  onEdit,
  onDelete,
  onSetDefault,
}: SectionListItemProps) {
  return (
    <ListItem
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: isDefault ? "primary.50" : "transparent",
        "&:last-child": { borderBottom: "none" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 1 }}>
        {getStatusIcon(section.status)}
      </Box>
      <ListItemText
        primary={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isDefault && (
              <StarIcon sx={{ fontSize: 16, color: "#FFD700" }} />
            )}
            <Typography
              variant="body2"
              fontWeight={isDefault ? 600 : 400}
              sx={{
                textDecoration: section.status === "completed" ? "line-through" : "none",
              }}
            >
              {section.name}
            </Typography>
            <Chip
              label={section.status.replace("_", " ")}
              size="small"
              color={getStatusColor(section.status)}
              variant={section.status === "not_started" ? "outlined" : "filled"}
              sx={{ height: 20, fontSize: "0.65rem", textTransform: "capitalize" }}
            />
          </Box>
        }
        secondary={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
            {section.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                {section.description}
              </Typography>
            )}
            <AuditAvatarGroup
              createdByName={section.created_by_user?.name}
              createdByAvatar={section.created_by_user?.avatar_url}
              createdAt={section.created_at}
              updatedByName={section.updated_by_user?.name}
              updatedByAvatar={section.updated_by_user?.avatar_url}
              updatedAt={section.updated_at}
              size="small"
              compact
            />
          </Box>
        }
        secondaryTypographyProps={{ component: "div" }}
      />
      <ListItemSecondaryAction>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {isAdmin && !isDefault && (
            <Tooltip title="Set as Default">
              <IconButton size="small" onClick={onSetDefault}>
                <StarOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <IconButton size="small" onClick={onEdit}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={onDelete} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </ListItemSecondaryAction>
    </ListItem>
  );
});

export default SiteSectionsManager;
