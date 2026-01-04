"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  InputAdornment,
} from "@mui/material";
import { Edit as EditIcon, Save as SaveIcon } from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import { useIsMobile } from "@/hooks/useIsMobile";
import type {
  MarketLaborerRatesPageData,
  MarketLaborerRole,
} from "@/lib/data/market-laborers";

interface MarketLaborersContentProps {
  initialData: MarketLaborerRatesPageData;
}

export default function MarketLaborersContent({
  initialData,
}: MarketLaborersContentProps) {
  const [marketRoles, setMarketRoles] = useState<MarketLaborerRole[]>(
    initialData.marketRoles
  );
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<MarketLaborerRole | null>(
    null
  );
  const [newRate, setNewRate] = useState<number>(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { userProfile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const isMobile = useIsMobile();

  const canEdit = hasEditPermission(userProfile?.role);

  const handleOpenDialog = useCallback((role: MarketLaborerRole) => {
    setEditingRole(role);
    setNewRate(role.default_daily_rate);
    setError("");
    setOpenDialog(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setEditingRole(null);
    setNewRate(0);
    setError("");
  }, []);

  const handleSaveRate = useCallback(async () => {
    if (!editingRole) return;

    if (newRate <= 0) {
      setError("Daily rate must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { error: updateError } = await supabase
        .from("labor_roles")
        .update({ default_daily_rate: newRate })
        .eq("id", editingRole.id);

      if (updateError) throw updateError;

      // Update local state
      setMarketRoles((prev) =>
        prev.map((role) =>
          role.id === editingRole.id
            ? { ...role, default_daily_rate: newRate }
            : role
        )
      );

      setSuccess(`Rate for ${editingRole.name} updated to Rs.${newRate}`);
      handleCloseDialog();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update rate");
    } finally {
      setLoading(false);
    }
  }, [editingRole, newRate, supabase, handleCloseDialog]);

  const columns = useMemo<MRT_ColumnDef<MarketLaborerRole>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Role Name",
        size: isMobile ? 120 : 200,
        Cell: ({ row }) => (
          <Typography variant="body2" fontWeight={600}>
            {row.original.name}
          </Typography>
        ),
      },
      {
        accessorKey: "category_name",
        header: isMobile ? "Category" : "Labor Category",
        size: isMobile ? 100 : 150,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>()}
            size="small"
            variant="outlined"
            color="primary"
          />
        ),
      },
      {
        accessorKey: "default_daily_rate",
        header: isMobile ? "Rate" : "Daily Rate",
        size: isMobile ? 80 : 120,
        Cell: ({ cell }) => (
          <Typography
            fontWeight={700}
            color="success.main"
            sx={{ fontSize: isMobile ? "0.85rem" : "1rem" }}
          >
            Rs.{cell.getValue<number>()}
          </Typography>
        ),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        size: isMobile ? 60 : 100,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<boolean>() ? "Active" : "Inactive"}
            size="small"
            color={cell.getValue<boolean>() ? "success" : "default"}
          />
        ),
      },
      {
        id: "mrt-row-actions",
        header: "",
        size: isMobile ? 50 : 80,
        Cell: ({ row }) => (
          <IconButton
            size="small"
            onClick={() => handleOpenDialog(row.original)}
            disabled={!canEdit}
            color="primary"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [canEdit, handleOpenDialog, isMobile]
  );

  return (
    <Box>
      <PageHeader
        title="Market Laborer Rates"
        subtitle="Manage daily rates for market laborer roles. Rate changes apply to new attendance entries only."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={marketRoles}
        isLoading={loading}
        pageSize={10}
        showRecordCount
        pinnedColumns={{
          left: ["name"],
          right: ["mrt-row-actions"],
        }}
      />

      {/* Edit Rate Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Edit Daily Rate - {editingRole?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Daily Rate"
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(Number(e.target.value))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">Rs.</InputAdornment>
                ),
              }}
              inputProps={{ min: 1 }}
              autoFocus
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              Note: This rate will apply to new attendance entries only.
              Existing records will retain their original rates.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveRate}
            variant="contained"
            disabled={loading}
            startIcon={<SaveIcon />}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
