"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, useEffect } from "react";
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
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Alert,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Block as BlockIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import type {
  Laborer,
  LaborCategory,
  LaborRole,
  Team,
} from "@/types/database.types";
import dayjs from "dayjs";

type LaborerWithDetails = Laborer & {
  category_name: string;
  role_name: string;
  team_name: string | null;
};

export default function LaborersPage() {
  const [laborers, setLaborers] = useState<LaborerWithDetails[]>([]);
  const [categories, setCategories] = useState<LaborCategory[]>([]);
  const [roles, setRoles] = useState<LaborRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingLaborer, setEditingLaborer] =
    useState<LaborerWithDetails | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { userProfile } = useAuth();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    category_id: "",
    role_id: "",
    employment_type: "daily_wage" as "daily_wage" | "contract" | "specialist",
    daily_rate: 0,
    team_id: "",
    status: "active" as "active" | "inactive",
    joining_date: dayjs().format("YYYY-MM-DD"),
  });

  const fetchLaborers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("laborers")
        .select(
          `*, category:labor_categories(name), role:labor_roles(name), team:teams(name)`
        )
        .order("name");

      if (error) throw error;
      setLaborers(
        data.map((l: any) => ({
          ...l,
          category_name: l.category?.name || "",
          role_name: l.role?.name || "",
          team_name: l.team?.name || null,
        }))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    const [catRes, roleRes, teamRes] = await Promise.all([
      supabase.from("labor_categories").select("*").order("name"),
      supabase.from("labor_roles").select("*").order("name"),
      supabase.from("teams").select("*").eq("status", "active").order("name"),
    ]);
    setCategories(catRes.data || []);
    setRoles(roleRes.data || []);
    setTeams(teamRes.data || []);
  };

  useEffect(() => {
    fetchLaborers();
    fetchOptions();
  }, []);

  const handleOpenDialog = (laborer?: LaborerWithDetails) => {
    if (laborer) {
      setEditingLaborer(laborer);
      setFormData({
        name: laborer.name,
        phone: laborer.phone || "",
        category_id: laborer.category_id,
        role_id: laborer.role_id,
        employment_type: laborer.employment_type,
        daily_rate: laborer.daily_rate,
        team_id: laborer.team_id || "",
        status: laborer.status,
        joining_date: laborer.joining_date,
      });
    } else {
      setEditingLaborer(null);
      setFormData({
        name: "",
        phone: "",
        category_id: "",
        role_id: "",
        employment_type: "daily_wage",
        daily_rate: 0,
        team_id: "",
        status: "active",
        joining_date: dayjs().format("YYYY-MM-DD"),
      });
    }
    setOpenDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.category_id || !formData.role_id) {
      setError("Please fill all required fields");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        ...formData,
        team_id: formData.team_id || null,
        phone: formData.phone || null,
      };

      if (editingLaborer) {
        const { error } = await (supabase.from("laborers") as any)
          .update(payload)
          .eq("id", editingLaborer.id);
        if (error) throw error;
        setSuccess("Laborer updated");
      } else {
        const { error } = await (supabase.from("laborers") as any).insert(
          payload
        );
        if (error) throw error;
        setSuccess("Laborer added");
      }
      setOpenDialog(false);
      await fetchLaborers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this laborer?")) return;
    try {
      setLoading(true);
      await (supabase.from("laborers") as any)
        .update({ status: "inactive" })
        .eq("id", id);
      await fetchLaborers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canEdit =
    userProfile?.role === "admin" || userProfile?.role === "office";
  const filteredRoles = roles.filter(
    (r) => r.category_id === formData.category_id
  );

  const columns = useMemo<MRT_ColumnDef<LaborerWithDetails>[]>(
    () => [
      { accessorKey: "name", header: "Name", size: 180 },
      {
        accessorKey: "phone",
        header: "Phone",
        size: 130,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      { accessorKey: "category_name", header: "Category", size: 130 },
      { accessorKey: "role_name", header: "Role", size: 150 },
      {
        accessorKey: "employment_type",
        header: "Type",
        size: 120,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>().replace("_", " ").toUpperCase()}
            size="small"
          />
        ),
      },
      {
        accessorKey: "daily_rate",
        header: "Daily Rate",
        size: 110,
        Cell: ({ cell }) => (
          <Typography fontWeight={600}>₹{cell.getValue<number>()}</Typography>
        ),
      },
      {
        accessorKey: "team_name",
        header: "Team",
        size: 130,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 100,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>().toUpperCase()}
            size="small"
            color={cell.getValue<string>() === "active" ? "success" : "default"}
          />
        ),
      },
      {
        accessorKey: "joining_date",
        header: "Joined",
        size: 120,
        Cell: ({ cell }) => dayjs(cell.getValue<string>()).format("DD MMM YY"),
      },
      {
        id: "mrt-row-actions",
        header: "Actions",
        size: 120,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(row.original)}
              disabled={!canEdit}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            {row.original.status === "active" && (
              <IconButton
                size="small"
                color="warning"
                onClick={() => handleDeactivate(row.original.id)}
                disabled={!canEdit}
              >
                <BlockIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ),
      },
    ],
    [canEdit]
  );

  return (
    <Box>
      <PageHeader
        title="Laborers"
        subtitle="Manage all company laborers"
        onRefresh={fetchLaborers}
        isLoading={loading}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={!canEdit}
          >
            Add Laborer
          </Button>
        }
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
        data={laborers}
        isLoading={loading}
        pageSize={20}
      />

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingLaborer ? "Edit Laborer" : "Add Laborer"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category_id: e.target.value,
                        role_id: "",
                      })
                    }
                    label="Category"
                  >
                    {categories.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl
                  fullWidth
                  required
                  disabled={!formData.category_id}
                >
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={formData.role_id}
                    onChange={(e) => {
                      const role = roles.find((r) => r.id === e.target.value);
                      setFormData({
                        ...formData,
                        role_id: e.target.value,
                        daily_rate:
                          role?.default_daily_rate || formData.daily_rate,
                      });
                    }}
                    label="Role"
                  >
                    {filteredRoles.map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {r.name} (₹{r.default_daily_rate})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Employment Type</InputLabel>
                  <Select
                    value={formData.employment_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        employment_type: e.target.value as any,
                      })
                    }
                    label="Employment Type"
                  >
                    <MenuItem value="daily_wage">Daily Wage</MenuItem>
                    <MenuItem value="contract">Contract</MenuItem>
                    <MenuItem value="specialist">Specialist</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Daily Rate"
                  type="number"
                  value={formData.daily_rate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      daily_rate: Number(e.target.value),
                    })
                  }
                  slotProps={{ input: { startAdornment: "₹" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Team (Optional)</InputLabel>
                  <Select
                    value={formData.team_id}
                    onChange={(e) =>
                      setFormData({ ...formData, team_id: e.target.value })
                    }
                    label="Team (Optional)"
                  >
                    <MenuItem value="">None</MenuItem>
                    {teams.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Joining Date"
                  type="date"
                  value={formData.joining_date}
                  onChange={(e) =>
                    setFormData({ ...formData, joining_date: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                    label="Status"
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {editingLaborer ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
