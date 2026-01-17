"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  TextField,
  Button,
  Collapse,
  Paper,
  InputAdornment,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import type { MaterialBrand, BrandWithVariants } from "@/types/material.types";

// Category-specific suggested brands
const CATEGORY_BRAND_SUGGESTIONS: Record<string, string[]> = {
  // Cement categories (by name patterns)
  cement: ["Ultratech", "Dalmia", "Ramco", "Chettinad", "TNPL", "ACC", "Birla", "Ambuja"],
  ppc: ["Ultratech", "Dalmia", "Ramco", "Chettinad", "TNPL", "ACC", "Birla", "Ambuja"],
  opc: ["Ultratech", "Dalmia", "Ramco", "Chettinad", "TNPL", "ACC", "Birla", "Ambuja"],
  // Steel/TMT categories
  steel: ["TATA Tiscon", "JSW Neo", "Kamachi", "SAIL", "Vizag Steel", "Shyam Steel"],
  tmt: ["TATA Tiscon", "JSW Neo", "Kamachi", "SAIL", "Vizag Steel", "Shyam Steel"],
  // Paint categories
  paint: ["Asian Paints", "Berger", "Nerolac", "Dulux", "Nippon"],
  // Tiles categories
  tiles: ["Kajaria", "Somany", "Johnson", "Orient Bell", "RAK"],
  // Plumbing
  plumbing: ["Astral", "Supreme", "Finolex", "Prince", "Ashirvad"],
  pipes: ["Astral", "Supreme", "Finolex", "Prince", "Ashirvad"],
  // Electrical
  electrical: ["Havells", "Polycab", "Finolex", "KEI", "Anchor"],
  wire: ["Havells", "Polycab", "Finolex", "KEI", "RR Kabel"],
};

// Common cement brand variants
const BRAND_VARIANT_SUGGESTIONS: Record<string, string[]> = {
  dalmia: ["DSP", "Regular"],
  ramco: ["Grade", "Hard Worker", "Super Grade"],
  ultratech: ["Premium", "Weather Plus", "Super"],
  acc: ["Gold", "Suraksha"],
};

interface BrandVariantEditorProps {
  materialId: string;
  brands: MaterialBrand[];
  categoryName?: string | null;
  onAddBrand: (brandName: string, variantName?: string | null) => Promise<void>;
  onUpdateBrand: (brandId: string, data: { is_preferred?: boolean }) => Promise<void>;
  onDeleteBrand: (brand: MaterialBrand) => Promise<void>;
  disabled?: boolean;
}

export default function BrandVariantEditor({
  materialId,
  brands,
  categoryName,
  onAddBrand,
  onUpdateBrand,
  onDeleteBrand,
  disabled = false,
}: BrandVariantEditorProps) {
  const [newBrandName, setNewBrandName] = useState("");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [addingVariantFor, setAddingVariantFor] = useState<string | null>(null);
  const [newVariantName, setNewVariantName] = useState("");
  const [isAddingBrand, setIsAddingBrand] = useState(false);

  // Get suggested brands based on category
  const suggestedBrands = useMemo(() => {
    if (!categoryName) return [];
    const categoryLower = categoryName.toLowerCase();

    // Find matching category suggestions
    for (const [key, suggestions] of Object.entries(CATEGORY_BRAND_SUGGESTIONS)) {
      if (categoryLower.includes(key)) {
        // Filter out brands already added
        const existingBrandNames = new Set(brands.map(b => b.brand_name.toLowerCase()));
        return suggestions.filter(s => !existingBrandNames.has(s.toLowerCase()));
      }
    }
    return [];
  }, [categoryName, brands]);

  // Get variant suggestions for a brand
  const getVariantSuggestions = (brandName: string): string[] => {
    const brandLower = brandName.toLowerCase();
    const suggestions = BRAND_VARIANT_SUGGESTIONS[brandLower] || [];
    // Filter out variants already added for this brand
    const existingVariants = new Set(
      brands
        .filter(b => b.brand_name.toLowerCase() === brandLower && b.variant_name)
        .map(b => b.variant_name!.toLowerCase())
    );
    return suggestions.filter(s => !existingVariants.has(s.toLowerCase()));
  };

  // Group brands by brand_name
  const groupedBrands = useMemo((): BrandWithVariants[] => {
    const groups = new Map<string, BrandWithVariants>();

    for (const brand of brands.filter(b => b.is_active)) {
      const key = brand.brand_name.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, {
          brand_name: brand.brand_name,
          is_preferred: brand.is_preferred,
          variants: [],
        });
      }
      const group = groups.get(key)!;
      group.variants.push({
        id: brand.id,
        variant_name: brand.variant_name,
        quality_rating: brand.quality_rating,
        notes: brand.notes,
        is_active: brand.is_active,
      });
      // Mark group as preferred if any variant is preferred
      if (brand.is_preferred) {
        group.is_preferred = true;
      }
    }

    // Sort: preferred first, then alphabetically
    return Array.from(groups.values()).sort((a, b) => {
      if (a.is_preferred && !b.is_preferred) return -1;
      if (!a.is_preferred && b.is_preferred) return 1;
      return a.brand_name.localeCompare(b.brand_name);
    });
  }, [brands]);

  const toggleBrandExpanded = (brandName: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brandName)) {
        next.delete(brandName);
      } else {
        next.add(brandName);
      }
      return next;
    });
  };

  const handleAddBrand = async (brandName: string) => {
    if (!brandName.trim() || disabled) return;
    setIsAddingBrand(true);
    try {
      await onAddBrand(brandName.trim(), null);
      setNewBrandName("");
    } finally {
      setIsAddingBrand(false);
    }
  };

  const handleAddVariant = async (brandName: string, variantName: string) => {
    if (!variantName.trim() || disabled) return;
    try {
      await onAddBrand(brandName, variantName.trim());
      setNewVariantName("");
      setAddingVariantFor(null);
    } catch (error) {
      console.error("Failed to add variant:", error);
    }
  };

  const handleTogglePreferred = async (brand: MaterialBrand) => {
    if (disabled) return;
    await onUpdateBrand(brand.id, { is_preferred: !brand.is_preferred });
  };

  const handleDeleteBrand = async (brand: MaterialBrand) => {
    if (disabled) return;
    const displayName = brand.variant_name
      ? `${brand.brand_name} - ${brand.variant_name}`
      : brand.brand_name;
    if (!confirm(`Delete "${displayName}"?`)) return;
    await onDeleteBrand(brand);
  };

  // Find the MaterialBrand object for a given brand name (for delete/update)
  const findBrandByNameAndVariant = (brandName: string, variantName: string | null): MaterialBrand | undefined => {
    return brands.find(
      b => b.brand_name.toLowerCase() === brandName.toLowerCase() &&
           b.variant_name === variantName &&
           b.is_active
    );
  };

  return (
    <Box>
      {/* Suggested Brands - Quick Add */}
      {suggestedBrands.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
            Quick Add:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {suggestedBrands.slice(0, 8).map((brand) => (
              <Chip
                key={brand}
                label={brand}
                size="small"
                variant="outlined"
                onClick={() => handleAddBrand(brand)}
                disabled={disabled || isAddingBrand}
                sx={{ cursor: "pointer" }}
              />
            ))}
            <Chip
              label="+ Other"
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => document.getElementById("new-brand-input")?.focus()}
              sx={{ cursor: "pointer" }}
            />
          </Box>
        </Box>
      )}

      {/* Grouped Brands List */}
      {groupedBrands.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {groupedBrands.map((group) => {
            const isExpanded = expandedBrands.has(group.brand_name);
            const hasVariants = group.variants.some(v => v.variant_name);
            const variantSuggestions = getVariantSuggestions(group.brand_name);

            return (
              <Paper
                key={group.brand_name}
                variant="outlined"
                sx={{ mb: 1, overflow: "hidden" }}
              >
                {/* Brand Header */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    px: 1.5,
                    py: 1,
                    bgcolor: group.is_preferred ? "primary.50" : "transparent",
                    borderBottom: isExpanded ? 1 : 0,
                    borderColor: "divider",
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => toggleBrandExpanded(group.brand_name)}
                    sx={{ mr: 0.5 }}
                  >
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>

                  <Tooltip title={group.is_preferred ? "Preferred brand" : "Mark as preferred"}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        // Toggle preferred on the first variant (or generic brand)
                        const mainBrand = findBrandByNameAndVariant(group.brand_name, null) ||
                                         findBrandByNameAndVariant(group.brand_name, group.variants[0]?.variant_name || null);
                        if (mainBrand) handleTogglePreferred(mainBrand);
                      }}
                      sx={{ mr: 1 }}
                      disabled={disabled}
                    >
                      {group.is_preferred ? (
                        <StarIcon fontSize="small" color="warning" />
                      ) : (
                        <StarBorderIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>

                  <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                    {group.brand_name}
                  </Typography>

                  {group.variants.length > 1 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                      {group.variants.filter(v => v.variant_name).length} variants
                    </Typography>
                  )}

                  <IconButton
                    size="small"
                    onClick={() => {
                      // Delete all variants of this brand
                      const mainBrand = findBrandByNameAndVariant(group.brand_name, null);
                      if (mainBrand) handleDeleteBrand(mainBrand);
                      else if (group.variants.length === 1) {
                        const onlyVariant = findBrandByNameAndVariant(group.brand_name, group.variants[0].variant_name);
                        if (onlyVariant) handleDeleteBrand(onlyVariant);
                      }
                    }}
                    disabled={disabled}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Expanded Content - Variants */}
                <Collapse in={isExpanded}>
                  <Box sx={{ px: 2, py: 1.5, bgcolor: "grey.50" }}>
                    {/* Existing Variants */}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                      {group.variants.map((variant) => (
                        <Chip
                          key={variant.id}
                          label={variant.variant_name || "Standard"}
                          size="small"
                          variant={variant.variant_name ? "filled" : "outlined"}
                          color={variant.variant_name ? "default" : "secondary"}
                          onDelete={() => {
                            const brand = findBrandByNameAndVariant(group.brand_name, variant.variant_name);
                            if (brand) handleDeleteBrand(brand);
                          }}
                          disabled={disabled}
                        />
                      ))}
                    </Box>

                    {/* Variant Suggestions */}
                    {variantSuggestions.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Add variant:
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                          {variantSuggestions.map((variant) => (
                            <Chip
                              key={variant}
                              label={`+ ${variant}`}
                              size="small"
                              variant="outlined"
                              color="primary"
                              onClick={() => handleAddVariant(group.brand_name, variant)}
                              disabled={disabled}
                              sx={{ cursor: "pointer" }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Add Custom Variant */}
                    {addingVariantFor === group.brand_name ? (
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        <TextField
                          size="small"
                          placeholder="Variant name..."
                          value={newVariantName}
                          onChange={(e) => setNewVariantName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddVariant(group.brand_name, newVariantName);
                            } else if (e.key === "Escape") {
                              setAddingVariantFor(null);
                              setNewVariantName("");
                            }
                          }}
                          autoFocus
                          sx={{ flex: 1 }}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setAddingVariantFor(null);
                                    setNewVariantName("");
                                  }}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleAddVariant(group.brand_name, newVariantName)}
                          disabled={!newVariantName.trim() || disabled}
                        >
                          Add
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setAddingVariantFor(group.brand_name)}
                        disabled={disabled}
                        sx={{ mt: 0.5 }}
                      >
                        Add variant
                      </Button>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Add New Brand */}
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          id="new-brand-input"
          size="small"
          placeholder="Add brand name..."
          value={newBrandName}
          onChange={(e) => setNewBrandName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddBrand(newBrandName);
            }
          }}
          sx={{ flex: 1 }}
          disabled={disabled}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => handleAddBrand(newBrandName)}
          disabled={!newBrandName.trim() || disabled || isAddingBrand}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}
