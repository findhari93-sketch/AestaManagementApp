"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  Typography,
  Paper,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  IconButton,
  LinearProgress,
} from "@mui/material";
import {
  WbSunny as MorningIcon,
  NightsStay as EveningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PhotoCamera as PhotoCameraIcon,
} from "@mui/icons-material";
import PhotoCaptureButton from "./PhotoCaptureButton";
import PhotoThumbnailStrip from "./PhotoThumbnailStrip";
import PhotoFullscreenDialog from "./PhotoFullscreenDialog";
import {
  MorningUpdate,
  EveningUpdate,
  TaskProgress,
  PhotoSlotState,
  createPhotoSlots,
  photoSlotsToPhotos,
  photosToPhotoSlots,
} from "@/types/work-updates.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useIsMobile } from "@/hooks/useIsMobile";

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

// Progress options for per-task completion
const PROGRESS_OPTIONS = [
  { value: 0, label: "0%" },
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
];

// Initialize task progress from initial data or create new
const initializeTaskProgress = (
  initialData: EveningUpdate | null | undefined,
  photoCount: number
): TaskProgress[] => {
  if (initialData?.taskProgress && initialData.taskProgress.length > 0) {
    return initialData.taskProgress;
  }
  // Create default task progress for each photo slot
  return Array.from({ length: photoCount }, (_, i) => ({
    taskId: String(i + 1),
    completionPercent: 0,
  }));
};

// Calculate average completion from task progress
const calculateAverageCompletion = (taskProgress: TaskProgress[]): number => {
  if (taskProgress.length === 0) return 0;
  const total = taskProgress.reduce((sum, task) => sum + task.completionPercent, 0);
  return Math.round(total / taskProgress.length);
};

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
  const isMobile = useIsMobile();
  const [taskProgress, setTaskProgress] = useState<TaskProgress[]>(
    initializeTaskProgress(initialData, photoCount)
  );
  const [summary, setSummary] = useState(initialData?.summary || "");
  const [photoSlots, setPhotoSlots] = useState<PhotoSlotState[]>(
    initialData?.photos
      ? photosToPhotoSlots(initialData.photos, photoCount)
      : createPhotoSlots(photoCount)
  );
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [morningExpanded, setMorningExpanded] = useState(false);

  // Calculate average completion from task progress
  const completionPercent = calculateAverageCompletion(taskProgress);

  // Photo sizes based on screen size
  const morningPhotoSize = isMobile ? 100 : 140;
  const eveningPhotoSize: "large" | "xlarge" = isMobile ? "large" : "xlarge"; // 120px mobile, 160px desktop

  // Use ref to avoid onChange in useEffect dependencies
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Update slots and task progress when photo count changes
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
    // Also update task progress to match photo count
    setTaskProgress((prev) => {
      const newProgress: TaskProgress[] = Array.from({ length: photoCount }, (_, i) => {
        const existing = prev.find((p) => p.taskId === String(i + 1));
        return existing || { taskId: String(i + 1), completionPercent: 0 };
      });
      return newProgress;
    });
  }, [photoCount]);

  // Emit changes to parent
  useEffect(() => {
    const photos = photoSlotsToPhotos(photoSlots);
    const hasProgress = taskProgress.some((t) => t.completionPercent > 0);
    if (!hasProgress && !summary.trim() && photos.length === 0) {
      onChangeRef.current(null);
    } else {
      onChangeRef.current({
        completionPercent, // Average for backward compatibility
        taskProgress, // Per-task progress
        summary: summary.trim(),
        photos,
        timestamp: new Date().toISOString(),
      });
    }
  }, [taskProgress, summary, photoSlots, completionPercent]);

  // Handle task progress change
  const handleTaskProgressChange = (taskId: string, value: number) => {
    setTaskProgress((prev) =>
      prev.map((task) =>
        task.taskId === taskId ? { ...task, completionPercent: value } : task
      )
    );
  };

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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Collapsible Morning Plan Section */}
      {morningData && (
        <Paper
          variant="outlined"
          sx={{
            bgcolor: "warning.50",
            borderColor: "warning.200",
            overflow: "hidden",
          }}
        >
          {/* Collapsible Header */}
          <Box
            onClick={() => setMorningExpanded(!morningExpanded)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.5,
              cursor: "pointer",
              "&:hover": { bgcolor: "warning.100" },
              transition: "background-color 0.2s",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <MorningIcon sx={{ fontSize: 18, color: "warning.main" }} />
              <Typography variant="subtitle2" color="warning.dark">
                Morning Plan
              </Typography>
              {morningData.photos.length > 0 && (
                <Chip
                  label={`${morningData.photos.length} task${morningData.photos.length > 1 ? "s" : ""}`}
                  size="small"
                  sx={{ height: 20, fontSize: "0.7rem", bgcolor: "warning.100" }}
                />
              )}
            </Box>
            <IconButton size="small" sx={{ p: 0.5 }}>
              {morningExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          {/* Collapsible Content */}
          <Collapse in={morningExpanded}>
            <Box sx={{ px: 1.5, pb: 1.5 }}>
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
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Evening Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <EveningIcon sx={{ fontSize: 20, color: "info.main" }} />
        <Typography variant="subtitle1" fontWeight={600} color="info.dark">
          Evening Update
        </Typography>
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

      {/* Task Progress Section */}
      {morningData?.photos && morningData.photos.length > 0 && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <PhotoCameraIcon sx={{ fontSize: 20, color: "action.active" }} />
            <Typography variant="body2" fontWeight={500}>
              Task Progress
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (capture evening photos)
            </Typography>
          </Box>

          {/* Task Progress Cards */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {photoSlots.slice(0, morningData.photos.length).map((slot, index) => {
              const morningPhoto = morningData.photos[index];
              const taskId = String(index + 1);
              const taskProgressValue = taskProgress.find((t) => t.taskId === taskId)?.completionPercent || 0;
              return (
                <Paper
                  key={slot.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: slot.photo ? "success.50" : "grey.50",
                    borderColor: slot.photo ? "success.200" : "grey.200",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Task Header with Progress Badge */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={600}
                      color={slot.photo ? "success.dark" : "text.primary"}
                    >
                      Task {index + 1}: {morningPhoto?.description || "Work Area"}
                    </Typography>
                    <Chip
                      label={`${taskProgressValue}%`}
                      size="small"
                      color={getProgressColor(taskProgressValue)}
                      sx={{ fontWeight: 600, minWidth: 50 }}
                    />
                  </Box>

                  {/* Photo Comparison Row - Larger Photos */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: { xs: 1.5, sm: 2 },
                      mb: 2,
                      justifyContent: { xs: "center", sm: "flex-start" },
                    }}
                  >
                    {/* Morning Photo (Reference) */}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="warning.dark"
                        fontWeight={600}
                        sx={{ textTransform: "uppercase", fontSize: "0.65rem" }}
                      >
                        Morning
                      </Typography>
                      {morningPhoto ? (
                        <Box
                          component="img"
                          src={morningPhoto.url}
                          alt={`Morning ${index + 1}`}
                          onClick={() => handleMorningPhotoClick(index)}
                          sx={{
                            width: morningPhotoSize,
                            height: morningPhotoSize,
                            borderRadius: 1.5,
                            objectFit: "cover",
                            border: "3px solid",
                            borderColor: "warning.main",
                            cursor: "pointer",
                            boxShadow: 1,
                            transition: "transform 0.2s, box-shadow 0.2s",
                            "&:hover": {
                              transform: "scale(1.02)",
                              boxShadow: 3,
                            },
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: morningPhotoSize,
                            height: morningPhotoSize,
                            borderRadius: 1.5,
                            bgcolor: "grey.200",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Typography variant="caption" color="text.disabled">
                            No photo
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Wave Transition Indicator */}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pt: 2.5,
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #ff9800 0%, #2196f3 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          boxShadow: 1,
                        }}
                      >
                        ≈
                      </Box>
                    </Box>

                    {/* Evening Photo (Capture) */}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="info.dark"
                        fontWeight={600}
                        sx={{ textTransform: "uppercase", fontSize: "0.65rem" }}
                      >
                        Evening
                      </Typography>
                      <PhotoCaptureButton
                        supabase={supabase}
                        siteId={siteId}
                        date={date}
                        period="evening"
                        photoIndex={index + 1}
                        photoUrl={slot.photo?.url || null}
                        onPhotoCapture={(url) => handlePhotoCapture(index, url)}
                        onPhotoRemove={() => handlePhotoRemove(index)}
                        disabled={disabled}
                        size={eveningPhotoSize}
                        label="Tap to capture"
                      />
                    </Box>
                  </Box>

                  {/* Per-Task Progress Selector */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: "block" }}>
                      Task Progress:
                    </Typography>
                    <ToggleButtonGroup
                      value={taskProgressValue}
                      exclusive
                      onChange={(_, value) => value !== null && handleTaskProgressChange(taskId, value)}
                      size="small"
                      disabled={disabled}
                      fullWidth
                      sx={{
                        "& .MuiToggleButton-root": {
                          flex: 1,
                          py: 1,
                          fontSize: "0.8rem",
                          fontWeight: 500,
                        },
                      }}
                    >
                      {PROGRESS_OPTIONS.map((opt) => (
                        <ToggleButton
                          key={opt.value}
                          value={opt.value}
                          sx={{
                            "&.Mui-selected": {
                              bgcolor: `${getProgressColor(opt.value)}.main`,
                              color: "white",
                              "&:hover": {
                                bgcolor: `${getProgressColor(opt.value)}.dark`,
                              },
                            },
                          }}
                        >
                          {opt.label}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Overall Progress Bar - Sticky Summary */}
      {morningData?.photos && morningData.photos.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            bgcolor: `${getProgressColor(completionPercent)}.50`,
            borderColor: `${getProgressColor(completionPercent)}.200`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
            <Typography variant="body2" fontWeight={600}>
              Overall Progress
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              color={`${getProgressColor(completionPercent)}.main`}
            >
              {completionPercent}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={completionPercent}
            color={getProgressColor(completionPercent)}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: "grey.200",
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
            Average of {morningData.photos.length} task{morningData.photos.length > 1 ? "s" : ""}
          </Typography>
        </Paper>
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
