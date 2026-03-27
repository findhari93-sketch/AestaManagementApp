"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import InstallPrompt from "./InstallPrompt";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAContextType {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<void>;
  dismissInstall: () => void;
  isDismissed: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error("usePWA must be used within PWAProvider");
  }
  return context;
}

const DISMISS_KEY = "aesta_pwa_install_dismissed";

export default function PWAProvider({ children }: { children: ReactNode }) {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS
    const isiOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !("MSStream" in window);
    setIsIOS(isiOS);

    // Check if previously dismissed this session
    if (sessionStorage.getItem(DISMISS_KEY) === "true") {
      setIsDismissed(true);
    }

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[PWA] Service worker registered");

          // Check for updates every 60 minutes
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          console.error("[PWA] Service worker registration failed:", error);
        });
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPromptRef.current = null;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setCanInstall(false);
    deferredPromptRef.current = null;
  }, []);

  const dismissInstall = useCallback(() => {
    setIsDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "true");
  }, []);

  const contextValue: PWAContextType = {
    canInstall,
    isInstalled,
    isIOS,
    promptInstall,
    dismissInstall,
    isDismissed,
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}
      <InstallPrompt />
    </PWAContext.Provider>
  );
}
