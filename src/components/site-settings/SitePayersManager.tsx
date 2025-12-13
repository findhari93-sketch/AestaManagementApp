"use client";

import React, { memo, useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Tooltip,
  Paper,
  Skeleton,
  Switch,
  FormControlLabel,
  Divider,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  ToggleOff as ToggleOffIcon,
  ToggleOn as ToggleOnIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SitePayer {
  id: string;
  site_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SitePayersManagerProps {
  siteId: string;
  onSettingChange?: () => void;
}

const SitePayersManager = memo(function SitePayersManager({
  siteId,
  onSettingChange,
}: SitePayersManagerProps) {
  const { userProfile } = useAuth();
  const canEdit = userProfile?.role === "admin" || userProfile?.role === "office";

  const [hasMultiplePayers, setHasMultiplePayers] = useState(false);
  const [payers, setPayers] = useState<SitePayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingPayer, setEditingPayer] = useState<SitePayer | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPayer, setDeletingPayer] = useState<SitePayer | null>(null);

  const fetchData = useCallback(async () => {
    if (!siteId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch site's multi-payer setting
      // Note: Using type assertion until migration is run and types regenerated
      const { data: siteData, error: siteError } = await supabase
        .from("sites")
        .select("*")
        .eq("id", siteId)
        .single();

      if (siteError) throw siteError;
      setHasMultiplePayers((siteData as any)?.has_multiple_payers || false);

      // Fetch payers for this site
      // Note: Using type assertion until migration is run and types regenerated
      const { data: payersData, error: payersError } = await (supabase as any)
        .from("site_payers")
        .select("*")
        .eq("site_id", siteId)
        .order("name");

      if (payersError) throw payersError;
      setPayers(payersData || []);
    } catch (err: any) {
      console.error("Error fetching payers data:", err?.message || err);
      setError("Failed to load payers");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleMultiplePayers = async () => {
    if (!canEdit) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const newValue = !hasMultiplePayers;

      // Note: Using type assertion until migration is run and types regenerated
      const { error } = await supabase
        .from("sites")
        .update({ has_multiple_payers: newValue } as any)
        .eq("id", siteId);

      if (error) throw error;

      setHasMultiplePayers(newValue);
      onSettingChange?.();
    } catch (err: any) {
      console.error("Error toggling multi-payer setting:", err?.message || err);
      setError("Failed to update setting");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayer = () => {
    setDialogMode("add");
    setEditingPayer(null);
    setFormName("");
    setFormPhone("");
    setFormNotes("");
    setDialogOpen(true);
  };

  const handleEditPayer = (payer: SitePayer) => {
    setDialogMode("edit");
    setEditingPayer(payer);
    setFormName(payer.name);
    setFormPhone(payer.phone || "");
    setFormNotes(payer.notes || "");
    setDialogOpen(true);
  };

  const handleDeleteClick = (payer: SitePayer) => {
    setDeletingPayer(payer);
    setDeleteDialogOpen(true);
  };

  const handleTogglePayerStatus = async (payer: SitePayer) => {
    if (!canEdit) return;

    try {
      const supabase = createClient();

      // Note: Using type assertion until migration is run and types regenerated
      const { error } = await (supabase as any)
        .from("site_payers")
        .update({ is_active: !payer.is_active })
        .eq("id", payer.id);

      if (error) throw error;

      await fetchData();
    } catch (err: any) {
      console.error("Error toggling payer status:", err?.message || err);
      setError("Failed to update payer status");
    }
  };

  const handleSavePayer = async () => {
    if (!formName.trim() || !siteId) return;

    setSaving(true);
    try {
      const supabase = createClient();

      const payerData = {
        name: formName.trim(),
        phone: formPhone.trim() || null,
        notes: formNotes.trim() || null,
        site_id: siteId,
      };

      // Note: Using type assertion until migration is run and types regenerated
      if (dialogMode === "add") {
        const { error } = await (supabase as any)
          .from("site_payers")
          .insert(payerData);

        if (error) throw error;
      } else if (editingPayer) {
        const { error } = await (supabase as any)
          .from("site_payers")
          .update(payerData)
          .eq("id", editingPayer.id);

        if (error) throw error;
      }

      await fetchData();
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Error saving payer:", err?.message || err);
      if (err?.code === "23505") {
        setError("A payer with this name already exists");
      } else {
        setError("Failed to save payer");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayer = async () => {
    if (!deletingPayer) return;

    setSaving(true);
    try {
      const supabase = createClient();

      // Note: Using type assertion until migration is run and types regenerated
      const { error } = await (supabase as any)
        .from("site_payers")
        .delete()
        .eq("id", deletingPayer.id);

      if (error) throw error;

      await fetchData();
      setDeleteDialogOpen(false);
      setDeletingPayer(null);
    } catch (err: any) {
      console.error("Error deleting payer:", err?.message || err);
      setError("Failed to delete payer. It may be linked to existing expenses.");
    } finally {
      setSaving(false);
    }
  };

  const activePayers = payers.filter((p) => p.is_active);
  const inactivePayers = payers.filter((p) => !p.is_active);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={60} sx={{ mb: 2 }} />
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

      {/* Multi-Payer Toggle */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Multiple Payers Mode
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enable this to track which person paid for each expense on this site
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={hasMultiplePayers}
                onChange={handleToggleMultiplePayers}
                disabled={!canEdit || saving}
                color="primary"
              />
            }
            label={hasMultiplePayers ? "Enabled" : "Disabled"}
            labelPlacement="start"
          />
        </Box>
      </Paper>

      {/* Payers Section - Only show when enabled */}
      {hasMultiplePayers && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Payers ({activePayers.length} active)
            </Typography>
            {canEdit && (
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                size="small"
                onClick={handleAddPayer}
              >
                Add Payer
              </Button>
            )}
          </Box>

          {/* Active Payers */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <List disablePadding>
              {activePayers.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary={
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                        No payers added yet. Add payers who contribute to expenses for this site.
                      </Typography>
                    }
                  />
                </ListItem>
              ) : (
                activePayers.map((payer, index) => (
                  <React.Fragment key={payer.id}>
                    {index > 0 && <Divider />}
                    <PayerListItem
                      payer={payer}
                      canEdit={canEdit}
                      onEdit={() => handleEditPayer(payer)}
                      onDelete={() => handleDeleteClick(payer)}
                      onToggleStatus={() => handleTogglePayerStatus(payer)}
                    />
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>

          {/* Inactive Payers */}
          {inactivePayers.length > 0 && (
            <>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Inactive Payers ({inactivePayers.length})
              </Typography>
              <Paper variant="outlined" sx={{ opacity: 0.7 }}>
                <List disablePadding>
                  {inactivePayers.map((payer, index) => (
                    <React.Fragment key={payer.id}>
                      {index > 0 && <Divider />}
                      <PayerListItem
                        payer={payer}
                        canEdit={canEdit}
                        onEdit={() => handleEditPayer(payer)}
                        onDelete={() => handleDeleteClick(payer)}
                        onToggleStatus={() => handleTogglePayerStatus(payer)}
                      />
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            </>
          )}
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === "add" ? "Add New Payer" : "Edit Payer"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              fullWidth
              autoFocus
              placeholder="e.g., Hari, Ravi, Partner Name"
            />
            <TextField
              label="Phone (Optional)"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              fullWidth
              placeholder="e.g., 9876543210"
              slotProps={{
                input: {
                  startAdornment: <PhoneIcon sx={{ mr: 1, color: "text.secondary" }} />,
                },
              }}
            />
            <TextField
              label="Notes (Optional)"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
              placeholder="Any additional details about this payer"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSavePayer}
            variant="contained"
            disabled={!formName.trim() || saving}
          >
            {saving ? <CircularProgress size={20} /> : dialogMode === "add" ? "Add" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Payer?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingPayer?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will not delete any expenses associated with this payer, but you won&apos;t be able to assign new expenses to them.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeletePayer}
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

// Payer List Item Component
interface PayerListItemProps {
  payer: SitePayer;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}

const PayerListItem = memo(function PayerListItem({
  payer,
  canEdit,
  onEdit,
  onDelete,
  onToggleStatus,
}: PayerListItemProps) {
  return (
    <ListItem
      sx={{
        "&:hover": {
          bgcolor: "action.hover",
        },
      }}
    >
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: payer.is_active ? "primary.main" : "grey.400" }}>
          <PersonIcon />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body1" fontWeight={500}>
              {payer.name}
            </Typography>
            {!payer.is_active && (
              <Chip label="Inactive" size="small" color="default" variant="outlined" />
            )}
          </Box>
        }
        secondary={
          <Box component="span">
            {payer.phone && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PhoneIcon sx={{ fontSize: 12 }} /> {payer.phone}
              </Typography>
            )}
            {payer.notes && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {payer.notes}
              </Typography>
            )}
          </Box>
        }
        secondaryTypographyProps={{ component: "div" }}
      />
      {canEdit && (
        <ListItemSecondaryAction>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Tooltip title={payer.is_active ? "Deactivate" : "Activate"}>
              <IconButton size="small" onClick={onToggleStatus}>
                {payer.is_active ? (
                  <ToggleOnIcon fontSize="small" color="primary" />
                ) : (
                  <ToggleOffIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
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
      )}
    </ListItem>
  );
});

export default SitePayersManager;
