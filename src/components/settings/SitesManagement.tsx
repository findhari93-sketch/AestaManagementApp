"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import type { Site } from "@/types/database.types";
import dayjs from "dayjs";

export default function SitesManagement() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    site_type: "single_client" as Site["site_type"],
    status: "planning" as Site["status"],
    start_date: "",
    target_completion_date: "",
    nearby_tea_shop_name: "",
  });

  const fetchSites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSites(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleOpenDialog = (site?: Site) => {
    if (site) {
      setEditingSite(site);
      setFormData({
        name: site.name,
        address: site.address || "",
        city: site.city || "",
        site_type: site.site_type || "residential",
        status: site.status || "active",
        start_date: site.start_date || "",
        target_completion_date: site.target_completion_date || "",
        nearby_tea_shop_name: site.nearby_tea_shop_name || "",
      });
    } else {
      setEditingSite(null);
      setFormData({
        name: "",
        address: "",
        city: "",
        site_type: "single_client",
        status: "planning",
        start_date: "",
        target_completion_date: "",
        nearby_tea_shop_name: "",
      });
    }
    setOpenDialog(true);
    setError("");
    setSuccess("");
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSite(null);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async () => {
    try {
      setError("");

      if (!formData.name || !formData.address || !formData.city) {
        setError("Please fill in all required fields");
        return;
      }

      const siteData = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        site_type: formData.site_type,
        status: formData.status,
        start_date: formData.start_date || null,
        target_completion_date: formData.target_completion_date || null,
        nearby_tea_shop_name: formData.nearby_tea_shop_name || null,
      };

      if (editingSite) {
        const { error } = await (supabase.from("sites") as any)
          .update(siteData)
          .eq("id", editingSite.id);

        if (error) throw error;
        setSuccess("Site updated successfully");
      } else {
        const { error } = await (supabase.from("sites") as any).insert(
          siteData
        );

        if (error) throw error;
        setSuccess(
          "Site created successfully. Building sections will be auto-created."
        );
      }

      await fetchSites();
      setTimeout(() => {
        handleCloseDialog();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const columns = useMemo<MRT_ColumnDef<Site>[]>(
    () => [
      {
        id: "mrt-row-actions",
        header: "Actions",
        size: 100,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => handleOpenDialog(row.original)}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
          </Box>
        ),
        columnDefType: "display",
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "name",
        header: "Site Name",
        size: 200,
      },
      {
        accessorKey: "city",
        header: "City",
        size: 120,
      },
      {
        accessorKey: "site_type",
        header: "Type",
        size: 120,
        Cell: ({ cell }) => {
          const siteType = cell.getValue<string>();
          const colorMap: Record<string, "primary" | "secondary" | "info"> = {
            single_client: "primary",
            multi_client: "secondary",
            personal: "info",
          };
          return (
            <Chip
              label={siteType.replace("_", " ").toUpperCase()}
              size="small"
              color={colorMap[siteType] || "default"}
            />
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ cell }) => {
          const status = cell.getValue<string>();
          const colorMap: Record<string, any> = {
            planning: "info",
            active: "success",
            on_hold: "warning",
            completed: "default",
          };
          return (
            <Chip
              label={status.replace("_", " ").toUpperCase()}
              size="small"
              color={colorMap[status] || "default"}
            />
          );
        },
      },
      {
        accessorKey: "start_date",
        header: "Start Date",
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? dayjs(date).format("DD MMM YYYY") : "-";
        },
      },
      {
        accessorKey: "target_completion_date",
        header: "Target Completion",
        size: 140,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? dayjs(date).format("DD MMM YYYY") : "-";
        },
      },
      {
        accessorKey: "created_at",
        header: "Created",
        size: 120,
        Cell: ({ cell }) =>
          dayjs(cell.getValue<string>()).format("DD MMM YYYY"),
      },
    ],
    []
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box />
        <Box sx={{ display: "flex", gap: 2 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchSites}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Site
          </Button>
        </Box>
      </Box>

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
        data={sites}
        isLoading={loading}
        pageSize={10}
      />

      {/* Add/Edit Site Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editingSite ? "Edit Site" : "Add New Site"}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Site Name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="City"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Address"
                required
                multiline
                rows={2}
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Site Type</InputLabel>
                <Select
                  value={formData.site_type}
                  label="Site Type"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      site_type: e.target.value as any,
                    })
                  }
                >
                  <MenuItem value="single_client">Single Client</MenuItem>
                  <MenuItem value="multi_client">Multi Client</MenuItem>
                  <MenuItem value="personal">Personal</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as any })
                  }
                >
                  <MenuItem value="planning">Planning</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="on_hold">On Hold</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Target Completion Date"
                type="date"
                value={formData.target_completion_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    target_completion_date: e.target.value,
                  })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Nearby Tea Shop Name"
                value={formData.nearby_tea_shop_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nearby_tea_shop_name: e.target.value,
                  })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingSite ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
