"use client";

import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Chip,
  Stack,
} from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";
import { useEquipmentCategories } from "@/hooks/queries/useEquipment";
import { useSitesData } from "@/contexts/SiteContext";
import type {
  EquipmentFilterState,
  EquipmentStatus,
  EquipmentLocationType,
} from "@/types/equipment.types";
import {
  EQUIPMENT_STATUS_LABELS,
  LOCATION_TYPE_LABELS,
} from "@/types/equipment.types";

interface EquipmentFilterBarProps {
  filters: EquipmentFilterState;
  onChange: (filters: EquipmentFilterState) => void;
  showSiteFilter?: boolean;
}

export default function EquipmentFilterBar({
  filters,
  onChange,
  showSiteFilter = true,
}: EquipmentFilterBarProps) {
  const { data: categories = [] } = useEquipmentCategories();
  const { sites = [] } = useSitesData();

  const handleChange = (key: keyof EquipmentFilterState, value: unknown) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({
      search: "",
      category_id: undefined,
      status: "all",
      location_type: "all",
      site_id: undefined,
    });
  };

  const hasActiveFilters =
    filters.category_id ||
    (filters.status && filters.status !== "all") ||
    (filters.location_type && filters.location_type !== "all") ||
    filters.site_id ||
    filters.search;

  return (
    <Box sx={{ mb: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        flexWrap="wrap"
        useFlexGap
      >
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search equipment..."
          value={filters.search || ""}
          onChange={(e) => handleChange("search", e.target.value)}
          sx={{ minWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Category */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={filters.category_id || ""}
            label="Category"
            onChange={(e) => handleChange("category_id", e.target.value || undefined)}
          >
            <MenuItem value="">All Categories</MenuItem>
            {categories
              .filter((c) => c.code !== "ACC")
              .map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {/* Status */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filters.status || "all"}
            label="Status"
            onChange={(e) =>
              handleChange("status", e.target.value as EquipmentStatus | "all")
            }
          >
            <MenuItem value="all">All Status</MenuItem>
            {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Location Type */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Location</InputLabel>
          <Select
            value={filters.location_type || "all"}
            label="Location"
            onChange={(e) =>
              handleChange(
                "location_type",
                e.target.value as EquipmentLocationType | "all"
              )
            }
          >
            <MenuItem value="all">All Locations</MenuItem>
            {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Site (when at site) */}
        {showSiteFilter && filters.location_type === "site" && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Site</InputLabel>
            <Select
              value={filters.site_id || ""}
              label="Site"
              onChange={(e) => handleChange("site_id", e.target.value || undefined)}
            >
              <MenuItem value="">All Sites</MenuItem>
              {sites.map((site) => (
                <MenuItem key={site.id} value={site.id}>
                  {site.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <Chip
            label="Clear filters"
            onDelete={clearFilters}
            deleteIcon={<ClearIcon />}
            size="small"
            variant="outlined"
          />
        )}
      </Stack>
    </Box>
  );
}
