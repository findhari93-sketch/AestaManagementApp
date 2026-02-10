"use client";

import { useMemo, useState } from "react";
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
  Typography,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { useSelectedCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCompanyMembers,
  useCompanyInvites,
  useUpdateMemberRole,
  useRemoveMember,
  useCreateInvite,
  useCancelInvite,
  type CompanyMember,
  type CompanyInvite,
} from "@/hooks/queries/useCompanyMembers";
import dayjs from "dayjs";

interface TeamManagementProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function TeamManagement({ onSuccess, onError }: TeamManagementProps) {
  const { selectedCompany } = useSelectedCompany();
  const { userProfile } = useAuth();
  const { data: members = [], isLoading: membersLoading, error: membersError } = useCompanyMembers();
  const { data: invites = [], isLoading: invitesLoading } = useCompanyInvites();

  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const createInvite = useCreateInvite();
  const cancelInvite = useCancelInvite();

  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: "",
    phone: "",
    role: "member",
  });

  // Check if current user is owner or admin
  const currentMember = members.find((m) => m.user_id === userProfile?.id);
  const isOwnerOrAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";

  const handleInvite = async () => {
    if (!inviteData.email && !inviteData.phone) {
      onError?.("Please provide either email or phone number");
      return;
    }

    if (!userProfile?.id) {
      onError?.("User not found");
      return;
    }

    try {
      await createInvite.mutateAsync({
        email: inviteData.email || undefined,
        phone: inviteData.phone || undefined,
        role: inviteData.role,
        invitedBy: userProfile.id,
      });

      setOpenInviteDialog(false);
      setInviteData({ email: "", phone: "", role: "member" });
      onSuccess?.("Invite sent successfully!");
    } catch (err: any) {
      onError?.(err.message || "Failed to send invite");
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await updateRole.mutateAsync({ memberId, role: newRole });
      onSuccess?.("Role updated successfully");
    } catch (err: any) {
      onError?.(err.message || "Failed to update role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      await removeMember.mutateAsync(memberId);
      onSuccess?.("Member removed successfully");
    } catch (err: any) {
      onError?.(err.message || "Failed to remove member");
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await cancelInvite.mutateAsync(inviteId);
      onSuccess?.("Invite cancelled");
    } catch (err: any) {
      onError?.(err.message || "Failed to cancel invite");
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/join?token=${token}`;
    navigator.clipboard.writeText(link);
    onSuccess?.("Invite link copied to clipboard");
  };

  const columns = useMemo<MRT_ColumnDef<CompanyMember>[]>(
    () => [
      {
        accessorFn: (row) => row.user?.name || "Unknown",
        id: "name",
        header: "Name",
        size: 200,
      },
      {
        accessorFn: (row) => row.user?.email || "-",
        id: "email",
        header: "Email",
        size: 200,
      },
      {
        accessorKey: "role",
        header: "Role",
        size: 120,
        Cell: ({ row }) => {
          const member = row.original;
          const isCurrentUser = member.user_id === userProfile?.id;
          const isOwner = member.role === "owner";

          if (!isOwnerOrAdmin || isCurrentUser || isOwner) {
            return (
              <Chip
                label={member.role}
                size="small"
                color={
                  member.role === "owner"
                    ? "primary"
                    : member.role === "admin"
                      ? "secondary"
                      : "default"
                }
              />
            );
          }

          return (
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={member.role}
                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                size="small"
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="member">Member</MenuItem>
              </Select>
            </FormControl>
          );
        },
      },
      {
        accessorKey: "joined_at",
        header: "Joined",
        size: 120,
        Cell: ({ cell }) => dayjs(cell.getValue<string>()).format("MMM D, YYYY"),
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => {
          const member = row.original;
          const isCurrentUser = member.user_id === userProfile?.id;
          const isOwner = member.role === "owner";

          if (!isOwnerOrAdmin || isCurrentUser || isOwner) {
            return null;
          }

          return (
            <Tooltip title="Remove member">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleRemoveMember(member.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        },
      },
    ],
    [isOwnerOrAdmin, userProfile?.id]
  );

  if (!selectedCompany) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">
          No company selected. Please select a company first.
        </Typography>
      </Box>
    );
  }

  if (membersError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading team members: {(membersError as Error).message}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Company Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {selectedCompany.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Company Code: {selectedCompany.code}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </Typography>
        </CardContent>
      </Card>

      {/* Team Members Table */}
      <Box sx={{ mb: 3 }}>
        <DataTable
          columns={columns}
          data={members}
          isLoading={membersLoading}
          renderTopToolbarCustomActions={() =>
            isOwnerOrAdmin ? (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setOpenInviteDialog(true)}
              >
                Invite Member
              </Button>
            ) : null
          }
        />
      </Box>

      {/* Pending Invites */}
      {isOwnerOrAdmin && invites.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Pending Invites ({invites.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              {invites.map((invite) => (
                <ListItem key={invite.id} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {invite.email && (
                          <>
                            <EmailIcon fontSize="small" color="action" />
                            <span>{invite.email}</span>
                          </>
                        )}
                        {invite.phone && (
                          <>
                            <PhoneIcon fontSize="small" color="action" />
                            <span>{invite.phone}</span>
                          </>
                        )}
                        <Chip label={invite.role} size="small" sx={{ ml: 1 }} />
                      </Box>
                    }
                    secondary={`Expires ${dayjs(invite.expires_at).format("MMM D, YYYY h:mm A")}`}
                    primaryTypographyProps={{ component: "div" }}
                    secondaryTypographyProps={{ component: "div" }}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Copy invite link">
                      <IconButton
                        size="small"
                        onClick={() => copyInviteLink(invite.token)}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cancel invite">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog
        open={openInviteDialog}
        onClose={() => setOpenInviteDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={inviteData.email}
                onChange={(e) =>
                  setInviteData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="member@company.com"
              />
            </Grid>
            <Grid size={12}>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                OR
              </Typography>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Phone"
                value={inviteData.phone}
                onChange={(e) =>
                  setInviteData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+91 9876543210"
              />
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={inviteData.role}
                  label="Role"
                  onChange={(e) =>
                    setInviteData((prev) => ({ ...prev, role: e.target.value }))
                  }
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="member">Member</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInviteDialog(false)}>Cancel</Button>
          <Button
            onClick={handleInvite}
            variant="contained"
            disabled={createInvite.isPending}
          >
            {createInvite.isPending ? (
              <CircularProgress size={20} />
            ) : (
              "Send Invite"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
