"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  Grid,
  Typography,
  Link,
  CircularProgress,
} from "@mui/material";
import CategoryAutocomplete from "@/components/common/CategoryAutocomplete";
import type { MaterialCategory } from "@/types/material.types";

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  category?: MaterialCategory | null;
  isLoading?: boolean;
}

export interface CategoryFormData {
  name: string;
  code: string | null;
  description: string | null;
  parent_id: string | null;
  display_order: number;
}

export default function CategoryDialog({
  open,
  onClose,
  onSubmit,
  category,
  isLoading = false,
}: CategoryDialogProps) {
  const [customizeCode, setCustomizeCode] = useState(false);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    code: null,
    description: null,
    parent_id: null,
    display_order: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!category;

  // Generate code from name
  const generatedCode = useMemo(() => {
    if (!formData.name) return "";
    return formData.name
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .map((word) => word.substring(0, 3).toUpperCase())
      .join("-")
      .substring(0, 10);
  }, [formData.name]);

  // Reset form when dialog opens/closes or category changes
  useEffect(() => {
    if (open) {
      if (category) {
        setFormData({
          name: category.name,
          code: category.code,
          description: category.description,
          parent_id: category.parent_id,
          display_order: category.display_order,
        });
        setCustomizeCode(!!category.code);
      } else {
        setFormData({
          name: "",
          code: null,
          description: null,
          parent_id: null,
          display_order: 0,
        });
        setCustomizeCode(false);
      }
    }
  }, [open, category]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      const dataToSubmit = {
        ...formData,
        name: formData.name.trim(),
        code: customizeCode ? formData.code?.trim() || null : generatedCode || null,
        description: formData.description?.trim() || null,
      };
      await onSubmit(dataToSubmit);
      onClose();
    } catch (error) {
      console.error("Failed to save category:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" component="span" fontWeight={600}>
          {isEditing ? "Edit Category" : "Add New Category"}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={2.5} sx={{ pt: 1 }}>
          {/* Category Name */}
          <Grid size={12}>
            <TextField
              fullWidth
              label="Category Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              placeholder="e.g., Cement & Binding"
              helperText={
                !customizeCode && formData.name ? (
                  <>
                    Code: {generatedCode}{" "}
                    <Link
                      component="button"
                      variant="caption"
                      onClick={(e) => {
                        e.preventDefault();
                        setCustomizeCode(true);
                        setFormData({ ...formData, code: generatedCode });
                      }}
                    >
                      Customize
                    </Link>
                  </>
                ) : null
              }
            />
          </Grid>

          {/* Code (only if customizing) */}
          {customizeCode && (
            <Grid size={12}>
              <TextField
                fullWidth
                label="Category Code"
                value={formData.code || ""}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g., CEM-BIND"
                helperText={
                  <Link
                    component="button"
                    variant="caption"
                    onClick={(e) => {
                      e.preventDefault();
                      setCustomizeCode(false);
                      setFormData({ ...formData, code: null });
                    }}
                  >
                    Use auto-generated code
                  </Link>
                }
              />
            </Grid>
          )}

          {/* Parent Category */}
          <Grid size={12}>
            <FormControl fullWidth>
              <CategoryAutocomplete
                value={formData.parent_id}
                onChange={(id) => setFormData({ ...formData, parent_id: Array.isArray(id) ? id[0] : id })}
                parentOnly
                label="Parent Category (Optional)"
                placeholder="Select parent category for hierarchy..."
              />
            </FormControl>
          </Grid>

          {/* Description */}
          <Grid size={12}>
            <TextField
              fullWidth
              label="Description (Optional)"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              multiline
              rows={2}
              placeholder="Brief description of what materials belong in this category"
            />
          </Grid>

          {/* Display Order */}
          <Grid size={12}>
            <TextField
              fullWidth
              label="Display Order"
              type="number"
              value={formData.display_order}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  display_order: parseInt(e.target.value) || 0,
                })
              }
              helperText="Lower numbers appear first in lists"
              inputProps={{ min: 0 }}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.name.trim() || submitting || isLoading}
          startIcon={submitting ? <CircularProgress size={18} /> : null}
        >
          {isEditing ? "Save Changes" : "Add Category"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
