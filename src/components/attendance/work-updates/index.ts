// Work Updates Components
export { default as WorkUpdatesSection } from "./WorkUpdatesSection";
export { default as MorningUpdateForm } from "./MorningUpdateForm";
export { default as EveningUpdateForm } from "./EveningUpdateForm";
export { default as PhotoCaptureButton } from "./PhotoCaptureButton";
export { default as PhotoSlot } from "./PhotoSlot";
export { default as PhotoThumbnailStrip, PhotoBadge } from "./PhotoThumbnailStrip";
export { default as PhotoFullscreenDialog } from "./PhotoFullscreenDialog";
export { default as WorkUpdateViewer } from "./WorkUpdateViewer";

// Utils
export * from "./imageUtils";

// Re-export types
export type {
  WorkUpdates,
  MorningUpdate,
  EveningUpdate,
  WorkPhoto,
  PhotoSlotState,
} from "@/types/work-updates.types";

export {
  createEmptyWorkUpdates,
  createPhotoSlots,
  photoSlotsToPhotos,
  photosToPhotoSlots,
} from "@/types/work-updates.types";
