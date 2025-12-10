"use client";

import { Box, TextField, Typography } from "@mui/material";
import PhotoCaptureButton from "./PhotoCaptureButton";
import { SupabaseClient } from "@supabase/supabase-js";

interface PhotoSlotProps {
  supabase: SupabaseClient;
  siteId: string;
  date: string;
  period: "morning" | "evening";
  slotIndex: number;
  photoUrl: string | null;
  description: string;
  onPhotoCapture: (url: string) => void;
  onPhotoRemove: () => void;
  onDescriptionChange: (description: string) => void;
  showDescription?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export default function PhotoSlot({
  supabase,
  siteId,
  date,
  period,
  slotIndex,
  photoUrl,
  description,
  onPhotoCapture,
  onPhotoRemove,
  onDescriptionChange,
  showDescription = true,
  disabled = false,
  compact = false,
}: PhotoSlotProps) {
  if (compact) {
    // Compact mode: just the photo button
    return (
      <PhotoCaptureButton
        supabase={supabase}
        siteId={siteId}
        date={date}
        period={period}
        photoIndex={slotIndex}
        photoUrl={photoUrl}
        onPhotoCapture={onPhotoCapture}
        onPhotoRemove={onPhotoRemove}
        disabled={disabled}
        compact
      />
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        width: 100,
      }}
    >
      <PhotoCaptureButton
        supabase={supabase}
        siteId={siteId}
        date={date}
        period={period}
        photoIndex={slotIndex}
        photoUrl={photoUrl}
        onPhotoCapture={onPhotoCapture}
        onPhotoRemove={onPhotoRemove}
        disabled={disabled}
      />
      {showDescription && (
        <TextField
          size="small"
          placeholder={`Task ${slotIndex}`}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          multiline
          maxRows={2}
          sx={{
            width: "100%",
            "& .MuiInputBase-input": {
              fontSize: "0.7rem",
              py: 0.5,
              px: 1,
            },
          }}
        />
      )}
    </Box>
  );
}
