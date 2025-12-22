"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Avatar,
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
  Fab,
} from "@mui/material";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Block as BlockIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import type { Tables } from "@/types/database.types";
import type { LaborersPageData, LaborerWithDetails } from "@/lib/data/laborers";
import LaborerPhotoUploader from "@/components/laborers/LaborerPhotoUploader";
import dayjs from "dayjs";

type LaborCategory = Tables<"labor_categories">;
type LaborRole = Tables<"labor_roles">;
type Team = Tables<"teams">;
type LaborerType = "daily_market" | "contract";

interface LaborersContentProps {
  initialData: LaborersPageData;
}

export default function LaborersContent({ initialData }: LaborersContentProps) {
  // Initialize state with server data
  const [laborers, setLaborers] = useState<LaborerWithDetails[]>(
    initialData.laborers
  );
  const [categories] = useState<LaborCategory[]>(initialData.categories);
  const [roles] = useState<LaborRole[]>(initialData.roles);
  const [teams] = useState<Team[]>(initialData.teams);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingLaborer, setEditingLaborer] =
    useState<LaborerWithDetails | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { userProfile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const isMobile = useIsMobile();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    category_id: "",
    role_id: "",
    employment_type: "daily_wage" as "daily_wage" | "contract" | "specialist",
    laborer_type: "daily_market" as LaborerType,
    language: "Tamil" as "Hindi" | "Tamil",
    daily_rate: 0,
    team_id: "",
    associated_team_id: "",
    status: "active" as "active" | "inactive",
    joining_date: dayjs().format("YYYY-MM-DD"),
    photo_url: null as string | null,
  });

  const fetchLaborers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("laborers")
        .select(
          `*, category:labor_categories(name), role:labor_roles(name), team:teams!laborers_team_id_fkey(name), associated_team:teams!laborers_associated_team_id_fkey(name)`
        )
        .order("name");

      if (error) throw error;
      setLaborers(
        data.map((l: any) => ({
          ...l,
          category_name: l.category?.name || "",
          role_name: l.role?.name || "",
          team_name: l.team?.name || null,
          associated_team_name: l.associated_team?.name || null,
        }))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleOpenDialog = (laborer?: LaborerWithDetails) => {
    if (laborer) {
      setEditingLaborer(laborer);
      setFormData({
        name: laborer.name,
        phone: laborer.phone || "",
        category_id: laborer.category_id,
        role_id: laborer.role_id,
        employment_type: laborer.employment_type,
        laborer_type: (laborer.laborer_type as LaborerType) || "daily_market",
        language: (laborer.language as "Hindi" | "Tamil") || "Tamil",
        daily_rate: laborer.daily_rate,
        team_id: laborer.team_id || "",
        associated_team_id: laborer.associated_team_id || "",
        status: laborer.status,
        joining_date: laborer.joining_date || dayjs().format("YYYY-MM-DD"),
        photo_url: laborer.photo_url || null,
      });
    } else {
      setEditingLaborer(null);
      setFormData({
        name: "",
        phone: "",
        category_id: "",
        role_id: "",
        employment_type: "daily_wage",
        laborer_type: "daily_market",
        language: "Tamil",
        daily_rate: 0,
        team_id: "",
        associated_team_id: "",
        status: "active",
        joining_date: dayjs().format("YYYY-MM-DD"),
        photo_url: null,
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
        associated_team_id: formData.associated_team_id || null,
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

  const handleDeactivate = useCallback(
    async (id: string) => {
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
    },
    [supabase, fetchLaborers]
  );

  const canEdit = hasEditPermission(userProfile?.role);
  const filteredRoles = roles.filter(
    (r) => r.category_id === formData.category_id
  );

  const columns = useMemo<MRT_ColumnDef<LaborerWithDetails>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        size: isMobile ? 130 : 200,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar
              src={row.original.photo_url || undefined}
              sx={{
                width: isMobile ? 28 : 32,
                height: isMobile ? 28 : 32,
                fontSize: isMobile ? 12 : 14,
                bgcolor: "primary.light",
              }}
            >
              {row.original.name.charAt(0).toUpperCase()}
            </Avatar>
            <Typography
              variant="body2"
              fontWeight={500}
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.original.name}
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        size: 110,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "category_name",
        header: isMobile ? "Cat" : "Category",
        size: isMobile ? 60 : 130,
      },
      {
        accessorKey: "role_name",
        header: "Role",
        size: isMobile ? 70 : 150,
      },
      {
        accessorKey: "laborer_type",
        header: isMobile ? "Type" : "Laborer Type",
        size: isMobile ? 50 : 140,
        Cell: ({ cell }) => {
          const type = cell.getValue<string>() || "daily_market";
          return (
            <Chip
              label={
                isMobile
                  ? type === "contract"
                    ? "C"
                    : "D"
                  : type === "contract"
                    ? "CONTRACT"
                    : "DAILY"
              }
              size="small"
              color={type === "contract" ? "primary" : "warning"}
              variant={type === "contract" ? "filled" : "outlined"}
            />
          );
        },
      },
      {
        accessorKey: "language",
        header: isMobile ? "Lang" : "Language",
        size: isMobile ? 45 : 90,
        Cell: ({ cell }) => {
          const lang = cell.getValue<string>() || "Tamil";
          return (
            <Chip
              label={isMobile ? (lang === "Hindi" ? "H" : "T") : lang}
              size="small"
              color={lang === "Hindi" ? "info" : "success"}
              variant="outlined"
            />
          );
        },
      },
      {
        accessorKey: "employment_type",
        header: isMobile ? "Emp" : "Employment",
        size: isMobile ? 70 : 120,
        Cell: ({ cell }) => (
          <Chip
            label={
              isMobile
                ? cell.getValue<string>().charAt(0).toUpperCase()
                : cell.getValue<string>().replace("_", " ").toUpperCase()
            }
            size="small"
          />
        ),
      },
      {
        accessorKey: "daily_rate",
        header: isMobile ? "Rate" : "Daily Rate",
        size: isMobile ? 60 : 110,
        Cell: ({ cell }) => (
          <Typography
            fontWeight={600}
            sx={{ fontSize: isMobile ? "0.7rem" : "inherit" }}
          >
            ₹{cell.getValue<number>()}
          </Typography>
        ),
      },
      {
        accessorKey: "associated_team_name",
        header: isMobile ? "Mesthri" : "Mesthri Team",
        size: isMobile ? 70 : 140,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "team_name",
        header: isMobile ? "Team" : "Work Team",
        size: isMobile ? 70 : 130,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "status",
        header: isMobile ? "St" : "Status",
        size: isMobile ? 45 : 100,
        Cell: ({ cell }) => (
          <Chip
            label={
              isMobile
                ? cell.getValue<string>() === "active"
                  ? "A"
                  : "I"
                : cell.getValue<string>().toUpperCase()
            }
            size="small"
            color={cell.getValue<string>() === "active" ? "success" : "default"}
          />
        ),
      },
      {
        accessorKey: "joining_date",
        header: "Joined",
        size: 90,
        Cell: ({ cell }) => dayjs(cell.getValue<string>()).format("DD MMM YY"),
      },
      {
        id: "mrt-row-actions",
        header: "",
        size: isMobile ? 70 : 100,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.25 }}>
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
    [canEdit, handleDeactivate, isMobile]
  );

  return (
    <Box>
      <PageHeader
        title="Laborers"
        subtitle="Manage all company laborers"
        actions={
          !isMobile && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              disabled={!canEdit}
              size="small"
            >
              Add Laborer
            </Button>
          )
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
        pinnedColumns={{
          left: ["name"],
          right: ["mrt-row-actions"],
        }}
        mobileHiddenColumns={["phone", "joining_date"]}
      />

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingLaborer ? "Edit Laborer" : "Add Laborer"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            {/* Photo Uploader - Top of form */}
            <LaborerPhotoUploader
              currentPhotoUrl={formData.photo_url}
              laborerName={formData.name}
              laborerId={editingLaborer?.id}
              onPhotoChange={(url) =>
                setFormData({ ...formData, photo_url: url })
              }
              onError={(error) => setError(error)}
              disabled={!canEdit}
              supabase={supabase}
            />

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
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Language</InputLabel>
                  <Select
                    value={formData.language}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        language: e.target.value as "Hindi" | "Tamil",
                      })
                    }
                    label="Language"
                  >
                    <MenuItem value="Tamil">Tamil</MenuItem>
                    <MenuItem value="Hindi">Hindi</MenuItem>
                  </Select>
                </FormControl>
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
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Laborer Type</InputLabel>
                  <Select
                    value={formData.laborer_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        laborer_type: e.target.value as LaborerType,
                        associated_team_id:
                          e.target.value === "daily_market"
                            ? ""
                            : formData.associated_team_id,
                      })
                    }
                    label="Laborer Type"
                  >
                    <MenuItem value="daily_market">
                      Daily Market (Hired separately - paid directly)
                    </MenuItem>
                    <MenuItem value="contract">
                      Contract (Mesthri&apos;s team - paid via Mesthri)
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl
                  fullWidth
                  disabled={formData.laborer_type !== "contract"}
                >
                  <InputLabel>
                    Mesthri&apos;s Team{" "}
                    {formData.laborer_type === "contract"
                      ? "(Required)"
                      : "(N/A)"}
                  </InputLabel>
                  <Select
                    value={formData.associated_team_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        associated_team_id: e.target.value,
                      })
                    }
                    label={`Mesthri's Team ${
                      formData.laborer_type === "contract"
                        ? "(Required)"
                        : "(N/A)"
                    }`}
                  >
                    <MenuItem value="">None</MenuItem>
                    {teams.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name} ({t.leader_name})
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
                  <InputLabel>Work Team (Optional)</InputLabel>
                  <Select
                    value={formData.team_id}
                    onChange={(e) =>
                      setFormData({ ...formData, team_id: e.target.value })
                    }
                    label="Work Team (Optional)"
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

      {/* Mobile FAB */}
      <Fab
        color="primary"
        onClick={() => handleOpenDialog()}
        disabled={!canEdit}
        sx={{
          display: canEdit ? { xs: "flex", sm: "none" } : "none",
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
