"use client";

import { useCallback, useRef, useState } from "react";
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
};

const FILE_TYPE_CONFIG: Record<FileType, { accept: string; label: string }> = {
  pdf: {
    accept: "application/pdf",
    label: "PDF files only",
  },
  image: {
    accept: "image/png,image/jpeg,image/jpg",
    label: "PNG, JPG files",
  },
  all: {
    accept: "application/pdf,image/png,image/jpeg,image/jpg",
    label: "PDF, PNG, JPG files",
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
}: FileUploaderProps) {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const acceptMime = acceptString || FILE_TYPE_CONFIG[accept].accept;
  const acceptLabel = FILE_TYPE_CONFIG[accept].label;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      const allowedTypes = acceptMime.split(",").map((t) => t.trim());
      if (
        !allowedTypes.some(
          (t) => file.type === t || file.type.startsWith(t.replace("*", ""))
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
      setError(null);

      let progressInterval: NodeJS.Timeout | null = null;

      try {
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
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (progressInterval) clearInterval(progressInterval);

        if (uploadError) {
          throw new Error(uploadError.message || "Upload failed");
        }

        if (!data?.path) {
          throw new Error("Upload completed but no file path returned");
        }

        setUploadProgress(100);

        // Get public URL (bucket must be public in Supabase)
        const {
          data: { publicUrl },
        } = supabase.storage.from(bucketName).getPublicUrl(data.path);

        const uploadedFile: UploadedFile = {
          name: file.name,
          size: file.size,
          url: publicUrl,
          type: file.type,
        };
        onUpload?.(uploadedFile);
        setPendingFile(null);

        // Keep progress visible briefly before resetting
        setTimeout(() => setUploadProgress(0), 1500);

        return uploadedFile;
      } catch (err: any) {
        if (progressInterval) clearInterval(progressInterval);
        setUploadProgress(0);
        const errorMsg = err.message || "Upload failed";
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      } finally {
        setUploading(false);
        if (progressInterval) clearInterval(progressInterval);
      }
    },
    [
      supabase,
      bucketName,
      folderPath,
      fileNamePrefix,
      validateFile,
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
    setError(null);
    setUploadProgress(0);
    onRemove?.();
  };

  const handleView = () => {
    if (value?.url) {
      if (onView) {
        onView(value.url);
      } else {
        window.open(value.url, "_blank");
      }
    }
  };

  const hasFile = !!value || !!pendingFile;
  const displayFile =
    value ||
    (pendingFile
      ? {
          name: pendingFile.name,
          size: pendingFile.size,
          type: pendingFile.type,
        }
      : null);

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
            <CircularProgress
              size={compact ? 36 : 48}
              variant={uploadProgress > 0 ? "determinate" : "indeterminate"}
              value={uploadProgress}
              sx={{ mb: 1.5 }}
            />
            <Typography variant="body2" color="text.secondary">
              Uploading...{" "}
              {uploadProgress > 0 ? `${Math.round(uploadProgress)}%` : ""}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{ mt: 1, maxWidth: 200, mx: "auto", borderRadius: 1 }}
            />
          </Box>
        ) : hasFile && displayFile ? (
          // File Selected/Uploaded State
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: value
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
              {value && (
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
              {pendingFile && !value && (
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
              {showViewButton && value?.url && (
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
