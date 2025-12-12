"use client";

import { useRef, useState, useCallback } from "react";
import {
  Box,
  CircularProgress,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Button,
} from "@mui/material";
import {
  PhotoCamera as PhotoCameraIcon,
  Close as CloseIcon,
  Replay as RetakeIcon,
  Error as ErrorIcon,
  Collections as GalleryIcon,
  CameraAlt as CameraIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import imageCompression from "browser-image-compression";
import { getWorkUpdatePhotoPath } from "./imageUtils";
import { SupabaseClient } from "@supabase/supabase-js";

// Size variants for different contexts
type PhotoSize = "small" | "medium" | "large" | "xlarge";

const SIZE_MAP: Record<PhotoSize, number> = {
  small: 60,
  medium: 80,
  large: 120,
  xlarge: 160,
};

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
  size?: PhotoSize;
  label?: string;
}

// Upload status for better UX feedback
type UploadStatus = "idle" | "compressing" | "uploading" | "error" | "success";

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
  size = compact ? "small" : "medium",
  label,
}: PhotoCaptureButtonProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  // Calculate actual pixel size
  const pixelSize = SIZE_MAP[size];

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

  // Cancel ongoing upload
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStatus("idle");
    setError("Upload cancelled");
    setTimeout(() => setError(null), 3000);
  }, []);

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

    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`[PhotoCapture] Starting upload for file: ${file.name}, size: ${fileSizeMB.toFixed(2)}MB`);

    // Reset inputs so same file can be selected again
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatus("compressing");
    setError(null);

    try {
      // Compress using browser-image-compression (uses Web Workers - won't block UI)
      console.log("[PhotoCapture] Compressing image with browser-image-compression...");
      setUploadProgress(20);

      const compressionOptions = {
        maxSizeMB: fileSizeMB > 5 ? 0.3 : 0.5, // More aggressive for very large files
        maxWidthOrHeight: fileSizeMB > 5 ? 1200 : 1920,
        useWebWorker: true, // Critical: prevents UI blocking
        fileType: "image/jpeg" as const,
        initialQuality: fileSizeMB > 5 ? 0.6 : 0.8,
        signal: abortControllerRef.current.signal, // Allow cancellation
        onProgress: (progress: number) => {
          // Progress from 20 to 50 during compression
          setUploadProgress(20 + Math.round(progress * 30));
        },
      };

      let compressedFile: File;
      try {
        compressedFile = await imageCompression(file, compressionOptions);
        console.log(`[PhotoCapture] Compressed to ${(compressedFile.size / 1024).toFixed(0)}KB`);
      } catch (compressionErr) {
        // If compression fails/times out, try uploading original if it's small enough
        if (fileSizeMB <= 5) {
          console.warn("[PhotoCapture] Compression failed, using original file");
          compressedFile = file;
        } else {
          throw new Error("Image too large. Please try a smaller photo.");
        }
      }

      // Check if cancelled
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error("Upload cancelled");
      }

      // Upload to Supabase
      setUploadProgress(55);
      setUploadStatus("uploading");
      const filePath = getWorkUpdatePhotoPath(siteId, date, period, photoIndex);
      console.log("[PhotoCapture] Uploading to path:", filePath);

      const { error: uploadError } = await uploadWithRetry(filePath, compressedFile, 2);

      // Check if cancelled
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error("Upload cancelled");
      }

      if (uploadError) {
        console.error("[PhotoCapture] Upload error:", uploadError.message);
        throw uploadError;
      }

      setUploadProgress(90);

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("work-updates").getPublicUrl(filePath);

      console.log("[PhotoCapture] Success! Public URL:", publicUrl);
      setUploadProgress(100);
      setUploadStatus("success");
      onPhotoCapture(publicUrl);
    } catch (err: unknown) {
      console.error("[PhotoCapture] Error:", err);
      setUploadStatus("error");

      let errorMessage = "Upload failed";
      if (err instanceof Error) {
        if (err.name === "AbortError" || err.message === "Upload cancelled") {
          errorMessage = "Upload cancelled";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      // Clear error after 10 seconds
      setTimeout(() => setError(null), 10000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      abortControllerRef.current = null;
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

  // Get status text for progress indicator
  const getStatusText = () => {
    if (uploadStatus === "compressing") return "Compressing...";
    if (uploadStatus === "uploading") return "Uploading...";
    return `${uploadProgress}%`;
  };

  // Photo captured - show thumbnail with remove/retake
  if (photoUrl) {
    return (
      <Box
        sx={{
          position: "relative",
          width: pixelSize,
          height: pixelSize,
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

  // No photo - show capture button (compact or sized based on size prop)
  if (compact || size === "small") {
    const compactSize = SIZE_MAP.small;
    return (
      <Box
        sx={{
          width: compactSize,
          height: compactSize,
          borderRadius: 1,
          border: "2px dashed",
          borderColor: error ? "error.main" : "grey.400",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled || isUploading ? "not-allowed" : "pointer",
          bgcolor: error ? "error.50" : "grey.50",
          position: "relative",
          "&:hover": {
            borderColor: disabled ? "grey.400" : "primary.main",
            bgcolor: disabled ? "grey.50" : "primary.50",
          },
        }}
        onClick={isUploading ? undefined : handleMenuOpen}
      >
        {fileInputs}
        {sourceMenu}
        {isUploading ? (
          <Box sx={{ textAlign: "center" }}>
            <CircularProgress size={18} />
            <Typography
              variant="caption"
              display="block"
              color="text.secondary"
              sx={{ fontSize: 8, mt: 0.25, lineHeight: 1 }}
            >
              {getStatusText()}
            </Typography>
            {/* Cancel button for compact mode */}
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              sx={{
                position: "absolute",
                top: -8,
                right: -8,
                bgcolor: "grey.600",
                color: "white",
                width: 16,
                height: 16,
                "&:hover": { bgcolor: "grey.800" },
              }}
            >
              <CancelIcon sx={{ fontSize: 10 }} />
            </IconButton>
          </Box>
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

  // Regular sized capture button
  const iconSize = pixelSize >= 120 ? 36 : pixelSize >= 100 ? 32 : 28;
  const fontSize = pixelSize >= 120 ? "0.75rem" : "0.7rem";

  return (
    <Box
      sx={{
        width: pixelSize,
        minHeight: pixelSize,
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
        position: "relative",
        "&:hover": {
          borderColor: disabled ? "grey.400" : "primary.main",
          bgcolor: disabled ? "grey.50" : "primary.50",
        },
      }}
      onClick={isUploading ? undefined : handleMenuOpen}
    >
      {fileInputs}
      {sourceMenu}
      {isUploading ? (
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress size={iconSize} />
          <Typography
            variant="caption"
            display="block"
            color="text.secondary"
            sx={{ fontSize: fontSize, mt: 0.5 }}
          >
            {getStatusText()}
          </Typography>
          {/* Cancel button */}
          <Button
            size="small"
            variant="text"
            onClick={(e) => { e.stopPropagation(); handleCancel(); }}
            startIcon={<CancelIcon sx={{ fontSize: 12 }} />}
            sx={{
              mt: 0.5,
              fontSize: "0.65rem",
              py: 0,
              px: 0.5,
              minWidth: "auto",
              color: "text.secondary",
              "&:hover": { color: "error.main" },
            }}
          >
            Cancel
          </Button>
        </Box>
      ) : error ? (
        <Box sx={{ textAlign: "center" }}>
          <ErrorIcon sx={{ fontSize: iconSize, color: "error.main" }} />
          <Typography
            variant="caption"
            color="error"
            display="block"
            sx={{ fontSize: "0.65rem", lineHeight: 1.1 }}
          >
            {error.length > 20 ? "Failed" : error}
          </Typography>
        </Box>
      ) : (
        <>
          <PhotoCameraIcon
            sx={{ fontSize: iconSize, color: disabled ? "grey.400" : "primary.main" }}
          />
          <Typography
            variant="caption"
            color={disabled ? "text.disabled" : "text.secondary"}
            textAlign="center"
            sx={{ mt: 0.5, lineHeight: 1.2, fontSize: fontSize }}
          >
            {label || `Task ${photoIndex}`}
          </Typography>
        </>
      )}
    </Box>
  );
}

// Export the PhotoSize type for use in other components
export type { PhotoSize };
