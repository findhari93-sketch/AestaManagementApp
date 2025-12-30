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
  OutlinedInput,
  SelectChangeEvent,
  CircularProgress,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import type { User, Site } from "@/types/database.types";
import dayjs from "dayjs";

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = createClient();

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    phone: "",
    role: "site_engineer" as "admin" | "office" | "site_engineer",
    assigned_sites: [] as string[],
    status: "active" as "active" | "inactive" | "suspended",
    password: "",
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    const { data } = await supabase.from("sites").select("*").order("name");
    if (data) setSites(data);
  };

  useEffect(() => {
    fetchUsers();
    fetchSites();
  }, []);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        name: user.name,
        phone: user.phone || "",
        role: user.role,
        assigned_sites: user.assigned_sites || [],
        status: user.status,
        password: "",
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: "",
        name: "",
        phone: "",
        role: "site_engineer",
        assigned_sites: [],
        status: "active",
        password: "",
      });
    }
    setOpenDialog(true);
    setError("");
    setSuccess("");
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setError("");
    setSuccess("");
  };

  const handleSiteChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setFormData({
      ...formData,
      assigned_sites: typeof value === "string" ? value.split(",") : value,
    });
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setError("");
      setSubmitting(true);

      if (!formData.email || !formData.name || !formData.role) {
        setError("Please fill in all required fields (Name, Email, and Role).");
        setSubmitting(false);
        return;
      }

      if (!editingUser && !formData.password) {
        setError("Password is required for new users.");
        setSubmitting(false);
        return;
      }

      if (!editingUser && formData.password.length < 6) {
        setError("Password must be at least 6 characters long.");
        setSubmitting(false);
        return;
      }

      const userData = {
        email: formData.email,
        name: formData.name,
        phone: formData.phone || null,
        role: formData.role,
        assigned_sites:
          formData.assigned_sites.length > 0 ? formData.assigned_sites : null,
        status: formData.status,
        password: formData.password || undefined,
      };

      if (editingUser) {
        // Update existing user via API
        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingUser.id, ...userData }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to update user");
        }

        setSuccess("User updated successfully!");
      } else {
        // Create new user via API
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to create user");
        }

        setSuccess("User created successfully! They can now log in with their email and password.");
      }

      await fetchUsers();
      setTimeout(() => {
        handleCloseDialog();
      }, 1500);
    } catch (err: any) {
      // Display user-friendly error message
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<User>[]>(
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
        header: "Name",
        size: 180,
      },
      {
        accessorKey: "email",
        header: "Email",
        size: 200,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        size: 130,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "role",
        header: "Role",
        size: 130,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "admin", label: "ADMIN" },
          { value: "office", label: "OFFICE" },
          { value: "site_engineer", label: "SITE ENGINEER" },
        ],
        Cell: ({ cell }) => {
          const role = cell.getValue<string>();
          const colorMap: Record<string, any> = {
            admin: "error",
            office: "primary",
            site_engineer: "secondary",
          };
          return (
            <Chip
              label={role.replace("_", " ").toUpperCase()}
              size="small"
              color={colorMap[role] || "default"}
            />
          );
        },
      },
      {
        accessorKey: "assigned_sites",
        header: "Assigned Sites",
        size: 200,
        Cell: ({ row, cell }) => {
          const role = row.original.role;
          const siteIds = cell.getValue<string[]>();

          // Admins always have access to all sites
          if (role === "admin") {
            return (
              <Chip
                label="All Sites"
                size="small"
                color="success"
                variant="outlined"
              />
            );
          }

          // For non-admins, show assigned sites
          if (!siteIds || siteIds.length === 0) {
            return (
              <Chip
                label="All Sites"
                size="small"
                color="info"
                variant="outlined"
              />
            );
          }

          // Show site names
          const siteNames = siteIds
            .map((id) => sites.find((s) => s.id === id)?.name)
            .filter(Boolean);

          if (siteNames.length <= 2) {
            return (
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {siteNames.map((name, idx) => (
                  <Chip key={idx} label={name} size="small" variant="outlined" />
                ))}
              </Box>
            );
          }

          return (
            <Tooltip title={siteNames.join(", ")}>
              <Chip
                label={`${siteNames.length} sites`}
                size="small"
                variant="outlined"
              />
            </Tooltip>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 100,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "active", label: "ACTIVE" },
          { value: "inactive", label: "INACTIVE" },
          { value: "suspended", label: "SUSPENDED" },
        ],
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>().toUpperCase()}
            size="small"
            color={cell.getValue<string>() === "active" ? "success" : "default"}
          />
        ),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        size: 120,
        Cell: ({ cell }) =>
          dayjs(cell.getValue<string>()).format("DD MMM YYYY"),
      },
    ],
    [sites]
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
            <IconButton onClick={fetchUsers}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add User
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
        data={users}
        isLoading={loading}
        pageSize={10}
      />

      {/* Add/Edit User Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
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
                label="Name"
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
                label="Email"
                type="email"
                required
                disabled={!!editingUser}
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as any })
                  }
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="office">Office Employee</MenuItem>
                  <MenuItem value="site_engineer">Site Engineer</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {!editingUser && (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </Grid>
            )}

            <Grid size={{ xs: 12, md: editingUser ? 6 : 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as any })
                  }
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Site Assignment Section */}
            {formData.role === "admin" ? (
              <Grid size={{ xs: 12 }}>
                <Alert severity="info" sx={{ mt: 1 }}>
                  <strong>Admin Access:</strong> Admins automatically have access to all sites. No site assignment needed.
                </Alert>
              </Grid>
            ) : (
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth>
                  <InputLabel>Assigned Sites</InputLabel>
                  <Select
                    multiple
                    value={formData.assigned_sites}
                    onChange={handleSiteChange}
                    input={<OutlinedInput label="Assigned Sites" />}
                    renderValue={(selected) => {
                      if (selected.length === 0) return "All sites (no restriction)";
                      const selectedNames = selected
                        .map((id) => sites.find((s) => s.id === id)?.name)
                        .filter(Boolean);
                      return selectedNames.join(", ");
                    }}
                  >
                    {sites.map((site) => (
                      <MenuItem key={site.id} value={site.id}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Chip
                            size="small"
                            label={formData.assigned_sites.includes(site.id) ? "Selected" : ""}
                            color={formData.assigned_sites.includes(site.id) ? "primary" : "default"}
                            sx={{
                              minWidth: 70,
                              visibility: formData.assigned_sites.includes(site.id) ? "visible" : "hidden"
                            }}
                          />
                          {site.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  {formData.assigned_sites.length === 0
                    ? "Leave empty to grant access to all sites. Select specific sites to restrict access."
                    : `User will only have access to ${formData.assigned_sites.length} selected site(s).`}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {submitting ? "Saving..." : editingUser ? "Update User" : "Create User"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
