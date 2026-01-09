"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  IconButton,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Alert,
  Snackbar,
  Collapse,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Category as CategoryIcon,
  Inventory as InventoryIcon,
  FolderOpen as FolderOpenIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import CategoryDialog, { type CategoryFormData } from "@/components/categories/CategoryDialog";
import {
  useMaterialCategoryTree,
  useCreateMaterialCategory,
  useUpdateMaterialCategory,
  useDeleteMaterialCategory,
} from "@/hooks/queries/useMaterials";
import type { MaterialCategory, MaterialCategoryWithChildren } from "@/types/material.types";

// Helper to count total categories from tree
function countCategories(categories: MaterialCategoryWithChildren[]): number {
  let count = 0;
  for (const cat of categories) {
    count += 1;
    if (cat.children && cat.children.length > 0) {
      count += countCategories(cat.children as MaterialCategoryWithChildren[]);
    }
  }
  return count;
}

export default function CategoriesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MaterialCategory | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  // Only fetch tree - derive total count from it (eliminates duplicate query)
  const { data: categoriesTree, isLoading } = useMaterialCategoryTree();
  const createCategory = useCreateMaterialCategory();
  const updateCategory = useUpdateMaterialCategory();
  const deleteCategory = useDeleteMaterialCategory();

  // Total count derived from tree instead of separate query
  const totalCategoryCount = useMemo(() => {
    if (!categoriesTree) return 0;
    return countCategories(categoriesTree);
  }, [categoriesTree]);

  // Count materials per category (placeholder - would need actual data)
  const materialCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    return counts;
  }, []);

  const handleOpenDialog = useCallback((category?: MaterialCategory) => {
    setEditingCategory(category || null);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingCategory(null);
  }, []);

  const handleSubmit = useCallback(
    async (data: CategoryFormData) => {
      try {
        if (editingCategory) {
          await updateCategory.mutateAsync({
            id: editingCategory.id,
            data,
          });
          setSnackbar({
            open: true,
            message: `Category "${data.name}" updated successfully`,
            severity: "success",
          });
        } else {
          await createCategory.mutateAsync({
            ...data,
            is_active: true,
          });
          setSnackbar({
            open: true,
            message: `Category "${data.name}" created successfully`,
            severity: "success",
          });
        }
      } catch (error: any) {
        setSnackbar({
          open: true,
          message: error.message || "Failed to save category",
          severity: "error",
        });
        throw error;
      }
    },
    [editingCategory, createCategory, updateCategory]
  );

  const handleDelete = useCallback(
    async (category: MaterialCategory) => {
      if (
        !confirm(
          `Are you sure you want to delete "${category.name}"?\n\nAll materials in this category will be moved to "Miscellaneous".`
        )
      ) {
        return;
      }

      try {
        await deleteCategory.mutateAsync(category.id);
        setSnackbar({
          open: true,
          message: `Category "${category.name}" deleted. Materials moved to Miscellaneous.`,
          severity: "success",
        });
      } catch (error: any) {
        setSnackbar({
          open: true,
          message: error.message || "Failed to delete category",
          severity: "error",
        });
      }
    },
    [deleteCategory]
  );

  const toggleExpand = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  const renderCategory = (
    category: MaterialCategoryWithChildren,
    level: number = 0
  ) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const materialCount = materialCounts[category.id] || 0;

    return (
      <Box key={category.id}>
        <Card
          variant="outlined"
          sx={{
            ml: level * 3,
            mb: 1,
            borderLeftWidth: level > 0 ? 3 : 1,
            borderLeftColor: level > 0 ? "primary.main" : "divider",
            transition: "all 0.2s",
            "&:hover": {
              borderColor: "primary.main",
              boxShadow: 1,
            },
          }}
        >
          <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
                {hasChildren ? (
                  <IconButton
                    size="small"
                    onClick={() => toggleExpand(category.id)}
                    sx={{ p: 0.5 }}
                  >
                    {isExpanded ? (
                      <ExpandLessIcon fontSize="small" />
                    ) : (
                      <ExpandMoreIcon fontSize="small" />
                    )}
                  </IconButton>
                ) : (
                  <Box sx={{ width: 28 }} />
                )}

                {hasChildren ? (
                  <FolderOpenIcon color="primary" />
                ) : (
                  <CategoryIcon color="action" />
                )}

                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {category.name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {category.code && (
                      <Chip
                        label={category.code}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.7rem" }}
                      />
                    )}
                    {category.description && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {category.description}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center">
                {hasChildren && (
                  <Chip
                    icon={<CategoryIcon sx={{ fontSize: 14 }} />}
                    label={`${category.children!.length} sub`}
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ height: 24 }}
                  />
                )}
                {materialCount > 0 && (
                  <Chip
                    icon={<InventoryIcon sx={{ fontSize: 14 }} />}
                    label={`${materialCount} materials`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 24 }}
                  />
                )}
                <Tooltip title="Edit category">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(category)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete category">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(category)}
                    disabled={deleteCategory.isPending}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        {/* Child categories */}
        {hasChildren && (
          <Collapse in={isExpanded}>
            <Box>
              {category.children!.map((child) =>
                renderCategory(child as MaterialCategoryWithChildren, level + 1)
              )}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <PageHeader
        title="Material Categories"
        subtitle="Organize materials into categories for easier management"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Category
          </Button>
        }
      />

      {/* Stats */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2}>
          <Card sx={{ minWidth: 140 }}>
            <CardContent sx={{ py: 1.5, px: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Total Categories
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {totalCategoryCount}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 140 }}>
            <CardContent sx={{ py: 1.5, px: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Parent Categories
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {categoriesTree?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {/* Categories List */}
      {isLoading ? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">Loading categories...</Typography>
        </Box>
      ) : !categoriesTree || categoriesTree.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No categories found. Click "Add Category" to create your first category.
        </Alert>
      ) : (
        <Box>
          {categoriesTree.map((category) =>
            renderCategory(category)
          )}
        </Box>
      )}

      {/* Category Dialog */}
      <CategoryDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        category={editingCategory}
        isLoading={createCategory.isPending || updateCategory.isPending}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
