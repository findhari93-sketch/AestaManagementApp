"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
  Paper,
  LinearProgress,
} from "@mui/material";
import {
  Close as CloseIcon,
  WbSunny as MorningIcon,
  NightsStay as EveningIcon,
} from "@mui/icons-material";
import { WorkUpdates } from "@/types/work-updates.types";
import PhotoThumbnailStrip from "./PhotoThumbnailStrip";
import PhotoFullscreenDialog from "./PhotoFullscreenDialog";
import dayjs from "dayjs";

interface WorkUpdateViewerProps {
  open: boolean;
  onClose: () => void;
  workUpdates: WorkUpdates | null;
  siteName?: string;
  date: string;
}

export default function WorkUpdateViewer({
  open,
  onClose,
  workUpdates,
  siteName,
  date,
}: WorkUpdateViewerProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenPhotos, setFullscreenPhotos] = useState<
    { url: string; id: string; description?: string; uploadedAt: string }[]
  >([]);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [fullscreenPeriod, setFullscreenPeriod] = useState<
    "morning" | "evening"
  >("morning");

  const handleMorningPhotoClick = (index: number) => {
    if (workUpdates?.morning?.photos) {
      setFullscreenPhotos(workUpdates.morning.photos);
      setFullscreenIndex(index);
      setFullscreenPeriod("morning");
      setFullscreenOpen(true);
    }
  };

  const handleEveningPhotoClick = (index: number) => {
    if (workUpdates?.evening?.photos) {
      setFullscreenPhotos(workUpdates.evening.photos);
      setFullscreenIndex(index);
      setFullscreenPeriod("evening");
      setFullscreenOpen(true);
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return "success";
    if (percent >= 50) return "warning";
    return "error";
  };

  const formattedDate = dayjs(date).format("ddd, MMM D, YYYY");

  if (!workUpdates) {
    return null;
  }

  const hasMorning = workUpdates.morning !== null;
  const hasEvening = workUpdates.evening !== null;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { maxHeight: "90vh" },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 1,
          }}
        >
          <Box>
            <Typography variant="h6">Work Updates</Typography>
            <Typography variant="body2" color="text.secondary">
              {siteName && `${siteName} - `}
              {formattedDate}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {/* Morning Section */}
          {hasMorning && workUpdates.morning && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2,
                bgcolor: "warning.50",
                borderColor: "warning.200",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <MorningIcon sx={{ color: "warning.main", fontSize: 20 }} />
                <Typography variant="subtitle2" color="warning.dark">
                  Morning Plan
                </Typography>
                {workUpdates.morning.timestamp && (
                  <Chip
                    label={dayjs(workUpdates.morning.timestamp).format("h:mm A")}
                    size="small"
                    variant="outlined"
                    sx={{ ml: "auto" }}
                  />
                )}
              </Box>

              {workUpdates.morning.description && (
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  {workUpdates.morning.description}
                </Typography>
              )}

              {workUpdates.morning.photos.length > 0 && (
                <PhotoThumbnailStrip
                  photos={workUpdates.morning.photos}
                  size="medium"
                  maxVisible={5}
                  onPhotoClick={handleMorningPhotoClick}
                  showDescriptions
                />
              )}
            </Paper>
          )}

          {/* Evening Section */}
          {hasEvening && workUpdates.evening && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: "info.50",
                borderColor: "info.200",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <EveningIcon sx={{ color: "info.main", fontSize: 20 }} />
                <Typography variant="subtitle2" color="info.dark">
                  Evening Update
                </Typography>
                <Chip
                  label={`${workUpdates.evening.completionPercent}%`}
                  size="small"
                  color={getProgressColor(workUpdates.evening.completionPercent)}
                />
                {workUpdates.evening.timestamp && (
                  <Chip
                    label={dayjs(workUpdates.evening.timestamp).format("h:mm A")}
                    size="small"
                    variant="outlined"
                    sx={{ ml: "auto" }}
                  />
                )}
              </Box>

              {/* Progress bar */}
              <Box sx={{ mb: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={workUpdates.evening.completionPercent}
                  color={getProgressColor(workUpdates.evening.completionPercent)}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>

              {workUpdates.evening.summary && (
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  {workUpdates.evening.summary}
                </Typography>
              )}

              {workUpdates.evening.photos.length > 0 && (
                <PhotoThumbnailStrip
                  photos={workUpdates.evening.photos}
                  size="medium"
                  maxVisible={5}
                  onPhotoClick={handleEveningPhotoClick}
                />
              )}
            </Paper>
          )}

          {/* No data state */}
          {!hasMorning && !hasEvening && (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography color="text.secondary">
                No work updates recorded for this date.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen photo viewer */}
      <PhotoFullscreenDialog
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        photos={fullscreenPhotos}
        initialIndex={fullscreenIndex}
        period={fullscreenPeriod}
      />
    </>
  );
}
