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
  Collapse,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Store as StoreIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccountTree as VariantIcon,
  List as ListIcon,
  ViewModule as GroupIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasEditPermission } from "@/lib/permissions";
import {
  useMaterials,
  useMaterialsGrouped,
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
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const { userProfile } = useAuth();
  const isMobile = useIsMobile();
  const canEdit = hasEditPermission(userProfile?.role);

  const { data: materials = [], isLoading: isLoadingFlat } = useMaterials(
    categoryFilter || null
  );
  const { data: groupedMaterials = [], isLoading: isLoadingGrouped } = useMaterialsGrouped(
    categoryFilter || null
  );
  const { data: categories = [] } = useMaterialCategories();
  const { data: vendorCounts = {} } = useMaterialVendorCounts();
  const deleteMaterial = useDeleteMaterial();

  const isLoading = viewMode === "grouped" ? isLoadingGrouped : isLoadingFlat;

  // Toggle expanded state for a parent material
  const toggleExpanded = useCallback((id: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Filter materials by search term (flat list)
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

  // Filter grouped materials by search term
  const filteredGroupedMaterials = useMemo(() => {
    if (!searchTerm) return groupedMaterials;
    const term = searchTerm.toLowerCase();
    return groupedMaterials.filter((m) => {
      // Check if parent matches
      const parentMatches =
        m.name.toLowerCase().includes(term) ||
        m.code?.toLowerCase().includes(term) ||
        m.category?.name?.toLowerCase().includes(term);

      // Check if any variant matches
      const variantMatches = m.variants?.some(
        (v) =>
          v.name.toLowerCase().includes(term) ||
          v.code?.toLowerCase().includes(term)
      );

      return parentMatches || variantMatches;
    });
  }, [groupedMaterials, searchTerm]);

  // Flatten grouped materials for display (parents + expanded variants)
  const displayMaterials = useMemo(() => {
    if (viewMode === "list") {
      return filteredMaterials;
    }

    // For grouped view, create a flat list with parents and their variants
    const result: (MaterialWithDetails & { _isVariant?: boolean; _parentName?: string })[] = [];
    for (const parent of filteredGroupedMaterials) {
      result.push(parent);
      if (expandedParents.has(parent.id) && parent.variants) {
        for (const variant of parent.variants) {
          result.push({ ...variant, _isVariant: true, _parentName: parent.name });
        }
      }
    }
    return result;
  }, [viewMode, filteredMaterials, filteredGroupedMaterials, expandedParents]);

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
  const columns = useMemo<MRT_ColumnDef<MaterialWithDetails & { _isVariant?: boolean; _parentName?: string }>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Material Name",
        size: 250,
        Cell: ({ row }) => {
          const isVariant = (row.original as any)._isVariant;
          const hasVariants = (row.original.variant_count || 0) > 0;
          const isExpanded = expandedParents.has(row.original.id);

          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {/* Expand/Collapse button for parents with variants (grouped view only) */}
              {viewMode === "grouped" && hasVariants && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(row.original.id);
                  }}
                  sx={{ p: 0.5 }}
                >
                  {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
              )}
              {/* Indent for variants */}
              {isVariant && <Box sx={{ width: 24, ml: 2 }} />}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {isVariant && (
                    <VariantIcon fontSize="small" color="action" sx={{ opacity: 0.6 }} />
                  )}
                  <Link
                    component="button"
                    variant="body2"
                    fontWeight={500}
                    onClick={() => router.push(`/company/materials/${row.original.id}`)}
                    sx={{ textAlign: "left", cursor: "pointer" }}
                  >
                    {row.original.name}
                  </Link>
                  {hasVariants && (
                    <Chip
                      label={`${row.original.variant_count} variant${row.original.variant_count === 1 ? "" : "s"}`}
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
                    />
                  )}
                </Box>
                {row.original.code && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {row.original.code}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        },
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
    [vendorCounts, router, viewMode, expandedParents, toggleExpanded]
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
          alignItems: isMobile ? "stretch" : "center",
          flexWrap: "wrap",
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
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value) => value && setViewMode(value)}
          size="small"
        >
          <ToggleButton value="grouped">
            <Tooltip title="Grouped View (with variants)">
              <GroupIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="list">
            <Tooltip title="Flat List">
              <ListIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={displayMaterials}
        isLoading={isLoading}
        enableRowActions={canEdit}
        renderRowActions={renderRowActions}
        mobileHiddenColumns={["gst_rate", "reorder_level", "brands"]}
        initialState={{
          sorting: viewMode === "list" ? [{ id: "name", desc: false }] : [],
        }}
        enableSorting={viewMode === "list"}
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
