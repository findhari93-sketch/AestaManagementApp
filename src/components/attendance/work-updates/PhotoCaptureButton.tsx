"use client";

import { useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Typography,
  IconButton,
} from "@mui/material";
import {
  PhotoCamera as PhotoCameraIcon,
  Close as CloseIcon,
  Replay as RetakeIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { compressImage, getWorkUpdatePhotoPath } from "./imageUtils";
import { SupabaseClient } from "@supabase/supabase-js";

interface PhotoCaptureButtonProps {
  supabase: SupabaseClient;
  siteId: string;
  date: string;
  period: "morning" | "evening";
  photoIndex: number;
  photoUrl: string | null;
  onPhotoCapture: (url: string) => void;
  onPhotoRemove: () => void;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
}

// Helper to create a timeout promise
const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeout]);
};

export default function PhotoCaptureButton({
  supabase,
  siteId,
  date,
  period,
  photoIndex,
  photoUrl,
  onPhotoCapture,
  onPhotoRemove,
  disabled = false,
  compact = false,
  label,
}: PhotoCaptureButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setIsUploading(true);
    setUploadProgress(10);
    setError(null);

    try {
      // Compress the image with timeout
      setUploadProgress(30);
      const compressed = await withTimeout(
        compressImage(file, 500, 1920, 1920, 0.8),
        15000,
        "Image compression timed out"
      );

      // Upload to Supabase with timeout
      setUploadProgress(50);
      const filePath = getWorkUpdatePhotoPath(siteId, date, period, photoIndex);

      const uploadPromise = supabase.storage
        .from("work-updates")
        .upload(filePath, compressed, {
          cacheControl: "3600",
          upsert: true,
        });

      const { error: uploadError } = await withTimeout(
        uploadPromise,
        30000,
        "Upload timed out - check your internet connection"
      );

      if (uploadError) {
        throw uploadError;
      }

      setUploadProgress(80);

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("work-updates").getPublicUrl(filePath);

      setUploadProgress(100);
      onPhotoCapture(publicUrl);
    } catch (err) {
      console.error("Error uploading photo:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemove = async () => {
    onPhotoRemove();
  };

  // Hidden file input for camera capture
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      onChange={handleCapture}
      style={{ display: "none" }}
    />
  );

  // Photo captured - show thumbnail with remove/retake
  if (photoUrl) {
    return (
      <Box
        sx={{
          position: "relative",
          width: compact ? 60 : 80,
          height: compact ? 60 : 80,
          borderRadius: 1,
          overflow: "hidden",
          border: "2px solid",
          borderColor: "success.main",
        }}
      >
        {fileInput}
        <Box
          component="img"
          src={photoUrl}
          alt={`Photo ${photoIndex}`}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Remove button */}
        <IconButton
          size="small"
          onClick={handleRemove}
          disabled={disabled}
          sx={{
            position: "absolute",
            top: -6,
            right: -6,
            bgcolor: "error.main",
            color: "white",
            width: 20,
            height: 20,
            "&:hover": { bgcolor: "error.dark" },
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
        {/* Retake button */}
        <IconButton
          size="small"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          sx={{
            position: "absolute",
            bottom: 2,
            right: 2,
            bgcolor: "rgba(0,0,0,0.6)",
            color: "white",
            width: 24,
            height: 24,
            "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
          }}
        >
          <RetakeIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
    );
  }

  // No photo - show capture button
  if (compact) {
    return (
      <Box
        sx={{
          width: 60,
          height: 60,
          borderRadius: 1,
          border: "2px dashed",
          borderColor: error ? "error.main" : "grey.400",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled || isUploading ? "not-allowed" : "pointer",
          bgcolor: error ? "error.50" : "grey.50",
          "&:hover": {
            borderColor: disabled ? "grey.400" : "primary.main",
            bgcolor: disabled ? "grey.50" : "primary.50",
          },
        }}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
      >
        {fileInput}
        {isUploading ? (
          <CircularProgress size={20} />
        ) : error ? (
          <ErrorIcon sx={{ fontSize: 20, color: "error.main" }} />
        ) : (
          <>
            <PhotoCameraIcon
              sx={{ fontSize: 20, color: disabled ? "grey.400" : "grey.600" }}
            />
            <Typography
              variant="caption"
              color={disabled ? "text.disabled" : "text.secondary"}
              sx={{ fontSize: 10 }}
            >
              {photoIndex}
            </Typography>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 80,
        minHeight: 80,
        borderRadius: 2,
        border: "2px dashed",
        borderColor: error ? "error.main" : "grey.400",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled || isUploading ? "not-allowed" : "pointer",
        bgcolor: error ? "error.50" : "grey.50",
        p: 1,
        "&:hover": {
          borderColor: disabled ? "grey.400" : "primary.main",
          bgcolor: disabled ? "grey.50" : "primary.50",
        },
      }}
      onClick={() => !disabled && !isUploading && inputRef.current?.click()}
    >
      {fileInput}
      {isUploading ? (
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress size={24} />
          <Typography variant="caption" display="block" color="text.secondary">
            {uploadProgress}%
          </Typography>
        </Box>
      ) : error ? (
        <Box sx={{ textAlign: "center" }}>
          <ErrorIcon sx={{ fontSize: 24, color: "error.main" }} />
          <Typography
            variant="caption"
            color="error"
            display="block"
            sx={{ fontSize: 9, lineHeight: 1.1 }}
          >
            Failed
          </Typography>
        </Box>
      ) : (
        <>
          <PhotoCameraIcon
            sx={{ fontSize: 28, color: disabled ? "grey.400" : "primary.main" }}
          />
          <Typography
            variant="caption"
            color={disabled ? "text.disabled" : "text.secondary"}
            textAlign="center"
            sx={{ mt: 0.5, lineHeight: 1.2 }}
          >
            {label || `Photo ${photoIndex}`}
          </Typography>
        </>
      )}
    </Box>
  );
}
