"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Fab,
  Tooltip,
  Link,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Store as StoreIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasEditPermission } from "@/lib/permissions";
import {
  useMaterials,
  useMaterialCategories,
  useDeleteMaterial,
} from "@/hooks/queries/useMaterials";
import { useMaterialVendorCounts } from "@/hooks/queries/useVendorInventory";
import MaterialDialog from "@/components/materials/MaterialDialog";
import type {
  MaterialWithDetails,
  MaterialCategory,
  MaterialUnit,
  MATERIAL_UNIT_LABELS,
} from "@/types/material.types";

const UNIT_LABELS: Record<MaterialUnit, string> = {
  kg: "Kg",
  g: "Gram",
  ton: "Ton",
  liter: "Ltr",
  ml: "ml",
  piece: "Pcs",
  bag: "Bag",
  bundle: "Bundle",
  sqft: "Sqft",
  sqm: "Sqm",
  cft: "Cft",
  cum: "Cum",
  nos: "Nos",
  rmt: "Rmt",
  box: "Box",
  set: "Set",
};

export default function MaterialsPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] =
    useState<MaterialWithDetails | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const { userProfile } = useAuth();
  const isMobile = useIsMobile();
  const canEdit = hasEditPermission(userProfile?.role);

  const { data: materials = [], isLoading } = useMaterials(
    categoryFilter || null
  );
  const { data: categories = [] } = useMaterialCategories();
  const { data: vendorCounts = {} } = useMaterialVendorCounts();
  const deleteMaterial = useDeleteMaterial();

  // Filter materials by search term
  const filteredMaterials = useMemo(() => {
    if (!searchTerm) return materials;
    const term = searchTerm.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.code?.toLowerCase().includes(term) ||
        m.category?.name?.toLowerCase().includes(term)
    );
  }, [materials, searchTerm]);

  const handleOpenDialog = useCallback(
    (material?: MaterialWithDetails) => {
      if (material) {
        setEditingMaterial(material);
      } else {
        setEditingMaterial(null);
      }
      setDialogOpen(true);
    },
    []
  );

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingMaterial(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Are you sure you want to delete this material?")) return;
      try {
        await deleteMaterial.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete material:", error);
      }
    },
    [deleteMaterial]
  );

  // Table columns
  const columns = useMemo<MRT_ColumnDef<MaterialWithDetails>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Material Name",
        size: 200,
        Cell: ({ row }) => (
          <Box>
            <Link
              component="button"
              variant="body2"
              fontWeight={500}
              onClick={() => router.push(`/company/materials/${row.original.id}`)}
              sx={{ textAlign: "left", cursor: "pointer" }}
            >
              {row.original.name}
            </Link>
            {row.original.code && (
              <Typography variant="caption" color="text.secondary" display="block">
                {row.original.code}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "category.name",
        header: "Category",
        size: 150,
        Cell: ({ row }) =>
          row.original.category?.name ? (
            <Chip
              label={row.original.category.name}
              size="small"
              variant="outlined"
            />
          ) : (
            "-"
          ),
      },
      {
        accessorKey: "unit",
        header: "Unit",
        size: 80,
        Cell: ({ row }) => UNIT_LABELS[row.original.unit] || row.original.unit,
      },
      {
        id: "vendors",
        header: "Vendors",
        size: 100,
        enableSorting: false,
        Cell: ({ row }) => {
          const count = vendorCounts[row.original.id] || 0;
          return count > 0 ? (
            <Chip
              icon={<StoreIcon />}
              label={count}
              size="small"
              color="primary"
              variant="outlined"
              onClick={() => router.push(`/company/materials/${row.original.id}?tab=vendors`)}
              clickable
            />
          ) : (
            <Typography variant="caption" color="text.secondary">
              None
            </Typography>
          );
        },
      },
      {
        accessorKey: "gst_rate",
        header: "GST %",
        size: 80,
        Cell: ({ row }) =>
          row.original.gst_rate ? `${row.original.gst_rate}%` : "-",
      },
      {
        accessorKey: "reorder_level",
        header: "Reorder Level",
        size: 120,
        Cell: ({ row }) =>
          row.original.reorder_level
            ? `${row.original.reorder_level} ${UNIT_LABELS[row.original.unit] || row.original.unit}`
            : "-",
      },
      {
        accessorKey: "brands",
        header: "Brands",
        size: 150,
        enableSorting: false,
        Cell: ({ row }) => {
          const brands = row.original.brands?.filter((b) => b.is_active) || [];
          if (brands.length === 0) return "-";
          return (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {brands.slice(0, 3).map((brand) => (
                <Chip
                  key={brand.id}
                  label={brand.brand_name}
                  size="small"
                  color={brand.is_preferred ? "primary" : "default"}
                  variant={brand.is_preferred ? "filled" : "outlined"}
                />
              ))}
              {brands.length > 3 && (
                <Chip label={`+${brands.length - 3}`} size="small" />
              )}
            </Box>
          );
        },
      },
    ],
    [vendorCounts, router]
  );

  // Row actions
  const renderRowActions = useCallback(
    ({ row }: { row: { original: MaterialWithDetails } }) => (
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
        title="Material Catalog"
        actions={
          !isMobile && canEdit ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Material
            </Button>
          ) : null
        }
      />

      {/* Filters */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 2,
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <TextField
          size="small"
          placeholder="Search materials..."
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
          sx={{ minWidth: 250 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            label="Category"
          >
            <MenuItem value="">All Categories</MenuItem>
            {categories
              .filter((c) => !c.parent_id)
              .map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Box>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredMaterials}
        isLoading={isLoading}
        enableRowActions={canEdit}
        renderRowActions={renderRowActions}
        mobileHiddenColumns={["gst_rate", "reorder_level", "brands"]}
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

      {/* Material Dialog */}
      <MaterialDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        material={editingMaterial}
        categories={categories}
      />
    </Box>
  );
}
