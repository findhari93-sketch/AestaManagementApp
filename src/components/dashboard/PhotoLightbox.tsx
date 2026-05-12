"use client";

import { useEffect, useState } from "react";
import { Box, Dialog, IconButton, Typography } from "@mui/material";
import {
  Close as CloseIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from "@mui/icons-material";
import type { WorkPhoto } from "@/types/work-updates.types";

interface PhotoLightboxProps {
  open: boolean;
  photos: WorkPhoto[];
  startIndex?: number;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

export default function PhotoLightbox({
  open,
  photos,
  startIndex = 0,
  onClose,
}: PhotoLightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open) {
      setIndex(Math.min(Math.max(0, startIndex), Math.max(0, photos.length - 1)));
      setZoom(1);
    }
  }, [open, startIndex, photos.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, photos.length]);

  const photo = photos[index];

  const goPrev = () => {
    if (photos.length === 0) return;
    setIndex((i) => (i - 1 + photos.length) % photos.length);
    setZoom(1);
  };

  const goNext = () => {
    if (photos.length === 0) return;
    setIndex((i) => (i + 1) % photos.length);
    setZoom(1);
  };

  const toggleZoom = () => {
    setZoom((z) => (z >= MAX_ZOOM ? MIN_ZOOM : Math.min(MAX_ZOOM, z + ZOOM_STEP)));
  };

  if (!photo) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: { bgcolor: "rgba(0,0,0,0.95)" },
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Top bar */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            p: 1.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)",
            zIndex: 2,
            color: "white",
          }}
        >
          <Typography variant="body2" sx={{ ml: 1 }}>
            {photos.length > 1 ? `${index + 1} / ${photos.length}` : ""}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButton
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              sx={{ color: "white" }}
              size="small"
              aria-label="Zoom out"
              disabled={zoom <= MIN_ZOOM}
            >
              <ZoomOutIcon />
            </IconButton>
            <IconButton
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              sx={{ color: "white" }}
              size="small"
              aria-label="Zoom in"
              disabled={zoom >= MAX_ZOOM}
            >
              <ZoomInIcon />
            </IconButton>
            <IconButton onClick={onClose} sx={{ color: "white" }} size="small" aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Photo */}
        <Box
          onClick={toggleZoom}
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: zoom < MAX_ZOOM ? "zoom-in" : "zoom-out",
            overflow: "auto",
          }}
        >
          <Box
            component="img"
            src={photo.url}
            alt={photo.description || `Photo ${photo.id}`}
            sx={{
              maxWidth: zoom === 1 ? "92vw" : "none",
              maxHeight: zoom === 1 ? "92vh" : "none",
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              transition: "transform 0.2s ease-out",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </Box>

        {/* Caption */}
        {photo.description && (
          <Box
            sx={{
              position: "absolute",
              bottom: photos.length > 1 ? 64 : 16,
              left: 0,
              right: 0,
              textAlign: "center",
              px: 3,
              zIndex: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: "white",
                bgcolor: "rgba(0,0,0,0.55)",
                display: "inline-block",
                px: 2,
                py: 0.75,
                borderRadius: 2,
                maxWidth: "90vw",
              }}
            >
              {photo.description}
            </Typography>
          </Box>
        )}

        {/* Nav */}
        {photos.length > 1 && (
          <>
            <IconButton
              onClick={goPrev}
              sx={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "white",
                bgcolor: "rgba(0,0,0,0.4)",
                "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
              }}
              aria-label="Previous photo"
            >
              <PrevIcon />
            </IconButton>
            <IconButton
              onClick={goNext}
              sx={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "white",
                bgcolor: "rgba(0,0,0,0.4)",
                "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
              }}
              aria-label="Next photo"
            >
              <NextIcon />
            </IconButton>
          </>
        )}
      </Box>
    </Dialog>
  );
}
