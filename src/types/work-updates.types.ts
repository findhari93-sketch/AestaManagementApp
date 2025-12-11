/**
 * Work Updates Types
 * Types for morning/evening work documentation with photo capture
 */

export interface WorkPhoto {
  id: string; // "1", "2", etc.
  url: string;
  description?: string; // Only for morning photos
  uploadedAt: string;
}

export interface MorningUpdate {
  description: string; // Overall planned work
  photos: WorkPhoto[]; // 0-5 photos
  timestamp: string;
}

// Per-task progress tracking
export interface TaskProgress {
  taskId: string; // "1", "2", etc. (matches photo id)
  completionPercent: number; // 0-100
}

export interface EveningUpdate {
  completionPercent: number; // 0-100 (average of task progress for backward compatibility)
  taskProgress?: TaskProgress[]; // Per-task progress (optional for backward compatibility)
  summary: string; // What happened today
  photos: WorkPhoto[]; // 0-5 photos (ideally matching morning count)
  timestamp: string;
}

export interface WorkUpdates {
  photoCount: number; // 1-5, selected by user
  morning: MorningUpdate | null;
  evening: EveningUpdate | null;
}

// Helper type for photo slots in forms
export interface PhotoSlotState {
  id: string;
  photo: WorkPhoto | null;
  description: string;
  isUploading: boolean;
  uploadProgress: number;
}

// Default empty state for work updates
export const createEmptyWorkUpdates = (photoCount: number = 3): WorkUpdates => ({
  photoCount,
  morning: null,
  evening: null,
});

// Create initial photo slots for forms
export const createPhotoSlots = (count: number): PhotoSlotState[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    photo: null,
    description: "",
    isUploading: false,
    uploadProgress: 0,
  }));
};

// Convert photo slots to WorkPhoto array (for saving)
export const photoSlotsToPhotos = (slots: PhotoSlotState[]): WorkPhoto[] => {
  return slots
    .filter((slot) => slot.photo !== null)
    .map((slot) => ({
      id: slot.id,
      url: slot.photo!.url,
      description: slot.description || undefined,
      uploadedAt: slot.photo!.uploadedAt,
    }));
};

// Convert WorkPhoto array to photo slots (for loading)
export const photosToPhotoSlots = (
  photos: WorkPhoto[],
  totalCount: number
): PhotoSlotState[] => {
  const slots = createPhotoSlots(totalCount);
  photos.forEach((photo) => {
    const index = parseInt(photo.id, 10) - 1;
    if (index >= 0 && index < slots.length) {
      slots[index] = {
        id: photo.id,
        photo: {
          id: photo.id,
          url: photo.url,
          description: photo.description,
          uploadedAt: photo.uploadedAt,
        },
        description: photo.description || "",
        isUploading: false,
        uploadProgress: 0,
      };
    }
  });
  return slots;
};
