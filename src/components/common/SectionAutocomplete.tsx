"use client";

import React, { memo, useState, useEffect, useCallback } from "react";
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  ListSubheader,
} from "@mui/material";
import {
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  PlayCircleOutline as InProgressIcon,
  RadioButtonUnchecked as NotStartedIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";

export interface SectionOption {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "completed";
  isDefault: boolean;
  phaseName: string | null;
  phaseId: string | null;
  sequenceOrder: number;
}

export interface SectionAutocompleteProps {
  siteId: string;
  value: string | null;
  onChange: (sectionId: string | null) => void;
  onNameChange?: (name: string) => void;
  defaultSectionId?: string | null;
  includeCompleted?: boolean;
  showPhaseGroup?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  size?: "small" | "medium";
  label?: string;
  placeholder?: string;
  autoSelectDefault?: boolean;
  sx?: object;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />;
    case "in_progress":
      return <InProgressIcon sx={{ fontSize: 16, color: "primary.main" }} />;
    default:
      return <NotStartedIcon sx={{ fontSize: 16, color: "text.disabled" }} />;
  }
};

const getStatusColor = (
  status: string
): "success" | "primary" | "default" => {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
      return "primary";
    default:
      return "default";
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In Progress";
    default:
      return "Not Started";
  }
};

const SectionAutocomplete = memo(function SectionAutocomplete({
  siteId,
  value,
  onChange,
  onNameChange,
  defaultSectionId,
  includeCompleted = true,
  showPhaseGroup = true,
  disabled = false,
  error = false,
  helperText,
  size = "small",
  label = "Section",
  placeholder = "Select section...",
  autoSelectDefault = true,
  sx,
}: SectionAutocompleteProps) {
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const fetchSections = useCallback(async () => {
    if (!siteId) {
      setSections([]);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Fetch sections with phase info
      // Note: Using type assertion until migration is run and types regenerated
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("building_sections")
        .select(
          `
          id,
          name,
          status,
          sequence_order,
          construction_phase_id,
          construction_phases(id, name)
        `
        )
        .eq("site_id", siteId)
        .order("sequence_order") as { data: any[] | null; error: any };

      if (sectionsError) throw sectionsError;

      // Fetch site's default section
      // Note: Using type assertion until migration is run and types regenerated
      const { data: siteData } = await supabase
        .from("sites")
        .select("default_section_id")
        .eq("id", siteId)
        .single() as { data: { default_section_id: string | null } | null };

      const activeSectionId =
        defaultSectionId || siteData?.default_section_id || null;

      const mappedSections: SectionOption[] = (sectionsData || []).map(
        (section) => ({
          id: section.id,
          name: section.name,
          status: section.status as "not_started" | "in_progress" | "completed",
          isDefault: section.id === activeSectionId,
          phaseName:
            (section.construction_phases as { name: string } | null)?.name ||
            null,
          phaseId: section.construction_phase_id,
          sequenceOrder: section.sequence_order,
        })
      );

      // Filter out completed if not wanted
      const filteredSections = includeCompleted
        ? mappedSections
        : mappedSections.filter((s) => s.status !== "completed");

      // Sort: group by phase, then by sequence
      const sortedSections = [...filteredSections].sort((a, b) => {
        // First by phase (null phases go last)
        if (a.phaseName && !b.phaseName) return -1;
        if (!a.phaseName && b.phaseName) return 1;
        if (a.phaseName && b.phaseName && a.phaseName !== b.phaseName) {
          return a.phaseName.localeCompare(b.phaseName);
        }
        // Then by sequence order
        return a.sequenceOrder - b.sequenceOrder;
      });

      setSections(sortedSections);

      // Auto-select default section if no value is set
      if (autoSelectDefault && !value && activeSectionId) {
        const defaultSection = sortedSections.find(
          (s) => s.id === activeSectionId
        );
        if (defaultSection) {
          onChange(defaultSection.id);
          onNameChange?.(defaultSection.name);
        }
      }
    } catch (err) {
      console.error("Error fetching sections:", err);
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [siteId, defaultSectionId, includeCompleted, autoSelectDefault, value, onChange, onNameChange]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const selectedOption = sections.find((s) => s.id === value) || null;

  return (
    <Autocomplete
      value={selectedOption}
      onChange={(_, newValue) => {
        onChange(newValue?.id || null);
        onNameChange?.(newValue?.name || "");
      }}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue);
      }}
      options={sections}
      loading={loading}
      disabled={disabled}
      size={size}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      groupBy={showPhaseGroup ? (option) => option.phaseName || "Uncategorized" : undefined}
      renderGroup={
        showPhaseGroup
          ? (params) => (
              <li key={params.key}>
                <ListSubheader
                  component="div"
                  sx={{
                    bgcolor: "background.default",
                    fontWeight: 600,
                    color: "text.secondary",
                    lineHeight: "32px",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {params.group}
                </ListSubheader>
                <ul style={{ padding: 0 }}>{params.children}</ul>
              </li>
            )
          : undefined
      }
      renderOption={(props, option) => {
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
              py: 1,
              opacity: option.status === "completed" ? 0.7 : 1,
            }}
          >
            {/* Default star indicator */}
            {option.isDefault && (
              <StarIcon
                sx={{
                  fontSize: 18,
                  color: "#FFD700",
                  flexShrink: 0,
                }}
              />
            )}

            {/* Section name and phase */}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={option.isDefault ? 600 : 400}
                sx={{
                  textDecoration:
                    option.status === "completed" ? "line-through" : "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {option.name}
              </Typography>
              {!showPhaseGroup && option.phaseName && (
                <Typography variant="caption" color="text.secondary">
                  {option.phaseName}
                </Typography>
              )}
            </Box>

            {/* Status chip */}
            <Chip
              icon={getStatusIcon(option.status)}
              label={getStatusLabel(option.status)}
              size="small"
              color={getStatusColor(option.status)}
              variant={option.status === "not_started" ? "outlined" : "filled"}
              sx={{
                height: 22,
                fontSize: "0.65rem",
                flexShrink: 0,
                "& .MuiChip-icon": {
                  marginLeft: "4px",
                },
              }}
            />
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
            startAdornment: (
              <>
                {selectedOption?.isDefault && (
                  <StarIcon
                    sx={{
                      fontSize: 18,
                      color: "#FFD700",
                      mr: 0.5,
                    }}
                  />
                )}
                {params.InputProps.startAdornment}
              </>
            ),
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={18} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      sx={{
        ...sx,
        "& .MuiAutocomplete-listbox": {
          maxHeight: 300,
        },
      }}
      noOptionsText="No sections available"
      loadingText="Loading sections..."
    />
  );
});

export default SectionAutocomplete;
