"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  IconButton,
  Typography,
  useTheme,
  useMediaQuery,
  alpha,
  Fade,
  Button,
  CircularProgress,
} from "@mui/material";
import {
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Download as DownloadIcon,
  FitScreen as FitScreenIcon,
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface BillViewerDialogProps {
  open: boolean;
  onClose: () => void;
  billUrl: string | null;
  title?: string;
}

/**
 * Full-screen modal for viewing vendor bills (images and PDFs)
 * Features:
 * - Mobile: Full-screen overlay with pinch-to-zoom
 * - Desktop: Large modal (90% viewport) with zoom controls
 * - PDF support: Embedded viewer
 * - Image support: Zoom and pan with react-zoom-pan-pinch
 */
export default function BillViewerDialog({
  open,
  onClose,
  billUrl,
  title = "Vendor Bill",
}: BillViewerDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Determine file type - handle URLs with query parameters
  const getFileExtension = (url: string | null): string => {
    if (!url) return "";
    try {
      // Remove query parameters and get the pathname
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const lastDot = pathname.lastIndexOf(".");
      return lastDot !== -1 ? pathname.substring(lastDot) : "";
    } catch {
      // Fallback for relative URLs
      const cleanUrl = url.split("?")[0].toLowerCase();
      const lastDot = cleanUrl.lastIndexOf(".");
      return lastDot !== -1 ? cleanUrl.substring(lastDot) : "";
    }
  };

  const fileExt = getFileExtension(billUrl);
  const isPdf = fileExt === ".pdf";
  // Check for known image extensions, or if no extension, assume it's an image (most bills are images)
  const hasImageExtension = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(fileExt);
  const isImage = hasImageExtension || (!isPdf && fileExt === "");

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(false);
    }
  }, [open, billUrl]);

  const handleDownload = useCallback(() => {
    if (billUrl) {
      const link = document.createElement("a");
      link.href = billUrl;
      link.download = `bill-${Date.now()}${isPdf ? ".pdf" : ".jpg"}`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [billUrl, isPdf]);

  const handleOpenInNewTab = useCallback(() => {
    if (billUrl) {
      window.open(billUrl, "_blank");
    }
  }, [billUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!billUrl) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth={false}
      PaperProps={{
        sx: {
          ...(isMobile
            ? {}
            : {
                width: "90vw",
                height: "90vh",
                maxWidth: "90vw",
                maxHeight: "90vh",
              }),
          bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 1,
          px: 2,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography component="span" variant="subtitle1" fontWeight={600} noWrap sx={{ flex: 1 }}>
          {title}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {/* Open in new tab button */}
          <IconButton
            onClick={handleOpenInNewTab}
            size="small"
            title="Open in new tab"
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>

          {/* Download button */}
          <IconButton onClick={handleDownload} size="small" title="Download">
            <DownloadIcon fontSize="small" />
          </IconButton>

          {/* Close button */}
          <IconButton onClick={onClose} size="small" title="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Content */}
      <DialogContent
        sx={{
          p: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.200",
        }}
      >
        {/* Loading indicator */}
        {loading && (
          <Box
            sx={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              zIndex: 5,
            }}
          >
            <CircularProgress size={40} />
            <Typography color="text.secondary">Loading bill...</Typography>
          </Box>
        )}

        {/* Error state */}
        {error && !loading && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              p: 4,
            }}
          >
            <Typography color="error">Failed to load bill</Typography>
            <Button variant="outlined" onClick={handleOpenInNewTab}>
              Open in new tab
            </Button>
          </Box>
        )}

        {/* PDF Viewer */}
        {isPdf && (
          <Fade in={!loading} timeout={300}>
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: loading ? "none" : "flex",
              }}
            >
              <iframe
                src={`${billUrl}#toolbar=1&navpanes=0`}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
                title="Bill PDF"
              />
            </Box>
          </Fade>
        )}

        {/* Image Viewer with zoom/pan */}
        {isImage && (
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit
            wheel={{ step: 0.1 }}
            pinch={{ step: 5 }}
            doubleClick={{ mode: "reset" }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                {/* Zoom controls for desktop */}
                {!isMobile && (
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 16,
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      bgcolor: alpha(theme.palette.common.black, 0.7),
                      borderRadius: 2,
                      px: 2,
                      py: 1,
                      zIndex: 10,
                    }}
                  >
                    <IconButton
                      onClick={() => zoomOut()}
                      size="small"
                      sx={{ color: "white" }}
                    >
                      <ZoomOutIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => resetTransform()}
                      size="small"
                      sx={{ color: "white" }}
                      title="Reset zoom"
                    >
                      <FitScreenIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => zoomIn()}
                      size="small"
                      sx={{ color: "white" }}
                    >
                      <ZoomInIcon />
                    </IconButton>
                  </Box>
                )}

                {/* Mobile hint */}
                {isMobile && !loading && (
                  <Typography
                    variant="caption"
                    sx={{
                      position: "absolute",
                      bottom: 8,
                      left: "50%",
                      transform: "translateX(-50%)",
                      bgcolor: alpha(theme.palette.common.black, 0.6),
                      color: "white",
                      px: 2,
                      py: 0.5,
                      borderRadius: 1,
                      zIndex: 10,
                    }}
                  >
                    Pinch to zoom • Double-tap to reset
                  </Typography>
                )}

                <TransformComponent
                  wrapperStyle={{
                    width: "100%",
                    height: "100%",
                  }}
                  contentStyle={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Fade in={!loading} timeout={300}>
                    <Box
                      component="img"
                      src={billUrl}
                      alt="Vendor Bill"
                      onLoad={() => setLoading(false)}
                      onError={() => {
                        setLoading(false);
                        setError(true);
                      }}
                      sx={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                        borderRadius: 1,
                        boxShadow: theme.shadows[8],
                      }}
                    />
                  </Fade>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        )}

        {/* Fallback for unknown file types */}
        {!isPdf && !isImage && !loading && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              p: 4,
            }}
          >
            <Typography color="text.secondary">
              Cannot preview this file type
            </Typography>
            <Button variant="contained" onClick={handleOpenInNewTab}>
              Open in new tab
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reusable button component to open bill viewer
 */
interface BillPreviewButtonProps {
  billUrl: string | null;
  label?: string;
  title?: string;
  variant?: "text" | "outlined" | "contained";
  size?: "small" | "medium" | "large";
  showIcon?: boolean;
}

export function BillPreviewButton({
  billUrl,
  label = "View Bill",
  title,
  variant = "text",
  size = "small",
  showIcon = true,
}: BillPreviewButtonProps) {
  const [viewerOpen, setViewerOpen] = useState(false);

  if (!billUrl) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setViewerOpen(true)}
        startIcon={showIcon ? <OpenInNewIcon /> : undefined}
      >
        {label}
      </Button>
      <BillViewerDialog
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        billUrl={billUrl}
        title={title}
      />
    </>
  );
}
