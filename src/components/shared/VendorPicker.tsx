"use client";

import React, { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import {
  AddCircleOutline as AddIcon,
  Storefront as StorefrontIcon,
} from "@mui/icons-material";
import { useVendors } from "@/hooks/queries/useVendors";
import type { VendorWithCategories } from "@/types/material.types";

const CREATE_NEW_ID = "__create_new_vendor__";

interface CreateNewSentinel {
  id: typeof CREATE_NEW_ID;
  isSentinel: true;
  searchTerm: string;
}

type Option = VendorWithCategories | CreateNewSentinel;

function isSentinel(o: Option): o is CreateNewSentinel {
  return (o as CreateNewSentinel).isSentinel === true;
}

interface VendorPickerProps {
  value: VendorWithCategories | null;
  onChange: (vendor: VendorWithCategories | null) => void;
  onCreateNew?: (searchTerm: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  inDialog?: boolean;
  required?: boolean;
}

export function VendorPicker({
  value,
  onChange,
  onCreateNew,
  disabled,
  label = "Vendor",
  placeholder = "Search vendors…",
  error,
  helperText,
  inDialog = false,
  required = false,
}: VendorPickerProps) {
  const theme = useTheme();
  const [inputValue, setInputValue] = useState("");
  const { data: vendors = [], isLoading } = useVendors();

  const options: Option[] = useMemo(() => {
    const base: Option[] = vendors;
    if (onCreateNew && inputValue.trim().length >= 1) {
      return [
        ...base,
        { id: CREATE_NEW_ID, isSentinel: true, searchTerm: inputValue.trim() },
      ];
    }
    return base;
  }, [vendors, inputValue, onCreateNew]);

  return (
    <Autocomplete<Option, false, false, false>
      value={value}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      onChange={(_, next) => {
        if (!next) {
          onChange(null);
          return;
        }
        if (isSentinel(next)) {
          onCreateNew?.(next.searchTerm);
          setInputValue("");
          return;
        }
        onChange(next);
      }}
      options={options}
      loading={isLoading}
      disabled={disabled}
      getOptionLabel={(option) => (isSentinel(option) ? "" : option.name)}
      isOptionEqualToValue={(option, val) => {
        if (isSentinel(option) || isSentinel(val as Option)) return false;
        return (option as VendorWithCategories).id === (val as VendorWithCategories).id;
      }}
      filterOptions={(opts, state) => {
        const q = state.inputValue.trim().toLowerCase();
        const filtered = opts.filter((o) => {
          if (isSentinel(o)) return true;
          return (
            o.name.toLowerCase().includes(q) ||
            (o.shop_name || "").toLowerCase().includes(q) ||
            (o.city || "").toLowerCase().includes(q) ||
            (o.phone || "").includes(q) ||
            (o.code || "").toLowerCase().includes(q)
          );
        });
        return filtered;
      }}
      renderOption={(props, option) => {
        if (isSentinel(option)) {
          return (
            <Box
              component="li"
              {...props}
              key={option.id}
              sx={{
                ...props.style,
                display: "flex",
                alignItems: "center",
                gap: 1,
                color: theme.palette.primary.main,
                fontWeight: 600,
                fontSize: 13,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <AddIcon fontSize="small" />
              Create new vendor
              {option.searchTerm ? (
                <Typography
                  component="span"
                  sx={{ fontSize: 12, color: "text.secondary", ml: 0.5 }}
                >
                  &ldquo;{option.searchTerm}&rdquo;
                </Typography>
              ) : null}
            </Box>
          );
        }
        return (
          <Box
            component="li"
            {...props}
            key={option.id}
            sx={{ ...props.style, display: "flex", alignItems: "center", gap: 1 }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.secondary.main, 0.12),
                color: theme.palette.secondary.dark,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <StorefrontIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {option.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: 10.5,
                  color: "text.secondary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {[option.shop_name, option.city, option.phone].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
          size="small"
        />
      )}
      slotProps={
        inDialog
          ? { popper: { disablePortal: false } }
          : undefined
      }
    />
  );
}
