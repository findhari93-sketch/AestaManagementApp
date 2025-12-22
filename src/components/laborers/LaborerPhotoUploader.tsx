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
  Person as PersonIcon,
} from "@mui/icons-material";
import { SupabaseClient } from "@supabase/supabase-js";
import ImageCropper from "@/components/profile/ImageCropper";
import { useImageUpload } from "@/hooks/useImageUpload";

interface LaborerPhotoUploaderProps {
  currentPhotoUrl: string | null;
  laborerName: string;
  laborerId?: string;
  onPhotoChange: (url: string | null) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  supabase: SupabaseClient;
}

export default function LaborerPhotoUploader({
  currentPhotoUrl,
  laborerName,
  laborerId,
  onPhotoChange,
  onError,
  disabled = false,
  supabase,
}: LaborerPhotoUploaderProps) {
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use "new" folder for new laborers, actual ID for existing
  const folderPath = laborerId || "new";

  const { uploadBlob, isUploading, progress } = useImageUpload({
    supabase,
    bucketName: "laborer-photos",
    folderPath,
    maxSizeMB: 0.5,
    maxWidthOrHeight: 400,
    quality: 0.8,
  });

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        onError("Please select an image file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        onError("Image must be less than 10MB");
        return;
      }

      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
      setCropperOpen(true);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onError]
  );

  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      try {
        const result = await uploadBlob(croppedBlob, "photo");
        onPhotoChange(result.url);
      } catch (error) {
        onError(
          error instanceof Error ? error.message : "Failed to upload photo"
        );
      } finally {
        if (selectedImage) {
          URL.revokeObjectURL(selectedImage);
          setSelectedImage(null);
        }
      }
    },
    [uploadBlob, onPhotoChange, onError, selectedImage]
  );

  const handleCropperClose = useCallback(() => {
    setCropperOpen(false);
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
      setSelectedImage(null);
    }
  }, [selectedImage]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPhotoChange(null);
    },
    [onPhotoChange]
  );

  const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
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

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box sx={{ position: "relative", display: "inline-block" }}>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            badgeContent={
              !disabled && (
                <Tooltip title="Upload photo">
                  <IconButton
                    onClick={handleClick}
                    disabled={isUploading}
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: "primary.main",
                      color: "white",
                      "&:hover": { bgcolor: "primary.dark" },
                      boxShadow: 2,
                    }}
                  >
                    {isUploading ? (
                      <CircularProgress
                        size={18}
                        color="inherit"
                        variant="determinate"
                        value={progress}
                      />
                    ) : (
                      <CameraIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Tooltip>
              )
            }
          >
            <Avatar
              src={currentPhotoUrl || undefined}
              alt={laborerName}
              onClick={handleClick}
              sx={{
                width: 100,
                height: 100,
                fontSize: 40,
                cursor: !disabled && !isUploading ? "pointer" : "default",
                bgcolor: "grey.300",
                border: "3px solid",
                borderColor: "background.paper",
                boxShadow: 2,
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": !disabled
                  ? { transform: "scale(1.02)", boxShadow: 4 }
                  : {},
              }}
            >
              {!currentPhotoUrl &&
                (laborerName ? (
                  getInitials(laborerName)
                ) : (
                  <PersonIcon sx={{ fontSize: 48, color: "grey.500" }} />
                ))}
            </Avatar>
          </Badge>

          {/* Remove button */}
          {!disabled && currentPhotoUrl && !isUploading && (
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
                  "&:hover": { bgcolor: "error.dark" },
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

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          Click to upload photo
        </Typography>
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
          title="Crop Laborer Photo"
        />
      )}
    </>
  );
}
