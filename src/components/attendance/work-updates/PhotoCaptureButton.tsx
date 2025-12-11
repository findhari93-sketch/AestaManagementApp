"use client";

import { useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  PhotoCamera as PhotoCameraIcon,
  Close as CloseIcon,
  Replay as RetakeIcon,
  Error as ErrorIcon,
  Collections as GalleryIcon,
  CameraAlt as CameraIcon,
} from "@mui/icons-material";
import { compressImage, getWorkUpdatePhotoPath, isMobileCameraPhoto } from "./imageUtils";
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (!disabled && !isUploading) {
      setMenuAnchor(event.currentTarget);
    }
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleCameraClick = () => {
    handleMenuClose();
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    handleMenuClose();
    galleryInputRef.current?.click();
  };

  // Upload with retry logic
  const uploadWithRetry = async (
    filePath: string,
    file: File,
    maxRetries: number = 2
  ): Promise<{ error: Error | null; data: unknown }> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[PhotoCapture] Upload attempt ${attempt}/${maxRetries}`);

      try {
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from("work-updates")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (!uploadError) {
          return { error: null, data: uploadData };
        }

        lastError = new Error(uploadError.message || "Upload failed");
        console.warn(`[PhotoCapture] Attempt ${attempt} failed:`, uploadError.message);

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[PhotoCapture] Attempt ${attempt} exception:`, lastError.message);
      }
    }

    return { error: lastError, data: null };
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isMobile = isMobileCameraPhoto(file);
    console.log(`[PhotoCapture] Starting upload for file: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB, mobile: ${isMobile}`);

    // Reset inputs so same file can be selected again
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }

    setIsUploading(true);
    setUploadProgress(10);
    setError(null);

    try {
      // Compress the image - uses auto settings for mobile
      console.log("[PhotoCapture] Compressing image...");
      setUploadProgress(30);

      // Longer timeout for mobile photos (25s for compression)
      const compressionTimeout = isMobile ? 25000 : 15000;
      const compressed = await withTimeout(
        compressImage(file), // Let compressImage auto-detect settings
        compressionTimeout,
        "Image compression timed out - try a smaller photo"
      );
      console.log(`[PhotoCapture] Compressed to ${(compressed.size / 1024).toFixed(0)}KB`);

      // Upload to Supabase with retry and longer timeout for mobile
      setUploadProgress(50);
      const filePath = getWorkUpdatePhotoPath(siteId, date, period, photoIndex);
      console.log("[PhotoCapture] Uploading to path:", filePath);

      // Longer timeout for mobile uploads (60s vs 30s)
      const uploadTimeout = isMobile ? 60000 : 30000;
      const uploadPromise = uploadWithRetry(filePath, compressed, 2);

      const { error: uploadError, data: uploadData } = await withTimeout(
        uploadPromise,
        uploadTimeout,
        "Upload timed out - check your internet connection and try again"
      );

      console.log("[PhotoCapture] Upload result:", { error: uploadError, data: uploadData });

      if (uploadError) {
        console.error("[PhotoCapture] Upload error details:", uploadError.message);
        throw uploadError;
      }

      setUploadProgress(80);

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("work-updates").getPublicUrl(filePath);

      console.log("[PhotoCapture] Success! Public URL:", publicUrl);
      setUploadProgress(100);
      onPhotoCapture(publicUrl);
    } catch (err: unknown) {
      console.error("[PhotoCapture] Error:", err);
      // Extract detailed error message
      let errorMessage = "Upload failed";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null) {
        const errObj = err as Record<string, unknown>;
        errorMessage = (errObj.message as string) || (errObj.error as string) || JSON.stringify(err);
      }
      console.error("[PhotoCapture] Error message:", errorMessage);
      setError(errorMessage);
      // Clear error after 10 seconds
      setTimeout(() => setError(null), 10000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemove = async () => {
    onPhotoRemove();
  };

  // Hidden file inputs - one for camera, one for gallery
  const fileInputs = (
    <>
      {/* Camera input - forces camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        style={{ display: "none" }}
      />
      {/* Gallery input - opens file picker/gallery */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleCapture}
        style={{ display: "none" }}
      />
    </>
  );

  // Menu for camera/gallery selection
  const sourceMenu = (
    <Menu
      anchorEl={menuAnchor}
      open={Boolean(menuAnchor)}
      onClose={handleMenuClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      transformOrigin={{ vertical: "top", horizontal: "center" }}
    >
      <MenuItem onClick={handleCameraClick}>
        <ListItemIcon>
          <CameraIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Take Photo</ListItemText>
      </MenuItem>
      <MenuItem onClick={handleGalleryClick}>
        <ListItemIcon>
          <GalleryIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Choose from Gallery</ListItemText>
      </MenuItem>
    </Menu>
  );

  // Photo captured - show thumbnail with remove/retake
  if (photoUrl) {
    return (
      <Box
        sx={{
          position: "relative",
          width: compact ? 60 : 80,
          height: compact ? 60 : 80,
          // Add padding to prevent close button from being cut off
          pt: 1,
          pr: 1,
        }}
      >
        {fileInputs}
        {sourceMenu}
        {/* Image container with overflow hidden for rounded corners */}
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bottom: 0,
            left: 0,
            borderRadius: 1,
            overflow: "hidden",
            border: "2px solid",
            borderColor: "success.main",
          }}
        >
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
        </Box>
        {/* Remove button - now outside the overflow:hidden container */}
        <IconButton
          size="small"
          onClick={handleRemove}
          disabled={disabled}
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            bgcolor: "error.main",
            color: "white",
            width: 20,
            height: 20,
            "&:hover": { bgcolor: "error.dark" },
            zIndex: 1,
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
        {/* Retake button - opens menu */}
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          disabled={disabled || isUploading}
          sx={{
            position: "absolute",
            bottom: 2,
            left: 2,
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
        onClick={handleMenuOpen}
      >
        {fileInputs}
        {sourceMenu}
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
      onClick={handleMenuOpen}
    >
      {fileInputs}
      {sourceMenu}
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
            {error.length > 20 ? "Failed" : error}
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
