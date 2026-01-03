"use client";

export const dynamic = 'force-dynamic';

import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
  Fab,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Phone as PhoneIcon,
  LocalCafe as TeaIcon,
  LocationOn as LocationIcon,
  Link as LinkIcon,
  Groups as GroupsIcon,
  Business as SiteIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasEditPermission } from "@/lib/permissions";
import {
  useCompanyTeaShops,
  useDeleteCompanyTeaShop,
  type CompanyTeaShopWithAssignments,
} from "@/hooks/queries/useCompanyTeaShops";
import CompanyTeaShopDrawer from "@/components/tea-shop/CompanyTeaShopDrawer";
import TeaShopAssignmentDialog from "@/components/tea-shop/TeaShopAssignmentDialog";

export default function CompanyTeaShopsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<CompanyTeaShopWithAssignments | null>(null);
  const [assigningShop, setAssigningShop] = useState<CompanyTeaShopWithAssignments | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { userProfile } = useAuth();
  const isMobile = useIsMobile();
  const canEdit = hasEditPermission(userProfile?.role);

  const { data: teaShops = [], isLoading } = useCompanyTeaShops();
  const deleteTeaShop = useDeleteCompanyTeaShop();

  // Filter tea shops by search term
  const filteredTeaShops = useMemo(() => {
    if (!searchTerm) return teaShops;
    const term = searchTerm.toLowerCase();
    return teaShops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(term) ||
        shop.owner_name?.toLowerCase().includes(term) ||
        shop.address?.toLowerCase().includes(term) ||
        shop.contact_phone?.includes(term)
    );
  }, [teaShops, searchTerm]);

  const handleOpenDialog = useCallback((shop?: CompanyTeaShopWithAssignments) => {
    if (shop) {
      setEditingShop(shop);
    } else {
      setEditingShop(null);
    }
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingShop(null);
  }, []);

  const handleOpenAssignmentDialog = useCallback((shop: CompanyTeaShopWithAssignments) => {
    setAssigningShop(shop);
    setAssignmentDialogOpen(true);
  }, []);

  const handleCloseAssignmentDialog = useCallback(() => {
    setAssignmentDialogOpen(false);
    setAssigningShop(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Are you sure you want to delete this tea shop?")) return;
      try {
        await deleteTeaShop.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete tea shop:", error);
      }
    },
    [deleteTeaShop]
  );

  // Table columns
  const columns = useMemo<MRT_ColumnDef<CompanyTeaShopWithAssignments>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Tea Shop",
        size: 200,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <TeaIcon color="primary" fontSize="small" />
            <Box>
              <Typography variant="body2" fontWeight={500}>
                {row.original.name}
              </Typography>
              {row.original.owner_name && (
                <Typography variant="caption" color="text.secondary">
                  Owner: {row.original.owner_name}
                </Typography>
              )}
            </Box>
          </Box>
        ),
      },
      {
        accessorKey: "contact_phone",
        header: "Contact",
        size: 150,
        Cell: ({ row }) => (
          <Box>
            {row.original.contact_phone ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PhoneIcon fontSize="small" sx={{ fontSize: 14 }} color="action" />
                <Typography variant="body2">{row.original.contact_phone}</Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">-</Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "address",
        header: "Address",
        size: 200,
        Cell: ({ row }) => (
          <Box>
            {row.original.address ? (
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                <LocationIcon fontSize="small" sx={{ fontSize: 14, mt: 0.3 }} color="action" />
                <Typography variant="body2" sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.original.address}
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">-</Typography>
            )}
          </Box>
        ),
      },
      {
        id: "assignments",
        header: "Assigned To",
        size: 250,
        enableSorting: false,
        Cell: ({ row }) => {
          const activeAssignments = row.original.assignments?.filter(a => a.is_active) || [];
          if (activeAssignments.length === 0) {
            return (
              <Chip
                label="Not Assigned"
                size="small"
                variant="outlined"
                color="warning"
                icon={<LinkIcon />}
                onClick={() => canEdit && handleOpenAssignmentDialog(row.original)}
                clickable={canEdit}
              />
            );
          }
          return (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {activeAssignments.map((assignment) => (
                <Chip
                  key={assignment.id}
                  icon={assignment.site_group_id ? <GroupsIcon /> : <SiteIcon />}
                  label={assignment.site_group?.name || assignment.site?.name || "Unknown"}
                  size="small"
                  color={assignment.site_group_id ? "secondary" : "primary"}
                  variant="outlined"
                />
              ))}
              {canEdit && (
                <Tooltip title="Manage Assignments">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenAssignmentDialog(row.original)}
                    sx={{ ml: 0.5 }}
                  >
                    <LinkIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        },
      },
      {
        accessorKey: "upi_id",
        header: "Payment",
        size: 150,
        Cell: ({ row }) => (
          <Box>
            {row.original.upi_id ? (
              <Chip label={`UPI: ${row.original.upi_id}`} size="small" variant="outlined" />
            ) : (
              <Typography variant="caption" color="text.secondary">No UPI</Typography>
            )}
          </Box>
        ),
      },
    ],
    [canEdit, handleOpenAssignmentDialog]
  );

  // Row actions
  const renderRowActions = useCallback(
    ({ row }: { row: { original: CompanyTeaShopWithAssignments } }) => (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <Tooltip title="Edit">
          <IconButton
            size="small"
            onClick={() => handleOpenDialog(row.original)}
            disabled={!canEdit}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={() => handleDelete(row.original.id)}
            disabled={!canEdit}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    [handleOpenDialog, handleDelete, canEdit]
  );

  return (
    <Box>
      <PageHeader
        title="Tea Shops"
        subtitle="Manage tea shops and assign them to sites or site groups"
        actions={
          !isMobile && canEdit ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Tea Shop
            </Button>
          ) : null
        }
      />

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search tea shops..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 300 }}
        />
      </Box>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredTeaShops}
        isLoading={isLoading}
        enableRowActions={canEdit}
        renderRowActions={renderRowActions}
        mobileHiddenColumns={["address", "upi_id"]}
        initialState={{
          sorting: [{ id: "name", desc: false }],
        }}
      />

      {/* Mobile FAB */}
      {isMobile && canEdit && (
        <Fab
          color="primary"
          sx={{ position: "fixed", bottom: 16, right: 16 }}
          onClick={() => handleOpenDialog()}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Tea Shop Drawer */}
      <CompanyTeaShopDrawer
        open={dialogOpen}
        onClose={handleCloseDialog}
        teaShop={editingShop}
      />

      {/* Assignment Dialog */}
      <TeaShopAssignmentDialog
        open={assignmentDialogOpen}
        onClose={handleCloseAssignmentDialog}
        teaShop={assigningShop}
      />
    </Box>
  );
}
