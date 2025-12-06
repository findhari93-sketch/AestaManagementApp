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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from "@mui/material";
import { Add, Edit, Delete, People } from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import type { Team } from "@/types/database.types";
import dayjs from "dayjs";

type TeamWithCount = Team & { member_count: number };

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [availableLaborers, setAvailableLaborers] = useState<any[]>([]);
  const [error, setError] = useState("");

  const { userProfile } = useAuth();
  const supabase = createClient();

  const [form, setForm] = useState({
    name: "",
    leader_name: "",
    leader_phone: "",
    status: "active" as "active" | "inactive",
  });

  const canEdit =
    userProfile?.role === "admin" || userProfile?.role === "office";

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const { data: teamsData, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      if (error) throw error;

      const teamsWithCount = await Promise.all(
        ((teamsData as any[]) || []).map(async (team: any) => {
          const { count } = await supabase
            .from("laborers")
            .select("*", { count: "exact", head: true })
            .eq("team_id", team.id);
          return { ...team, member_count: count || 0 };
        })
      );
      setTeams(teamsWithCount as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleOpenDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setForm({
        name: team.name,
        leader_name: team.leader_name || "",
        leader_phone: team.leader_phone || "",
        status: team.status,
      });
    } else {
      setEditingTeam(null);
      setForm({
        name: "",
        leader_name: "",
        leader_phone: "",
        status: "active",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      setError("Team name is required");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        name: form.name,
        leader_name: form.leader_name || null,
        leader_phone: form.leader_phone || null,
        status: form.status,
      };

      if (editingTeam) {
        await (supabase.from("teams") as any)
          .update(payload)
          .eq("id", editingTeam.id);
      } else {
        await (supabase.from("teams") as any).insert(payload);
      }
      setDialogOpen(false);
      await fetchTeams();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, memberCount: number) => {
    if (memberCount > 0) {
      alert("Cannot delete team with members");
      return;
    }
    if (!confirm("Delete this team?")) return;
    try {
      await supabase.from("teams").delete().eq("id", id);
      await fetchTeams();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenMembers = async (team: Team) => {
    setSelectedTeam(team);
    const { data: members } = await supabase
      .from("laborers")
      .select("id, name")
      .eq("team_id", team.id)
      .order("name");
    const { data: available } = await supabase
      .from("laborers")
      .select("id, name")
      .is("team_id", null)
      .eq("status", "active")
      .order("name");
    setTeamMembers(members || []);
    setAvailableLaborers(available || []);
    setMembersDialogOpen(true);
  };

  const handleAddMember = async (laborerId: string) => {
    if (!selectedTeam) return;
    await (supabase.from("laborers") as any)
      .update({ team_id: selectedTeam.id })
      .eq("id", laborerId);
    await handleOpenMembers(selectedTeam);
    await fetchTeams();
  };

  const handleRemoveMember = async (laborerId: string) => {
    if (!selectedTeam) return;
    await (supabase.from("laborers") as any)
      .update({ team_id: null })
      .eq("id", laborerId);
    await handleOpenMembers(selectedTeam);
    await fetchTeams();
  };

  const columns = useMemo<MRT_ColumnDef<TeamWithCount>[]>(
    () => [
      { accessorKey: "name", header: "Team Name", size: 200 },
      {
        accessorKey: "leader_name",
        header: "Leader",
        size: 180,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "leader_phone",
        header: "Phone",
        size: 130,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "member_count",
        header: "Members",
        size: 100,
        Cell: ({ cell }) => (
          <Chip label={cell.getValue<number>()} size="small" color="primary" />
        ),
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
        id: "mrt-row-actions",
        header: "Actions",
        size: 150,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => handleOpenMembers(row.original)}
            >
              <People fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(row.original)}
              disabled={!canEdit}
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() =>
                handleDelete(row.original.id, row.original.member_count)
              }
              disabled={!canEdit || row.original.member_count > 0}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ],
    [canEdit]
  );

  return (
    <Box>
      <PageHeader
        title="Teams"
        subtitle="Manage contractor teams"
        onRefresh={fetchTeams}
        isLoading={loading}
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={!canEdit}
          >
            Add Team
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <DataTable columns={columns} data={teams} isLoading={loading} />

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingTeam ? "Edit Team" : "Add Team"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              label="Team Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Leader Name"
              value={form.leader_name}
              onChange={(e) =>
                setForm({ ...form, leader_name: e.target.value })
              }
            />
            <TextField
              fullWidth
              label="Leader Phone"
              value={form.leader_phone}
              onChange={(e) =>
                setForm({ ...form, leader_phone: e.target.value })
              }
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as any })
                }
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {editingTeam ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Members Dialog */}
      <Dialog
        open={membersDialogOpen}
        onClose={() => setMembersDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Team Members - {selectedTeam?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Current Members ({teamMembers.length})
          </Typography>
          <List dense>
            {teamMembers.map((m) => (
              <ListItem key={m.id}>
                <ListItemText primary={m.name} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleRemoveMember(m.id)}
                    disabled={!canEdit}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {teamMembers.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No members
              </Typography>
            )}
          </List>
          {canEdit && availableLaborers.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Add Member
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Select Laborer</InputLabel>
                <Select
                  label="Select Laborer"
                  onChange={(e) => handleAddMember(e.target.value as string)}
                  value=""
                >
                  {availableLaborers.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMembersDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
