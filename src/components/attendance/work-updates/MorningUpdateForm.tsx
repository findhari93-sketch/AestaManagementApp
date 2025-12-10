"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { PhotoCamera as PhotoCameraIcon } from "@mui/icons-material";
import PhotoSlot from "./PhotoSlot";
import {
  MorningUpdate,
  PhotoSlotState,
  createPhotoSlots,
  photoSlotsToPhotos,
  photosToPhotoSlots,
} from "@/types/work-updates.types";
import { SupabaseClient } from "@supabase/supabase-js";

interface MorningUpdateFormProps {
  supabase: SupabaseClient;
  siteId: string;
  date: string;
  initialData?: MorningUpdate | null;
  photoCount: number;
  onPhotoCountChange: (count: number) => void;
  onChange: (data: MorningUpdate | null) => void;
  disabled?: boolean;
}

export default function MorningUpdateForm({
  supabase,
  siteId,
  date,
  initialData,
  photoCount,
  onPhotoCountChange,
  onChange,
  disabled = false,
}: MorningUpdateFormProps) {
  const [description, setDescription] = useState(initialData?.description || "");
  const [showPhotos, setShowPhotos] = useState(
    Boolean(initialData?.photos && initialData.photos.length > 0)
  );
  const [photoSlots, setPhotoSlots] = useState<PhotoSlotState[]>(
    initialData?.photos
      ? photosToPhotoSlots(initialData.photos, photoCount)
      : createPhotoSlots(photoCount)
  );

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
      onChangeRef.current({
        description: description.trim(),
        photos,
        timestamp: new Date().toISOString(),
      });
    }
  }, [description, photoSlots]);

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Work Description */}
      <TextField
        fullWidth
        multiline
        rows={2}
        size="small"
        label="What work is planned for today?"
        placeholder="e.g., Plastering 2nd floor, electrical wiring in ground floor..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={disabled}
      />

      {/* Photo Toggle */}
      <FormControlLabel
        control={
          <Switch
            checked={showPhotos}
            onChange={(e) => setShowPhotos(e.target.checked)}
            disabled={disabled}
            size="small"
          />
        }
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PhotoCameraIcon sx={{ fontSize: 18, color: "action.active" }} />
            <Typography variant="body2">Add Site Photos</Typography>
          </Box>
        }
      />

      {/* Photo Slots */}
      {showPhotos && (
        <Box>
          {/* Photo Count Selector */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              How many task areas to document?
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
                  sx={{ px: 2, minWidth: 40 }}
                >
                  {count}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Photo Grid */}
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              flexWrap: "wrap",
              justifyContent: "flex-start",
            }}
          >
            {photoSlots.map((slot, index) => (
              <PhotoSlot
                key={slot.id}
                supabase={supabase}
                siteId={siteId}
                date={date}
                period="morning"
                slotIndex={index + 1}
                photoUrl={slot.photo?.url || null}
                description={slot.description}
                onPhotoCapture={(url) => handlePhotoCapture(index, url)}
                onPhotoRemove={() => handlePhotoRemove(index)}
                onDescriptionChange={(desc) =>
                  handleDescriptionChange(index, desc)
                }
                showDescription
                disabled={disabled}
              />
            ))}
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            Tap each slot to capture a photo of the work area. Add a brief description below each photo.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
