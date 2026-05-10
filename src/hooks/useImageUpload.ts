"use client";

import { useState, useCallback } from "react";
import imageCompression from "browser-image-compression";
import { SupabaseClient } from "@supabase/supabase-js";
import { hardenedUpload } from "@/lib/storage/uploadHelpers";

export interface UploadedImage {
  url: string;
  name: string;
  size: number;
}

export interface UseImageUploadOptions {
  supabase: SupabaseClient;
  bucketName: string;
  folderPath?: string;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
}

export interface UseImageUploadReturn {
  upload: (file: File) => Promise<UploadedImage>;
  uploadBlob: (blob: Blob, fileName: string) => Promise<UploadedImage>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

export function useImageUpload({
  supabase,
  bucketName,
  folderPath = "uploads",
  maxSizeMB = 0.5,
  maxWidthOrHeight = 400,
  quality = 0.8,
}: UseImageUploadOptions): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  const compressImage = useCallback(
    async (file: File | Blob): Promise<File> => {
      const options = {
        maxSizeMB,
        maxWidthOrHeight,
        useWebWorker: true,
        fileType: "image/jpeg" as const,
        initialQuality: quality,
      };

      setProgress(10);

      try {
        // Convert Blob to File if needed
        const fileToCompress =
          file instanceof File
            ? file
            : new File([file], "image.jpg", { type: "image/jpeg" });

        const compressedFile = await imageCompression(fileToCompress, options);
        setProgress(40);
        return compressedFile;
      } catch (err) {
        console.error("Compression error:", err);
        // Return original if compression fails
        return file instanceof File
          ? file
          : new File([file], "image.jpg", { type: file.type || "image/jpeg" });
      }
    },
    [maxSizeMB, maxWidthOrHeight, quality]
  );

  const uploadToSupabase = useCallback(
    async (file: File, fileName: string): Promise<string> => {
      const timestamp = Date.now();
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${folderPath}/${fileName}_${timestamp}.${ext}`;

      setProgress(50);

      try {
        const { publicUrl } = await hardenedUpload({
          supabase,
          bucketName,
          filePath,
          file,
          onProgress: (percent) => {
            // Map XHR progress (0-100) to our UI range (50-95)
            setProgress(50 + Math.round(percent * 0.45));
          },
        });
        setProgress(100);
        return publicUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Provide user-friendly error messages for known failure modes
        if (message.includes("Bucket not found") || message.includes("bucket")) {
          throw new Error(
            `Storage bucket "${bucketName}" not found. Please create it in your Supabase Dashboard > Storage.`
          );
        }
        if (message.includes("not allowed") || message.includes("policy")) {
          throw new Error(
            "Upload permission denied. Please check your storage bucket policies in Supabase."
          );
        }
        if (message.includes("too large") || message.includes("size")) {
          throw new Error(
            "Image is too large. Please try a smaller image (max 5MB recommended)."
          );
        }
        if (message.includes("timed out") || message.includes("stalled")) {
          throw new Error(
            "Upload timed out. Please check your connection and try again."
          );
        }
        throw err;
      }
    },
    [supabase, bucketName, folderPath]
  );

  const upload = useCallback(
    async (file: File): Promise<UploadedImage> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          throw new Error("Please select an image file");
        }

        // Compress image
        const compressedFile = await compressImage(file);

        // Upload to Supabase
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        const url = await uploadToSupabase(compressedFile, fileName);

        return {
          url,
          name: file.name,
          size: compressedFile.size,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Upload failed";
        setError(errorMessage);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [compressImage, uploadToSupabase]
  );

  const uploadBlob = useCallback(
    async (blob: Blob, fileName: string): Promise<UploadedImage> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        // Convert blob to file
        const file = new File([blob], `${fileName}.jpg`, {
          type: "image/jpeg",
        });

        // Compress image
        const compressedFile = await compressImage(file);

        // Upload to Supabase
        const url = await uploadToSupabase(compressedFile, fileName);

        return {
          url,
          name: `${fileName}.jpg`,
          size: compressedFile.size,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Upload failed";
        setError(errorMessage);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [compressImage, uploadToSupabase]
  );

  return {
    upload,
    uploadBlob,
    isUploading,
    progress,
    error,
    reset,
  };
}
