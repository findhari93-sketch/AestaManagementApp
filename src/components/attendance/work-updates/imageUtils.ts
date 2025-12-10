/**
 * Image Compression Utilities for Work Updates
 * Reusable functions for compressing images before upload
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

// Compress image using Canvas API
export const compressImage = (
  file: File,
  maxSizeKB: number = 500,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve) => {
    // Skip compression for non-image files
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    // Skip if already small enough
    if (file.size <= maxSizeKB * 1024) {
      resolve(file);
      return;
    }

    // Timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.warn("Image compression timed out, using original file");
      resolve(file);
    }, 10000);

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

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }

          width = Math.max(1, width);
          height = Math.max(1, height);

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

              // If still too large, try lower quality
              if (compressedFile.size > maxSizeKB * 1024 && quality > 0.3) {
                compressImage(file, maxSizeKB, maxWidth, maxHeight, quality - 0.1)
                  .then(resolve)
                  .catch(() => resolve(file));
              } else {
                resolve(compressedFile);
              }
            },
            outputType,
            quality
          );
        } catch {
          clearTimeout(timeout);
          resolve(file);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(file);
      };
    };
    reader.onerror = () => {
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
