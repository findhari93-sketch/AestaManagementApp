"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Avatar,
  Box,
  IconButton,
  CircularProgress,
  Typography,
  Badge,
  Tooltip,
} from "@mui/material";
import {
  CameraAlt as CameraIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { SupabaseClient } from "@supabase/supabase-js";
import ImageCropper from "./ImageCropper";
import { useImageUpload } from "@/hooks/useImageUpload";

interface AvatarUploaderProps {
  currentAvatarUrl: string | null;
  userId: string;
  userName: string;
  onUploadSuccess: (url: string) => void;
  onUploadError: (error: string) => void;
  onRemove?: () => void;
  size?: "small" | "medium" | "large";
  editable?: boolean;
  supabase: SupabaseClient;
}

const sizeMap = {
  small: { avatar: 64, badge: 24, icon: 14 },
  medium: { avatar: 100, badge: 32, icon: 18 },
  large: { avatar: 150, badge: 40, icon: 22 },
};

export default function AvatarUploader({
  currentAvatarUrl,
  userId,
  userName,
  onUploadSuccess,
  onUploadError,
  onRemove,
  size = "medium",
  editable = true,
  supabase,
}: AvatarUploaderProps) {
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dimensions = sizeMap[size];

  const { uploadBlob, isUploading, progress } = useImageUpload({
    supabase,
    bucketName: "avatars",
    folderPath: userId,
    maxSizeMB: 0.5,
    maxWidthOrHeight: 400,
  });

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        onUploadError("Please select an image file");
        return;
      }

      // Validate file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        onUploadError("Image must be less than 10MB");
        return;
      }

      // Create object URL for cropper
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
      setCropperOpen(true);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onUploadError]
  );

  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      try {
        const result = await uploadBlob(croppedBlob, "avatar");
        onUploadSuccess(result.url);
      } catch (error) {
        onUploadError(
          error instanceof Error ? error.message : "Failed to upload avatar"
        );
      } finally {
        // Clean up object URL
        if (selectedImage) {
          URL.revokeObjectURL(selectedImage);
          setSelectedImage(null);
        }
      }
    },
    [uploadBlob, onUploadSuccess, onUploadError, selectedImage]
  );

  const handleCropperClose = useCallback(() => {
    setCropperOpen(false);
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
      setSelectedImage(null);
    }
  }, [selectedImage]);

  const handleClick = useCallback(() => {
    if (editable && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [editable, isUploading]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRemove) {
        onRemove();
      }
    },
    [onRemove]
  );

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      <Box sx={{ position: "relative", display: "inline-block" }}>
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          badgeContent={
            editable && (
              <Tooltip title="Change photo">
                <IconButton
                  onClick={handleClick}
                  disabled={isUploading}
                  sx={{
                    width: dimensions.badge,
                    height: dimensions.badge,
                    bgcolor: "primary.main",
                    color: "white",
                    "&:hover": {
                      bgcolor: "primary.dark",
                    },
                    boxShadow: 2,
                  }}
                >
                  {isUploading ? (
                    <CircularProgress
                      size={dimensions.icon}
                      color="inherit"
                      variant="determinate"
                      value={progress}
                    />
                  ) : (
                    <CameraIcon sx={{ fontSize: dimensions.icon }} />
                  )}
                </IconButton>
              </Tooltip>
            )
          }
        >
          <Avatar
            src={currentAvatarUrl || undefined}
            alt={userName}
            onClick={handleClick}
            sx={{
              width: dimensions.avatar,
              height: dimensions.avatar,
              fontSize: dimensions.avatar * 0.4,
              cursor: editable && !isUploading ? "pointer" : "default",
              bgcolor: "primary.main",
              border: "3px solid",
              borderColor: "background.paper",
              boxShadow: 2,
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": editable
                ? {
                    transform: "scale(1.02)",
                    boxShadow: 4,
                  }
                : {},
            }}
          >
            {!currentAvatarUrl && getInitials(userName)}
          </Avatar>
        </Badge>

        {/* Remove button */}
        {editable && currentAvatarUrl && onRemove && !isUploading && (
          <Tooltip title="Remove photo">
            <IconButton
              onClick={handleRemove}
              size="small"
              sx={{
                position: "absolute",
                top: -4,
                right: -4,
                bgcolor: "error.main",
                color: "white",
                width: 24,
                height: 24,
                "&:hover": {
                  bgcolor: "error.dark",
                },
              }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(0,0,0,0.5)",
              borderRadius: "50%",
            }}
          >
            <Typography variant="caption" color="white" fontWeight={600}>
              {progress}%
            </Typography>
          </Box>
        )}
      </Box>

      {/* Image Cropper Dialog */}
      {selectedImage && (
        <ImageCropper
          open={cropperOpen}
          imageSrc={selectedImage}
          onClose={handleCropperClose}
          onCropComplete={handleCropComplete}
          cropShape="round"
          aspect={1}
          title="Crop Profile Photo"
        />
      )}
    </>
  );
}
