"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
} from "@mui/material";
import { PhotoCamera as PhotoCameraIcon } from "@mui/icons-material";
import PhotoCaptureButton from "./PhotoCaptureButton";
import {
  WorkUpdates,
  PhotoSlotState,
  createPhotoSlots,
  photoSlotsToPhotos,
  photosToPhotoSlots,
} from "@/types/work-updates.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useIsMobile } from "@/hooks/useIsMobile";

interface FullDayUpdateFormProps {
  supabase: SupabaseClient;
  siteId: string;
  date: string;
  initialData?: WorkUpdates | null;
  photoCount: number;
  onPhotoCountChange: (count: number) => void;
  onChange: (data: WorkUpdates | null) => void;
  disabled?: boolean;
}

export default function FullDayUpdateForm({
  supabase,
  siteId,
  date,
  initialData,
  photoCount,
  onPhotoCountChange,
  onChange,
  disabled = false,
}: FullDayUpdateFormProps) {
  const isMobile = useIsMobile();
  // Use morning description for the single description field
  const [description, setDescription] = useState(
    initialData?.morning?.description || ""
  );
  // Combine morning and evening photos into a single gallery
  const [photoSlots, setPhotoSlots] = useState<PhotoSlotState[]>(() => {
    // Prefer morning photos, but fall back to evening photos if morning is empty
    const photos = initialData?.morning?.photos || initialData?.evening?.photos || [];
    return photos.length > 0
      ? photosToPhotoSlots(photos, photoCount)
      : createPhotoSlots(photoCount);
  });

  // Use ref to avoid onChange in useEffect dependencies
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Update slots when photo count changes
  useEffect(() => {
    setPhotoSlots((prev) => {
      const newSlots = createPhotoSlots(photoCount);
      // Preserve existing photos
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
    if (!description.trim() && photos.length === 0) {
      onChangeRef.current(null);
    } else {
      // Store as morning data for consistency
      onChangeRef.current({
        photoCount,
        morning: {
          description: description.trim(),
          photos,
          timestamp: new Date().toISOString(),
        },
        evening: null,
      });
    }
  }, [description, photoSlots, photoCount]);

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
        i === slotIndex ? { ...slot, photo: null, description: "" } : slot
      )
    );
  };

  const handleDescriptionChange = (slotIndex: number, desc: string) => {
    setPhotoSlots((prev) =>
      prev.map((slot, i) =>
        i === slotIndex ? { ...slot, description: desc } : slot
      )
    );
  };

  // Photo size based on screen size
  const photoSize: "medium" | "large" = isMobile ? "medium" : "large"; // 80px mobile, 120px desktop

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Header */}
      <Typography variant="body2" color="text.secondary">
        Add a summary and photos for this day&apos;s work.
      </Typography>

      {/* Work Description */}
      <TextField
        fullWidth
        multiline
        rows={3}
        size="small"
        label="What work was done?"
        placeholder="e.g., Completed plastering on 2nd floor, electrical wiring in ground floor..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={disabled}
      />

      {/* Site Photos Section */}
      <Box>
        {/* Header with count selector */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <PhotoCameraIcon sx={{ fontSize: 20, color: "action.active" }} />
          <Typography variant="body2" fontWeight={500}>
            Site Photos
          </Typography>
          <Typography variant="caption" color="text.secondary">
            (optional)
          </Typography>
        </Box>

        {/* Photo Count Selector */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 0.5, display: "block" }}
          >
            How many photos?
          </Typography>
          <ToggleButtonGroup
            value={photoCount}
            exclusive
            onChange={(_, value) => value && onPhotoCountChange(value)}
            size="small"
            disabled={disabled}
          >
            {[1, 2, 3, 4, 5].map((count) => (
              <ToggleButton
                key={count}
                value={count}
                sx={{
                  px: 2,
                  minWidth: 44,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "white",
                    "&:hover": {
                      bgcolor: "primary.dark",
                    },
                  },
                }}
              >
                {count}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Photo Grid - Responsive Grid Layout */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(3, 1fr)",
              md: "repeat(5, 1fr)",
            },
            gap: 2,
          }}
        >
          {photoSlots.map((slot, index) => (
            <Paper
              key={slot.id}
              variant="outlined"
              sx={{
                p: 1.5,
                bgcolor: slot.photo ? "success.50" : "grey.50",
                borderColor: slot.photo ? "success.200" : "grey.200",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              {/* Photo Number */}
              <Typography
                variant="caption"
                fontWeight={600}
                color={slot.photo ? "success.dark" : "text.secondary"}
              >
                Photo {index + 1}
              </Typography>

              {/* Photo Capture */}
              <PhotoCaptureButton
                supabase={supabase}
                siteId={siteId}
                date={date}
                period="morning"
                photoIndex={index + 1}
                photoUrl={slot.photo?.url || null}
                onPhotoCapture={(url) => handlePhotoCapture(index, url)}
                onPhotoRemove={() => handlePhotoRemove(index)}
                disabled={disabled}
                size={photoSize}
                label="Tap to add"
              />

              {/* Optional Description */}
              <TextField
                fullWidth
                size="small"
                placeholder="Description..."
                value={slot.description}
                onChange={(e) => handleDescriptionChange(index, e.target.value)}
                disabled={disabled}
                sx={{
                  "& .MuiInputBase-input": {
                    fontSize: "0.75rem",
                    py: 0.75,
                  },
                }}
              />
            </Paper>
          ))}
        </Box>

        {/* Help Text */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1.5, display: "block" }}
        >
          Add photos to document the day&apos;s work progress.
        </Typography>
      </Box>
    </Box>
  );
}
