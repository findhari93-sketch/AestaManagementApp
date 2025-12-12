"use client";

import { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  Chip,
} from "@mui/material";
import {
  Work as WorkIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import MorningUpdateForm from "./MorningUpdateForm";
import EveningUpdateForm from "./EveningUpdateForm";
import FullDayUpdateForm from "./FullDayUpdateForm";
import {
  WorkUpdates,
  MorningUpdate,
  EveningUpdate,
  createEmptyWorkUpdates,
} from "@/types/work-updates.types";
import { SupabaseClient } from "@supabase/supabase-js";

interface WorkUpdatesSectionProps {
  supabase: SupabaseClient;
  siteId: string;
  date: string;
  mode: "morning" | "evening" | "full";
  initialData?: WorkUpdates | null;
  onChange: (data: WorkUpdates | null) => void;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  disabled?: boolean;
}

export default function WorkUpdatesSection({
  supabase,
  siteId,
  date,
  mode,
  initialData,
  onChange,
  expanded = false,
  onExpandChange,
  disabled = false,
}: WorkUpdatesSectionProps) {
  const [workUpdates, setWorkUpdates] = useState<WorkUpdates>(
    initialData || createEmptyWorkUpdates(3)
  );

  const handleMorningChange = useCallback(
    (morning: MorningUpdate | null) => {
      setWorkUpdates((prev) => {
        const updated = { ...prev, morning };
        // Use setTimeout to avoid calling onChange during render
        setTimeout(() => {
          onChange(updated.morning || updated.evening ? updated : null);
        }, 0);
        return updated;
      });
    },
    [onChange]
  );

  const handleEveningChange = useCallback(
    (evening: EveningUpdate | null) => {
      setWorkUpdates((prev) => {
        const updated = { ...prev, evening };
        setTimeout(() => {
          onChange(updated.morning || updated.evening ? updated : null);
        }, 0);
        return updated;
      });
    },
    [onChange]
  );

  const handlePhotoCountChange = useCallback(
    (photoCount: number) => {
      setWorkUpdates((prev) => {
        const updated = { ...prev, photoCount };
        setTimeout(() => {
          onChange(updated);
        }, 0);
        return updated;
      });
    },
    [onChange]
  );

  // Full day mode handler - simpler, just stores work updates directly
  const handleFullDayChange = useCallback(
    (data: WorkUpdates | null) => {
      if (data) {
        setWorkUpdates(data);
        setTimeout(() => onChange(data), 0);
      } else {
        const empty = createEmptyWorkUpdates(workUpdates.photoCount);
        setWorkUpdates(empty);
        setTimeout(() => onChange(null), 0);
      }
    },
    [onChange, workUpdates.photoCount]
  );

  // Determine status badge
  const getStatusBadge = () => {
    const hasMorning =
      workUpdates.morning &&
      (workUpdates.morning.description || workUpdates.morning.photos.length > 0);
    const hasEvening =
      workUpdates.evening &&
      (workUpdates.evening.summary ||
        workUpdates.evening.completionPercent > 0 ||
        workUpdates.evening.photos.length > 0);

    if (hasMorning && hasEvening) {
      return (
        <Chip
          label="Complete"
          size="small"
          color="success"
          variant="outlined"
        />
      );
    }
    if (hasMorning || hasEvening) {
      return (
        <Chip
          label="Partial"
          size="small"
          color="warning"
          variant="outlined"
        />
      );
    }
    return null;
  };

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        bgcolor: "action.hover",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "grey.200",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => onExpandChange?.(!expanded)}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WorkIcon color="action" />
          <Typography variant="subtitle1" fontWeight={600}>
            Work Updates
          </Typography>
          {getStatusBadge()}
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          {/* Morning Mode */}
          {mode === "morning" && (
            <MorningUpdateForm
              supabase={supabase}
              siteId={siteId}
              date={date}
              initialData={workUpdates.morning}
              photoCount={workUpdates.photoCount}
              onPhotoCountChange={handlePhotoCountChange}
              onChange={handleMorningChange}
              disabled={disabled}
            />
          )}

          {/* Evening Mode */}
          {mode === "evening" && (
            <EveningUpdateForm
              supabase={supabase}
              siteId={siteId}
              date={date}
              morningData={workUpdates.morning}
              initialData={workUpdates.evening}
              photoCount={workUpdates.photoCount}
              onChange={handleEveningChange}
              disabled={disabled}
            />
          )}

          {/* Full Mode - Simple photo gallery for historical data */}
          {mode === "full" && (
            <FullDayUpdateForm
              supabase={supabase}
              siteId={siteId}
              date={date}
              initialData={workUpdates}
              photoCount={workUpdates.photoCount}
              onPhotoCountChange={handlePhotoCountChange}
              onChange={handleFullDayChange}
              disabled={disabled}
            />
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

// Export types for use in AttendanceDrawer
export type { WorkUpdates, MorningUpdate, EveningUpdate };
