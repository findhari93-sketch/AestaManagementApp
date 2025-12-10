/**
 * Image Compression Utilities for Work Updates
 * Reusable functions for compressing images before upload
 * Optimized for mobile camera photos (often 10MB+)
 */

// Sanitize filename for storage
export const sanitizeFilename = (filename: string): string => {
  const lastDot = filename.lastIndexOf(".");
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : "";

  const sanitized = name
    .replace(/[^a-zA-Z0-9\-_]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);

  return sanitized + ext;
};

// Detect if file is likely from mobile camera (large size)
export const isMobileCameraPhoto = (file: File): boolean => {
  return file.size > 2 * 1024 * 1024; // > 2MB is likely mobile camera
};

// Get optimal compression settings based on file size
export const getCompressionSettings = (file: File) => {
  const isMobile = isMobileCameraPhoto(file);
  return {
    maxSizeKB: isMobile ? 300 : 500,      // Smaller target for mobile
    maxWidth: isMobile ? 1200 : 1920,     // Lower resolution for mobile
    maxHeight: isMobile ? 1200 : 1920,
    quality: isMobile ? 0.7 : 0.8,        // Lower quality for mobile
    timeout: isMobile ? 20000 : 10000,    // Longer timeout for large files
  };
};

// Compress image using Canvas API - optimized for mobile
export const compressImage = (
  file: File,
  maxSizeKB?: number,
  maxWidth?: number,
  maxHeight?: number,
  quality?: number
): Promise<File> => {
  return new Promise((resolve) => {
    // Skip compression for non-image files
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    // Get optimal settings based on file size
    const settings = getCompressionSettings(file);
    const targetMaxSizeKB = maxSizeKB ?? settings.maxSizeKB;
    const targetMaxWidth = maxWidth ?? settings.maxWidth;
    const targetMaxHeight = maxHeight ?? settings.maxHeight;
    const targetQuality = quality ?? settings.quality;

    console.log(`[ImageUtils] Compressing: ${(file.size / 1024 / 1024).toFixed(2)}MB, mobile: ${isMobileCameraPhoto(file)}, target: ${targetMaxSizeKB}KB`);

    // Skip if already small enough
    if (file.size <= targetMaxSizeKB * 1024) {
      console.log("[ImageUtils] File already small enough, skipping compression");
      resolve(file);
      return;
    }

    // Timeout to prevent hanging - longer for mobile photos
    const timeout = setTimeout(() => {
      console.warn("[ImageUtils] Compression timed out, using original file");
      resolve(file);
    }, settings.timeout);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          // Calculate new dimensions maintaining aspect ratio
          let { width, height } = img;

          if (width > targetMaxWidth) {
            height = Math.round((height * targetMaxWidth) / width);
            width = targetMaxWidth;
          }
          if (height > targetMaxHeight) {
            width = Math.round((width * targetMaxHeight) / height);
            height = targetMaxHeight;
          }

          width = Math.max(1, width);
          height = Math.max(1, height);

          console.log(`[ImageUtils] Resizing from ${img.width}x${img.height} to ${width}x${height}`);

          // Create canvas and draw
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            clearTimeout(timeout);
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Always output as JPEG for better compression
          const outputType = "image/jpeg";

          canvas.toBlob(
            (blob) => {
              clearTimeout(timeout);

              if (!blob) {
                console.warn("[ImageUtils] Canvas toBlob failed");
                resolve(file);
                return;
              }

              const sanitizedName = sanitizeFilename(file.name).replace(
                /\.[^/.]+$/,
                ".jpg"
              );
              const compressedFile = new File([blob], sanitizedName, {
                type: outputType,
                lastModified: Date.now(),
              });

              console.log(`[ImageUtils] Compressed to ${(compressedFile.size / 1024).toFixed(0)}KB (quality: ${targetQuality})`);

              // If still too large, try lower quality (recursive)
              if (compressedFile.size > targetMaxSizeKB * 1024 && targetQuality > 0.3) {
                console.log(`[ImageUtils] Still too large, reducing quality to ${targetQuality - 0.1}`);
                compressImage(file, targetMaxSizeKB, targetMaxWidth, targetMaxHeight, targetQuality - 0.1)
                  .then(resolve)
                  .catch(() => resolve(file));
              } else {
                resolve(compressedFile);
              }
            },
            outputType,
            targetQuality
          );
        } catch (err) {
          console.error("[ImageUtils] Compression error:", err);
          clearTimeout(timeout);
          resolve(file);
        }
      };
      img.onerror = () => {
        console.error("[ImageUtils] Image load error");
        clearTimeout(timeout);
        resolve(file);
      };
    };
    reader.onerror = () => {
      console.error("[ImageUtils] FileReader error");
      clearTimeout(timeout);
      resolve(file);
    };
  });
};

// Generate storage path for work update photos
export const getWorkUpdatePhotoPath = (
  siteId: string,
  date: string, // YYYY-MM-DD
  period: "morning" | "evening",
  photoIndex: number
): string => {
  const timestamp = Date.now();
  return `${siteId}/${date}/${period}/photo_${photoIndex}_${timestamp}.jpg`;
};
