"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  Typography,
  Slider,
  Divider,
  Paper,
  Chip,
  LinearProgress,
} from "@mui/material";
import {
  WbSunny as MorningIcon,
  NightsStay as EveningIcon,
} from "@mui/icons-material";
import PhotoSlot from "./PhotoSlot";
import PhotoThumbnailStrip from "./PhotoThumbnailStrip";
import PhotoFullscreenDialog from "./PhotoFullscreenDialog";
import {
  MorningUpdate,
  EveningUpdate,
  PhotoSlotState,
  createPhotoSlots,
  photoSlotsToPhotos,
  photosToPhotoSlots,
} from "@/types/work-updates.types";
import { SupabaseClient } from "@supabase/supabase-js";

interface EveningUpdateFormProps {
  supabase: SupabaseClient;
  siteId: string;
  date: string;
  morningData: MorningUpdate | null;
  initialData?: EveningUpdate | null;
  photoCount: number;
  onChange: (data: EveningUpdate | null) => void;
  disabled?: boolean;
}

const progressMarks = [
  { value: 0, label: "0%" },
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
];

export default function EveningUpdateForm({
  supabase,
  siteId,
  date,
  morningData,
  initialData,
  photoCount,
  onChange,
  disabled = false,
}: EveningUpdateFormProps) {
  const [completionPercent, setCompletionPercent] = useState(
    initialData?.completionPercent || 0
  );
  const [summary, setSummary] = useState(initialData?.summary || "");
  const [photoSlots, setPhotoSlots] = useState<PhotoSlotState[]>(
    initialData?.photos
      ? photosToPhotoSlots(initialData.photos, photoCount)
      : createPhotoSlots(photoCount)
  );
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  // Use ref to avoid onChange in useEffect dependencies
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Update slots when photo count changes
  useEffect(() => {
    setPhotoSlots((prev) => {
      const newSlots = createPhotoSlots(photoCount);
      prev.forEach((slot, index) => {
        if (index < newSlots.length && slot.photo) {
          newSlots[index] = slot;
        }
      });
      return newSlots;
    });
  }, [photoCount]);

  // Emit changes to parent
  useEffect(() => {
    const photos = photoSlotsToPhotos(photoSlots);
    if (completionPercent === 0 && !summary.trim() && photos.length === 0) {
      onChangeRef.current(null);
    } else {
      onChangeRef.current({
        completionPercent,
        summary: summary.trim(),
        photos,
        timestamp: new Date().toISOString(),
      });
    }
  }, [completionPercent, summary, photoSlots]);

  const handlePhotoCapture = (slotIndex: number, url: string) => {
    setPhotoSlots((prev) =>
      prev.map((slot, i) =>
        i === slotIndex
          ? {
              ...slot,
              photo: {
                id: String(slotIndex + 1),
                url,
                uploadedAt: new Date().toISOString(),
              },
            }
          : slot
      )
    );
  };

  const handlePhotoRemove = (slotIndex: number) => {
    setPhotoSlots((prev) =>
      prev.map((slot, i) =>
        i === slotIndex ? { ...slot, photo: null } : slot
      )
    );
  };

  const handleMorningPhotoClick = (index: number) => {
    setFullscreenIndex(index);
    setFullscreenOpen(true);
  };

  const getProgressColor = (value: number) => {
    if (value >= 80) return "success";
    if (value >= 50) return "warning";
    return "error";
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Morning Recap Section */}
      {morningData && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            bgcolor: "warning.50",
            borderColor: "warning.200",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <MorningIcon sx={{ fontSize: 18, color: "warning.main" }} />
            <Typography variant="subtitle2" color="warning.dark">
              Morning Plan
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {morningData.description || "No description provided"}
          </Typography>
          {morningData.photos.length > 0 && (
            <PhotoThumbnailStrip
              photos={morningData.photos}
              size="small"
              onPhotoClick={handleMorningPhotoClick}
            />
          )}
        </Paper>
      )}

      <Divider>
        <Chip
          icon={<EveningIcon sx={{ fontSize: 16 }} />}
          label="Evening Update"
          size="small"
          color="info"
        />
      </Divider>

      {/* Completion Percentage Slider */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            Work Completed Today
          </Typography>
          <Chip
            label={`${completionPercent}%`}
            size="small"
            color={getProgressColor(completionPercent)}
          />
        </Box>
        <Slider
          value={completionPercent}
          onChange={(_, value) => setCompletionPercent(value as number)}
          min={0}
          max={100}
          step={5}
          marks={progressMarks}
          valueLabelDisplay="auto"
          disabled={disabled}
          sx={{
            color: `${getProgressColor(completionPercent)}.main`,
            "& .MuiSlider-markLabel": {
              fontSize: "0.7rem",
            },
          }}
        />
      </Box>

      {/* Evening Summary */}
      <TextField
        fullWidth
        multiline
        rows={2}
        size="small"
        label="What happened today?"
        placeholder="e.g., Plastering completed. Electrical delayed due to material shortage..."
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        disabled={disabled}
      />

      {/* Evening Photos */}
      {morningData?.photos && morningData.photos.length > 0 && (
        <Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
          >
            Progress Photos
            <Typography variant="caption" color="text.disabled">
              (Take from same angles as morning)
            </Typography>
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            {photoSlots.map((slot, index) => (
              <PhotoSlot
                key={slot.id}
                supabase={supabase}
                siteId={siteId}
                date={date}
                period="evening"
                slotIndex={index + 1}
                photoUrl={slot.photo?.url || null}
                description=""
                onPhotoCapture={(url) => handlePhotoCapture(index, url)}
                onPhotoRemove={() => handlePhotoRemove(index)}
                onDescriptionChange={() => {}}
                showDescription={false}
                disabled={disabled}
                compact
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Fullscreen viewer for morning photos */}
      <PhotoFullscreenDialog
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        photos={morningData?.photos || []}
        initialIndex={fullscreenIndex}
        period="morning"
      />
    </Box>
  );
}
