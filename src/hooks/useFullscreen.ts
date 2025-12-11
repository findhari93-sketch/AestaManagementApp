"use client";

import { useState, useEffect, useCallback, RefObject } from "react";

// Screen Orientation lock types
type OrientationLockTypeCompat =
  | "any"
  | "natural"
  | "landscape"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary"
  | "landscape-primary"
  | "landscape-secondary";

interface UseFullscreenOptions {
  /** Orientation to lock when entering fullscreen (if supported) */
  orientation?: OrientationLockTypeCompat;
  /** Callback when fullscreen state changes */
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

interface UseFullscreenReturn {
  /** Whether the element is currently in fullscreen mode */
  isFullscreen: boolean;
  /** Whether fullscreen is supported in this browser */
  isSupported: boolean;
  /** Enter fullscreen mode */
  enterFullscreen: () => Promise<void>;
  /** Exit fullscreen mode */
  exitFullscreen: () => Promise<void>;
  /** Toggle fullscreen mode */
  toggleFullscreen: () => Promise<void>;
}

/**
 * Custom hook for managing fullscreen mode using the native Fullscreen API.
 * Includes optional screen orientation locking for mobile devices.
 *
 * @param elementRef - React ref to the element to make fullscreen
 * @param options - Configuration options
 * @returns Fullscreen state and control functions
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen(containerRef, {
 *   orientation: 'landscape',
 * });
 * ```
 */
export function useFullscreen(
  elementRef: RefObject<HTMLElement>,
  options: UseFullscreenOptions = {}
): UseFullscreenReturn {
  const { orientation = "landscape", onFullscreenChange } = options;
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Check if fullscreen is supported
  const isSupported =
    typeof document !== "undefined" &&
    (document.fullscreenEnabled ||
      // @ts-expect-error - Vendor prefixes
      document.webkitFullscreenEnabled ||
      // @ts-expect-error - Vendor prefixes
      document.mozFullScreenEnabled ||
      // @ts-expect-error - Vendor prefixes
      document.msFullscreenEnabled);

  // Enter fullscreen mode
  const enterFullscreen = useCallback(async () => {
    const element = elementRef.current;
    if (!element) {
      console.warn("useFullscreen: No element ref provided");
      return;
    }

    try {
      // Use the appropriate fullscreen method (with vendor prefixes)
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }

      // Try to lock orientation (may fail on some browsers/devices)
      // Note: screen.orientation.lock() is not in all TypeScript definitions
      const screenOrientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation && screenOrientation?.lock) {
        try {
          await screenOrientation.lock(orientation);
        } catch (orientationError) {
          // Orientation lock not supported or not allowed - continue anyway
          console.debug(
            "useFullscreen: Orientation lock not supported:",
            orientationError
          );
        }
      }
    } catch (error) {
      console.error("useFullscreen: Failed to enter fullscreen:", error);
      throw error;
    }
  }, [elementRef, orientation]);

  // Exit fullscreen mode
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }

      // Unlock orientation
      const screenOrientation = screen.orientation as ScreenOrientation & {
        unlock?: () => void;
      };
      if (screenOrientation?.unlock) {
        try {
          screenOrientation.unlock();
        } catch {
          // Ignore unlock errors
        }
      }
    } catch (error) {
      console.error("useFullscreen: Failed to exit fullscreen:", error);
      throw error;
    }
  }, []);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Listen for fullscreen changes (including ESC key, etc.)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement;

      const newIsFullscreen = !!fullscreenElement;
      setIsFullscreen(newIsFullscreen);
      onFullscreenChange?.(newIsFullscreen);
    };

    // Add event listeners for all vendor prefixes
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, [onFullscreenChange]);

  return {
    isFullscreen,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}

export default useFullscreen;
