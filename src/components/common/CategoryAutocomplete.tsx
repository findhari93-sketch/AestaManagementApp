"use client";

import React, { memo } from "react";
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Checkbox,
  Chip,
  CircularProgress,
} from "@mui/material";
import { useMaterialCategories } from "@/hooks/queries/useMaterials";
import type { MaterialCategory } from "@/types/material.types";

export interface CategoryAutocompleteProps {
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  multiple?: boolean;
  parentOnly?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  size?: "small" | "medium";
  label?: string;
  placeholder?: string;
  sx?: object;
}

const CategoryAutocomplete = memo(function CategoryAutocomplete({
  value,
  onChange,
  multiple = false,
  parentOnly = true,
  disabled = false,
  error = false,
  helperText,
  size = "small",
  label = "Category",
  placeholder = "Search categories...",
  sx,
}: CategoryAutocompleteProps) {
  const { data: categories = [], isLoading } = useMaterialCategories();

  // Filter to parent categories only if requested
  const filteredCategories = parentOnly
    ? categories.filter((c) => !c.parent_id)
    : categories;

  // Sort categories - parents first, then children indented
  const sortedCategories = [...filteredCategories].sort((a, b) => {
    // First by display_order if available
    if (a.display_order !== b.display_order) {
      return (a.display_order || 0) - (b.display_order || 0);
    }
    // Then alphabetically
    return a.name.localeCompare(b.name);
  });

  // Get selected value(s)
  const getSelectedValue = () => {
    if (multiple) {
      const valueArray = Array.isArray(value) ? value : [];
      return sortedCategories.filter((c) => valueArray.includes(c.id));
    } else {
      return sortedCategories.find((c) => c.id === value) || null;
    }
  };

  const selectedValue = getSelectedValue();

  if (multiple) {
    return (
      <Autocomplete
        multiple
        disableCloseOnSelect
        value={selectedValue as MaterialCategory[]}
        onChange={(_, newValue) => {
          onChange((newValue as MaterialCategory[]).map((v) => v.id));
        }}
        options={sortedCategories}
        loading={isLoading}
        disabled={disabled}
        size={size}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, val) => option.id === val.id}
        renderOption={(props, option, { selected }) => {
          const { key, ...otherProps } = props;
          return (
            <Box
              component="li"
              key={key}
              {...otherProps}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Checkbox checked={selected} size="small" sx={{ p: 0.5 }} />
              <Typography variant="body2">{option.name}</Typography>
            </Box>
          );
        }}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return (
              <Chip
                key={key}
                label={option.name}
                size="small"
                {...tagProps}
                sx={{ maxWidth: 150 }}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={
              (selectedValue as MaterialCategory[])?.length > 0
                ? ""
                : placeholder
            }
            error={error}
            helperText={helperText}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {isLoading ? (
                    <CircularProgress color="inherit" size={18} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        slotProps={{
          popper: {
            sx: { minWidth: 250 },
          },
        }}
        sx={{
          ...sx,
          width: "100%",
        }}
        noOptionsText="No categories found"
        loadingText="Loading categories..."
      />
    );
  }

  // Single select mode
  return (
    <Autocomplete
      value={selectedValue as MaterialCategory | null}
      onChange={(_, newValue) => {
        onChange((newValue as MaterialCategory | null)?.id || null);
      }}
      options={sortedCategories}
      loading={isLoading}
      disabled={disabled}
      size={size}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        const isChild = !parentOnly && !!option.parent_id;
        return (
          <Box
            component="li"
            key={key}
            {...otherProps}
            sx={{
              display: "flex",
              alignItems: "center",
              pl: isChild ? 3 : 1,
            }}
          >
            {isChild && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                └
              </Typography>
            )}
            <Typography variant="body2">{option.name}</Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? (
                  <CircularProgress color="inherit" size={18} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      slotProps={{
        popper: {
          sx: { minWidth: 250 },
        },
      }}
      sx={{
        ...sx,
        width: "100%",
      }}
      noOptionsText="No categories found"
      loadingText="Loading categories..."
    />
  );
});

export default CategoryAutocomplete;
