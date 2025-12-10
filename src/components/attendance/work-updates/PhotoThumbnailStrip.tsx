"use client";

import { useState } from "react";
import { Box, Typography, Badge, Tooltip } from "@mui/material";
import { PhotoCamera as PhotoCameraIcon } from "@mui/icons-material";
import { WorkPhoto } from "@/types/work-updates.types";

interface PhotoThumbnailStripProps {
  photos: WorkPhoto[];
  maxVisible?: number;
  size?: "small" | "medium";
  onPhotoClick?: (index: number) => void;
  showDescriptions?: boolean;
  label?: string;
}

export default function PhotoThumbnailStrip({
  photos,
  maxVisible = 3,
  size = "medium",
  onPhotoClick,
  showDescriptions = false,
  label,
}: PhotoThumbnailStripProps) {
  const dimensions = size === "small" ? 36 : 48;
  const visiblePhotos = photos.slice(0, maxVisible);
  const hiddenCount = Math.max(0, photos.length - maxVisible);

  if (photos.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          color: "text.disabled",
        }}
      >
        <PhotoCameraIcon sx={{ fontSize: 16 }} />
        <Typography variant="caption">No photos</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {label && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 0.5 }}
        >
          {label}
        </Typography>
      )}
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
        {visiblePhotos.map((photo, index) => (
          <Tooltip
            key={photo.id}
            title={photo.description || `Photo ${photo.id}`}
            arrow
            placement="top"
          >
            <Box
              sx={{
                width: dimensions,
                height: dimensions,
                borderRadius: 1,
                overflow: "hidden",
                border: "1px solid",
                borderColor: "grey.300",
                cursor: onPhotoClick ? "pointer" : "default",
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": onPhotoClick
                  ? {
                      transform: "scale(1.05)",
                      boxShadow: 2,
                    }
                  : {},
              }}
              onClick={() => onPhotoClick?.(index)}
            >
              <Box
                component="img"
                src={photo.url}
                alt={photo.description || `Photo ${photo.id}`}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </Box>
          </Tooltip>
        ))}
        {hiddenCount > 0 && (
          <Box
            sx={{
              width: dimensions,
              height: dimensions,
              borderRadius: 1,
              bgcolor: "grey.200",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: onPhotoClick ? "pointer" : "default",
              "&:hover": onPhotoClick
                ? {
                    bgcolor: "grey.300",
                  }
                : {},
            }}
            onClick={() => onPhotoClick?.(maxVisible)}
          >
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              +{hiddenCount}
            </Typography>
          </Box>
        )}
        {showDescriptions && photos.length > 0 && (
          <Box sx={{ ml: 0.5 }}>
            {visiblePhotos.map(
              (photo) =>
                photo.description && (
                  <Typography
                    key={photo.id}
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "block",
                      fontSize: "0.65rem",
                      lineHeight: 1.2,
                      maxWidth: 100,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {photo.description}
                  </Typography>
                )
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Compact version for table cells
export function PhotoBadge({
  photoCount,
  completionPercent,
  onClick,
}: {
  photoCount: number;
  completionPercent?: number;
  onClick?: () => void;
}) {
  if (photoCount === 0 && !completionPercent) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        cursor: onClick ? "pointer" : "default",
        "&:hover": onClick ? { opacity: 0.8 } : {},
      }}
      onClick={onClick}
    >
      {photoCount > 0 && (
        <Badge
          badgeContent={photoCount}
          color="primary"
          sx={{ "& .MuiBadge-badge": { fontSize: 10 } }}
        >
          <PhotoCameraIcon sx={{ fontSize: 18, color: "action.active" }} />
        </Badge>
      )}
      {completionPercent !== undefined && (
        <Typography
          variant="caption"
          sx={{
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            fontWeight: 600,
            bgcolor:
              completionPercent >= 80
                ? "success.100"
                : completionPercent >= 50
                ? "warning.100"
                : "error.100",
            color:
              completionPercent >= 80
                ? "success.700"
                : completionPercent >= 50
                ? "warning.700"
                : "error.700",
          }}
        >
          {completionPercent}%
        </Typography>
      )}
    </Box>
  );
}
