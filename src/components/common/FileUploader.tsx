"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
  Alert,
  LinearProgress,
} from "@mui/material";
import {
  CheckCircle,
  Close,
  CloudUpload,
  InsertDriveFile,
  PictureAsPdf,
  Image as ImageIcon,
  Upload,
  Visibility,
} from "@mui/icons-material";
import { SupabaseClient } from "@supabase/supabase-js";

export type FileType = "pdf" | "image" | "all";
export type UploadedFile = {
  name: string;
  size: number;
  url: string;
  type?: string;
};

export type FileUploaderProps = {
  /** Supabase client instance */
  supabase: SupabaseClient<any>;
  /** Storage bucket name */
  bucketName: string;
  /** Folder path prefix for uploaded files (e.g., "site-123") */
  folderPath?: string;
  /** File name prefix (e.g., "contract", "receipt") */
  fileNamePrefix?: string;
  /** Allowed file types */
  accept?: FileType;
  /** Custom accept string override (e.g., "image/png,image/jpeg,application/pdf") */
  acceptString?: string;
  /** Max file size in MB */
  maxSizeMB?: number;
  /** Label text shown above the uploader */
  label?: string;
  /** Helper text shown below the drop zone */
  helperText?: string;
  /** Whether to upload immediately on file selection */
  uploadOnSelect?: boolean;
  /** Currently uploaded file (controlled) */
  value?: UploadedFile | null;
  /** Callback when file is uploaded successfully */
  onUpload?: (file: UploadedFile) => void;
  /** Callback when file is removed */
  onRemove?: () => void;
  /** Callback for errors */
  onError?: (error: string) => void;
  /** Callback when file is selected (before upload if uploadOnSelect=false) */
  onFileSelect?: (file: File) => void;
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Whether to show view button for uploaded files */
  showViewButton?: boolean;
  /** Custom view handler */
  onView?: (url: string) => void;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Enable image compression before upload (default: true for images) */
  compressImages?: boolean;
  /** Max compressed size in KB (default: 500KB) */
  maxCompressedSizeKB?: number;
  /** Max width for compressed images (default: 1920px) */
  maxImageWidth?: number;
  /** Max height for compressed images (default: 1920px) */
  maxImageHeight?: number;
};

const FILE_TYPE_CONFIG: Record<FileType, { accept: string; label: string }> = {
  pdf: {
    accept: "application/pdf",
    label: "PDF files only",
  },
  image: {
    accept: "image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif",
    label: "PNG, JPG, WEBP files",
  },
  all: {
    accept: "application/pdf,image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif",
    label: "PDF, PNG, JPG, WEBP files",
  },
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return "Unknown size";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${sizes[i]}`;
};

// Get MIME type from file extension (fallback for files with empty/incorrect MIME)
const getMimeFromExtension = (filename: string): string | null => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'pdf': 'application/pdf',
  };
  return mimeMap[ext || ''] || null;
};

// Get effective MIME type (with extension fallback)
const getEffectiveMimeType = (file: File): string => {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }
  return getMimeFromExtension(file.name) || file.type || '';
};

// Sanitize filename - remove special characters that can cause issues
const sanitizeFilename = (filename: string): string => {
  // Get extension
  const lastDot = filename.lastIndexOf(".");
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : "";

  // Replace non-alphanumeric characters (except dash and underscore) with underscore
  const sanitized = name
    .replace(/[^a-zA-Z0-9\-_]/g, "_")
    .replace(/_+/g, "_") // Replace multiple underscores with single
    .substring(0, 50); // Limit length

  return sanitized + ext;
};

// Image compression utility with timeout
const compressImage = (
  file: File,
  maxSizeKB: number = 500,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const effectiveMime = getEffectiveMimeType(file);

    // Skip compression for non-image files
    if (!effectiveMime.startsWith("image/")) {
      resolve(file);
      return;
    }

    // Skip HEIC/HEIF - browser Canvas API can't process these (except Safari)
    // These formats will be uploaded as-is
    if (effectiveMime === 'image/heic' || effectiveMime === 'image/heif') {
      console.log('Skipping compression for HEIC/HEIF - not supported in browser');
      resolve(file);
      return;
    }

    // Skip if already small enough (under maxSizeKB)
    if (file.size <= maxSizeKB * 1024) {
      resolve(file);
      return;
    }

    // Add timeout to prevent hanging (reduced to 5 seconds)
    const timeout = setTimeout(() => {
      console.warn("Image compression timed out, using original file");
      resolve(file);
    }, 5000); // 5 second timeout

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // Help with CORS issues
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }

          // Ensure minimum dimensions
          width = Math.max(1, width);
          height = Math.max(1, height);

          // Create canvas and draw image
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            clearTimeout(timeout);
            console.warn("Failed to get canvas context, using original file");
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Determine output type - always use JPEG for better compression
          const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              clearTimeout(timeout);

              if (!blob) {
                console.warn("Failed to create blob, using original file");
                resolve(file);
                return;
              }

              // Sanitize filename and create new file
              const sanitizedName = sanitizeFilename(file.name);
              const compressedFile = new File([blob], sanitizedName, {
                type: outputType,
                lastModified: Date.now(),
              });

              // If still too large, try with lower quality
              if (compressedFile.size > maxSizeKB * 1024 && quality > 0.3) {
                compressImage(file, maxSizeKB, maxWidth, maxHeight, quality - 0.1)
                  .then(resolve)
                  .catch(() => resolve(file)); // On error, use original
              } else {
                resolve(compressedFile);
              }
            },
            outputType,
            quality
          );
        } catch (err) {
          clearTimeout(timeout);
          console.warn("Error during compression, using original file:", err);
          resolve(file);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        console.warn("Failed to load image for compression, using original file");
        resolve(file); // Don't reject, just use original
      };
    };
    reader.onerror = () => {
      clearTimeout(timeout);
      console.warn("Failed to read file for compression, using original file");
      resolve(file); // Don't reject, just use original
    };
  });
};

const getFileIcon = (fileType?: string) => {
  if (!fileType)
    return <InsertDriveFile sx={{ fontSize: 32, color: "action.active" }} />;
  if (fileType.includes("pdf"))
    return <PictureAsPdf sx={{ fontSize: 32, color: "error.main" }} />;
  if (fileType.includes("image"))
    return <ImageIcon sx={{ fontSize: 32, color: "info.main" }} />;
  return <InsertDriveFile sx={{ fontSize: 32, color: "action.active" }} />;
};

export default function FileUploader({
  supabase,
  bucketName,
  folderPath = "uploads",
  fileNamePrefix = "file",
  accept = "all",
  acceptString,
  maxSizeMB = 15,
  label,
  helperText,
  uploadOnSelect = true,
  value,
  onUpload,
  onRemove,
  onError,
  onFileSelect,
  disabled = false,
  showViewButton = true,
  onView,
  compact = false,
  compressImages = true,
  maxCompressedSizeKB = 500,
  maxImageWidth = 1920,
  maxImageHeight = 1920,
}: FileUploaderProps) {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // Store last uploaded file to display until parent updates value prop
  const [lastUploadedFile, setLastUploadedFile] = useState<UploadedFile | null>(null);

  const acceptMime = acceptString || FILE_TYPE_CONFIG[accept].accept;
  const acceptLabel = FILE_TYPE_CONFIG[accept].label;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      // Use effective MIME type (with extension fallback for WhatsApp downloads etc.)
      const effectiveMime = getEffectiveMimeType(file);
      const allowedTypes = acceptMime.split(",").map((t) => t.trim());

      if (
        !allowedTypes.some(
          (t) => effectiveMime === t || effectiveMime.startsWith(t.replace("*", ""))
        )
      ) {
        return `Invalid file type. Allowed: ${acceptLabel}`;
      }
      if (file.size > maxSizeBytes) {
        return `File too large. Max size: ${maxSizeMB}MB`;
      }
      return null;
    },
    [acceptMime, acceptLabel, maxSizeBytes, maxSizeMB]
  );

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        onError?.(validationError);
        return null;
      }

      setUploading(true);
      setUploadProgress(0);
      setUploadSuccess(false);
      setError(null);

      let progressInterval: NodeJS.Timeout | null = null;
      let globalTimeout: NodeJS.Timeout | null = null;
      let isAborted = false;

      // Global timeout to prevent indefinite hanging (60 seconds)
      // Increased from 20s to handle slow networks and Supabase delays
      const timeoutPromise = new Promise<never>((_, reject) => {
        globalTimeout = setTimeout(() => {
          isAborted = true;
          reject(new Error("Upload timed out. Please try with a smaller file or check your connection."));
        }, 60000);
      });

      try {
        const uploadPromise = (async () => {
          // Compress image if enabled and file is an image
          let fileToUpload = file;
          const effectiveMime = getEffectiveMimeType(file);
          if (compressImages && effectiveMime.startsWith("image/")) {
            setUploadProgress(5); // Show early progress for compression
            try {
              fileToUpload = await compressImage(
                file,
                maxCompressedSizeKB,
                maxImageWidth,
                maxImageHeight
              );
              if (!isAborted) {
                console.log(
                  `Image compressed: ${formatFileSize(file.size)} -> ${formatFileSize(fileToUpload.size)}`
                );
              }
            } catch (compressionError) {
              console.warn("Image compression failed, uploading original:", compressionError);
              // Continue with original file if compression fails
            }
          }

          if (isAborted) throw new Error("Upload cancelled");

          // Simulate progress for better UX
          progressInterval = setInterval(() => {
            setUploadProgress((prev) => {
              if (prev < 85) return prev + Math.random() * 15;
              return prev;
            });
          }, 200);

          const ext = file.name.split(".").pop() || "file";
          const timestamp = Date.now();
          const fileName = `${fileNamePrefix}_${timestamp}.${ext}`;
          const filePath = `${folderPath}/${fileName}`;

          const { data, error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, fileToUpload, {
              cacheControl: "3600",
              upsert: true,
            });

          if (isAborted) throw new Error("Upload cancelled");

          if (uploadError) {
            throw new Error(uploadError.message || "Upload failed");
          }

          if (!data?.path) {
            throw new Error("Upload completed but no file path returned");
          }

          return { data, fileToUpload };
        })();

        // Race between upload and timeout
        const { data, fileToUpload } = await Promise.race([uploadPromise, timeoutPromise]);

        if (progressInterval) clearInterval(progressInterval);
        if (globalTimeout) clearTimeout(globalTimeout);

        setUploadProgress(100);
        setUploadSuccess(true);

        // Get public URL (bucket must be public in Supabase)
        const {
          data: { publicUrl },
        } = supabase.storage.from(bucketName).getPublicUrl(data.path);

        const uploadedFile: UploadedFile = {
          name: file.name,
          size: fileToUpload.size, // Use compressed size
          url: publicUrl,
          type: file.type,
        };

        // Store locally so we can display it immediately
        setLastUploadedFile(uploadedFile);
        onUpload?.(uploadedFile);
        setPendingFile(null);

        // Keep success state visible briefly before resetting
        setTimeout(() => {
          setUploadProgress(0);
          setUploadSuccess(false);
        }, 2000);

        return uploadedFile;
      } catch (err: any) {
        if (progressInterval) clearInterval(progressInterval);
        if (globalTimeout) clearTimeout(globalTimeout);
        setUploadProgress(0);
        const errorMsg = err.message || "Upload failed";
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      } finally {
        setUploading(false);
        if (progressInterval) clearInterval(progressInterval);
        if (globalTimeout) clearTimeout(globalTimeout);
      }
    },
    [
      supabase,
      bucketName,
      folderPath,
      fileNamePrefix,
      validateFile,
      compressImages,
      maxCompressedSizeKB,
      maxImageWidth,
      maxImageHeight,
      onUpload,
      onError,
    ]
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        onError?.(validationError);
        return;
      }

      setError(null);
      onFileSelect?.(file);

      if (uploadOnSelect) {
        await uploadFile(file);
      } else {
        setPendingFile(file);
      }
    },
    [validateFile, onError, onFileSelect, uploadOnSelect, uploadFile]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || uploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = "";
  };

  const handleRemove = () => {
    setPendingFile(null);
    setLastUploadedFile(null);
    setError(null);
    setUploadProgress(0);
    setUploadSuccess(false);
    onRemove?.();
  };

  const handleView = () => {
    const fileUrl = value?.url || lastUploadedFile?.url;
    if (fileUrl) {
      if (onView) {
        onView(fileUrl);
      } else {
        window.open(fileUrl, "_blank");
      }
    }
  };

  // Clear lastUploadedFile when value is set by parent
  useEffect(() => {
    if (value) {
      setLastUploadedFile(null);
    }
  }, [value]);

  const hasFile = !!value || !!pendingFile || !!lastUploadedFile;
  const displayFile =
    value ||
    lastUploadedFile ||
    (pendingFile
      ? {
          name: pendingFile.name,
          size: pendingFile.size,
          type: pendingFile.type,
        }
      : null);

  // Determine if the file is successfully uploaded (either value from parent or lastUploadedFile)
  const isUploaded = !!value || !!lastUploadedFile;

  return (
    <Box>
      {label && (
        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptMime}
        style={{ display: "none" }}
        onChange={handleInputChange}
        disabled={disabled}
      />

      <Paper
        ref={dropZoneRef}
        elevation={0}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() =>
          !disabled && !uploading && !hasFile && fileInputRef.current?.click()
        }
        sx={{
          p: compact ? 2 : 3,
          border: "2px dashed",
          borderColor: error
            ? "error.main"
            : isDragging
            ? "primary.main"
            : hasFile
            ? "success.main"
            : "divider",
          borderRadius: 2,
          bgcolor: error
            ? alpha(theme.palette.error.main, 0.04)
            : isDragging
            ? alpha(theme.palette.primary.main, 0.08)
            : hasFile
            ? alpha(theme.palette.success.main, 0.05)
            : "background.default",
          cursor: disabled
            ? "not-allowed"
            : uploading
            ? "wait"
            : hasFile
            ? "default"
            : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "all 0.2s ease-in-out",
          "&:hover": {
            borderColor: disabled
              ? "divider"
              : hasFile
              ? "success.main"
              : "primary.main",
            bgcolor: disabled
              ? "background.default"
              : hasFile
              ? alpha(theme.palette.success.main, 0.08)
              : alpha(theme.palette.primary.main, 0.04),
          },
        }}
      >
        {uploading ? (
          // Uploading State
          <Box sx={{ textAlign: "center" }}>
            {uploadSuccess ? (
              // Upload completed successfully
              <>
                <CheckCircle
                  sx={{
                    fontSize: compact ? 36 : 48,
                    color: "success.main",
                    mb: 1,
                  }}
                />
                <Typography variant="body2" color="success.main" fontWeight={600}>
                  Upload Complete!
                </Typography>
              </>
            ) : (
              // Still uploading
              <>
                <CircularProgress
                  size={compact ? 36 : 48}
                  variant={uploadProgress > 0 ? "determinate" : "indeterminate"}
                  value={uploadProgress}
                  sx={{ mb: 1.5 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {uploadProgress < 20
                    ? "Compressing image..."
                    : `Uploading... ${Math.round(uploadProgress)}%`}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress}
                  sx={{ mt: 1, maxWidth: 200, mx: "auto", borderRadius: 1 }}
                />
              </>
            )}
          </Box>
        ) : hasFile && displayFile ? (
          // File Selected/Uploaded State
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: isUploaded
                  ? alpha(theme.palette.success.main, 0.1)
                  : alpha(theme.palette.primary.main, 0.1),
                display: "flex",
              }}
            >
              {getFileIcon(displayFile.type)}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={displayFile.name}
              >
                {displayFile.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(displayFile.size)}
              </Typography>
              {isUploaded && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    mt: 0.5,
                  }}
                >
                  <CheckCircle sx={{ fontSize: 14, color: "success.main" }} />
                  <Typography variant="caption" color="success.main">
                    Uploaded successfully
                  </Typography>
                </Box>
              )}
              {pendingFile && !isUploaded && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    mt: 0.5,
                  }}
                >
                  <Typography variant="caption" color="info.main">
                    Ready to upload
                  </Typography>
                </Box>
              )}
            </Box>
            <Stack direction="row" spacing={0.5}>
              {showViewButton && isUploaded && (value?.url || lastUploadedFile?.url) && (
                <Tooltip title="View File">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleView();
                    }}
                  >
                    <Visibility fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Change File">
                <IconButton
                  size="small"
                  color="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={disabled}
                >
                  <Upload fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove">
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  disabled={disabled}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        ) : (
          // Empty State
          <Box sx={{ textAlign: "center" }}>
            <CloudUpload
              sx={{
                fontSize: compact ? 36 : 48,
                color: isDragging ? "primary.main" : "action.disabled",
                mb: 1,
              }}
            />
            <Typography variant="body2" fontWeight={500} gutterBottom>
              {isDragging
                ? "Drop your file here"
                : "Drag and drop your file here"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
            >
              or{" "}
              <Button
                size="small"
                variant="text"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={disabled}
                sx={{ textTransform: "none", p: 0, minWidth: "auto" }}
              >
                browse files
              </Button>
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: "block" }}
            >
              {helperText || `${acceptLabel} • Max ${maxSizeMB}MB`}
            </Typography>
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Manual upload button when uploadOnSelect is false */}
      {!uploadOnSelect && pendingFile && !value && (
        <Button
          variant="contained"
          size="small"
          startIcon={<CloudUpload />}
          onClick={() => uploadFile(pendingFile)}
          disabled={uploading}
          sx={{ mt: 1 }}
        >
          {uploading ? "Uploading..." : "Upload Now"}
        </Button>
      )}
    </Box>
  );
}
