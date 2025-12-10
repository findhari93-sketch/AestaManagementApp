"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  IconButton,
  Typography,
  Chip,
} from "@mui/material";
import {
  Close as CloseIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Download as DownloadIcon,
  WbSunny as MorningIcon,
  NightsStay as EveningIcon,
} from "@mui/icons-material";
import { WorkPhoto } from "@/types/work-updates.types";

interface PhotoFullscreenDialogProps {
  open: boolean;
  onClose: () => void;
  photos: WorkPhoto[];
  initialIndex?: number;
  period?: "morning" | "evening";
  title?: string;
}

export default function PhotoFullscreenDialog({
  open,
  onClose,
  photos,
  initialIndex = 0,
  period,
  title,
}: PhotoFullscreenDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, open]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePrev, handleNext, onClose]);

  const handleDownload = () => {
    const photo = photos[currentIndex];
    if (!photo) return;

    const link = document.createElement("a");
    link.href = photo.url;
    link.download = `photo_${photo.id}_${Date.now()}.jpg`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: "rgba(0, 0, 0, 0.95)",
        },
      }}
    >
      <DialogContent sx={{ p: 0, position: "relative", overflow: "hidden" }}>
        {/* Header */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
            bgcolor: "rgba(0, 0, 0, 0.5)",
            zIndex: 10,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {period && (
              <Chip
                icon={
                  period === "morning" ? (
                    <MorningIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <EveningIcon sx={{ fontSize: 16 }} />
                  )
                }
                label={period === "morning" ? "Morning" : "Evening"}
                size="small"
                color={period === "morning" ? "warning" : "info"}
              />
            )}
            <Typography color="white" variant="subtitle1">
              {title || currentPhoto?.description || `Photo ${currentIndex + 1}`}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButton onClick={handleDownload} sx={{ color: "white" }}>
              <DownloadIcon />
            </IconButton>
            <IconButton onClick={onClose} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Photo counter */}
        <Box
          sx={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        >
          <Typography color="white" variant="body2">
            {currentIndex + 1} / {photos.length}
          </Typography>
        </Box>

        {/* Navigation arrows */}
        {photos.length > 1 && (
          <>
            <IconButton
              onClick={handlePrev}
              sx={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                color: "white",
                bgcolor: "rgba(0, 0, 0, 0.4)",
                zIndex: 10,
                "&:hover": { bgcolor: "rgba(0, 0, 0, 0.6)" },
              }}
            >
              <PrevIcon fontSize="large" />
            </IconButton>
            <IconButton
              onClick={handleNext}
              sx={{
                position: "absolute",
                right: 16,
                top: "50%",
                transform: "translateY(-50%)",
                color: "white",
                bgcolor: "rgba(0, 0, 0, 0.4)",
                zIndex: 10,
                "&:hover": { bgcolor: "rgba(0, 0, 0, 0.6)" },
              }}
            >
              <NextIcon fontSize="large" />
            </IconButton>
          </>
        )}

        {/* Main image */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            p: 8,
          }}
        >
          <Box
            component="img"
            src={currentPhoto?.url}
            alt={currentPhoto?.description || `Photo ${currentIndex + 1}`}
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: 1,
            }}
          />
        </Box>

        {/* Photo description */}
        {currentPhoto?.description && (
          <Box
            sx={{
              position: "absolute",
              bottom: 50,
              left: 0,
              right: 0,
              textAlign: "center",
              px: 4,
            }}
          >
            <Typography color="white" variant="body2" sx={{ opacity: 0.9 }}>
              {currentPhoto.description}
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
